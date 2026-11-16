package in.fonzkart.backend.pricing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.catalog.dto.VariantWithModelDto;
import in.fonzkart.backend.order.rules.OrderStatus;
import in.fonzkart.backend.order.service.CustomerOrderService;
import in.fonzkart.backend.pricing.data.PricingData;
import in.fonzkart.backend.pricing.engine.PartCatalog;
import in.fonzkart.backend.pricing.engine.PriceSheet;
import in.fonzkart.backend.pricing.engine.RepairCostEstimator;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * The admin side of the pricing engine: the overview, resales (what Fonzkart sold a bought device for and what its
 * repairs cost — the data the engine learns most from), repair costs from price lists, and a device's price explained.
 * Everything here is for administrators only.
 */
@Service
public class PricingIntelligenceService {

    static final Set<String> SOURCES = Set.of(RepairCostEstimator.SOURCE_ADMIN, RepairCostEstimator.SOURCE_OFFICIAL);
    static final Set<String> GRADES = Set.of("superb", "good", "fair", "parts");
    static final int MAX_IMPORT = 2000;

    private final PricingData data;
    private final PricingSettings settings;
    private final PricingKnowledge knowledge;
    private final PricingService pricing;
    private final PriceSheetService sheets;
    private final CustomerOrderService orders;
    private final ModelReference references;
    private final StaffAccess access;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public PricingIntelligenceService(PricingData data, PricingSettings settings, PricingKnowledge knowledge,
                                      PricingService pricing, PriceSheetService sheets, CustomerOrderService orders,
                                      ModelReference references, StaffAccess access, JdbcTemplate jdbc, ObjectMapper mapper) {
        this.data = data;
        this.settings = settings;
        this.knowledge = knowledge;
        this.pricing = pricing;
        this.sheets = sheets;
        this.orders = orders;
        this.references = references;
        this.access = access;
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public void requireAdmin(Optional<SessionPayload> session) {
        access.requireRole(session, StaffAccess.ADMINS);
    }

    // ------------------------------------------------------------------------------------------------ overview

    /** How much of the catalog prices itself, what the engine has learnt from, and what waits for the admin. */
    public Map<String, Object> overview(Optional<SessionPayload> session) {
        access.requireRole(session, StaffAccess.ADMINS);
        List<PricingData.CatalogVariant> variants = data.catalogVariants();
        Map<String, PricingData.VariantPricing> pricingRows = data.allVariantPricing();
        int priced = 0;
        int auto = 0;
        int withLaunch = 0;
        Set<String> models = new java.util.HashSet<>();
        Set<String> modelsWithReference = new java.util.HashSet<>();
        for (PricingData.CatalogVariant v : variants) {
            models.add(v.modelId());
            if (v.basePrice() != null && v.basePrice() > 0) {
                priced++;
            }
            PricingData.VariantPricing vp = pricingRows.get(v.variantId());
            if (vp != null && vp.hasLaunch()) {
                withLaunch++;
                modelsWithReference.add(v.modelId());
                if (vp.auto()) {
                    auto++;
                }
            } else if (references.find(v.brandId(), v.modelName()).isPresent()) {
                modelsWithReference.add(v.modelId());
            }
        }
        Map<String, Object> catalog = new LinkedHashMap<>();
        catalog.put("variants", variants.size());
        catalog.put("priced", priced);
        catalog.put("auto", auto);
        catalog.put("withLaunchPrice", withLaunch);
        catalog.put("models", models.size());
        catalog.put("modelsWithLaunchReference", modelsWithReference.size());

        Map<String, Long> repairSources = new LinkedHashMap<>();
        for (PricingData.RepairCost r : data.repairCosts(null)) {
            repairSources.merge(r.source(), 1L, Long::sum);
        }
        Long repairList = count("SELECT count(*) FROM \"RepairPrice\" WHERE \"isActive\" = true");
        repairSources.put(RepairCostEstimator.SOURCE_REPAIR_LIST, repairList == null ? 0 : repairList);

        LocalDateTime now = JsDates.nowUtc();
        List<PricingData.Sale> sales = data.sales();
        long recent = 0;
        double margin = 0;
        double logistics = settings.logisticsCost();
        for (PricingData.Sale s : sales) {
            if (s.soldAt() != null && s.soldAt().isAfter(now.minusDays(90)) && s.salePrice() > 0) {
                recent++;
                margin += (s.salePrice() - s.purchasePrice() - s.repairCost() - logistics) / (double) s.salePrice();
            }
        }
        Map<String, Object> learning = new LinkedHashMap<>();
        learning.put("sales", sales.size());
        learning.put("salesLast90Days", recent);
        learning.put("marginLast90Days", recent == 0 ? null : Math.round(margin / recent * 1000) / 10.0);
        learning.put("checks", checkStats());
        learning.put("quotesLast30Days", data.quoteCounts(now.minusDays(30)));
        learning.put("lastRun", data.setting(PricingLearningService.LAST_RUN_KEY).orElse(null));

        Map<String, Long> open = new LinkedHashMap<>();
        for (PricingData.Recommendation r : data.recommendations("open", 5000)) {
            open.merge(r.kind(), 1L, Long::sum);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("engineVersion", PriceSheetService.ENGINE_VERSION);
        m.put("settings", settings.all());
        m.put("catalog", catalog);
        m.put("repairCostSources", repairSources);
        m.put("learning", learning);
        m.put("openSuggestions", open);
        m.put("parts", PartCatalog.LABELS);
        return m;
    }

    /** Pickup checks: how many orders were checked, how many had their price changed and by how much on average. */
    private Map<String, Object> checkStats() {
        Map<String, Object> m = new LinkedHashMap<>();
        try {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT price, answers FROM \"Order\" WHERE \"riderAnswers\" IS NOT NULL "
                    + "AND \"updatedAt\" >= ? AND lower(status) IN (?, ?)", now90(), OrderStatus.PICKED_UP, OrderStatus.COMPLETED);
            int changed = 0;
            double change = 0;
            for (Map<String, Object> r : rows) {
                JsonNode review = parse((String) r.get("answers")).path("priceReview");
                if ("approved".equals(review.path("decision").asText()) && review.path("quotedPrice").asDouble() > 0) {
                    changed++;
                    change += (review.path("approvedPrice").asDouble() - review.path("quotedPrice").asDouble()) / review.path("quotedPrice").asDouble();
                }
            }
            m.put("checkedLast90Days", rows.size());
            m.put("priceChanged", changed);
            m.put("averageChangePercent", changed == 0 ? null : Math.round(change / changed * 1000) / 10.0);
        } catch (RuntimeException e) {
            m.put("checkedLast90Days", 0);
        }
        return m;
    }

    private static LocalDateTime now90() {
        return JsDates.nowUtc().minusDays(90);
    }

    // ------------------------------------------------------------------------------------------------ explain

    /** A device's price explained: its sheet, the repair estimates with their sources and its launch reference. */
    public Map<String, Object> explain(Optional<SessionPayload> session, String device, String variantName) {
        access.requireRole(session, StaffAccess.ADMINS);
        VariantWithModelDto variant = orders.findDevice(device, variantName)
                .orElseThrow(() -> new ActionException(HttpStatus.NOT_FOUND, "Device not found."));
        PriceSheet sheet = pricing.sheetFor(variant);
        String category = CustomerOrderService.sellCategory(variant.model() == null ? null : variant.model().category());
        PriceSheetService.Reference ref = sheets.reference(new PriceSheetService.Device(variant.id(),
                variant.basePrice() == null ? 0 : variant.basePrice(), category,
                variant.model() == null ? null : variant.model().brandId(), variant.modelId(),
                variant.model() == null ? null : variant.model().name()), PartCatalog.normalize(category));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("device", (variant.model() == null ? "" : variant.model().name() + " ") + "(" + variant.name() + ")");
        m.put("variantId", variant.id());
        m.put("sheet", sheet);
        m.put("reference", ref);
        m.put("resale", knowledge.resale(category, variant.model() == null ? null : variant.model().brandId(), variant.modelId()));
        return m;
    }

    // ------------------------------------------------------------------------------------------------ resales

    /**
     * Records the resale of a bought device. Body: {@code orderId} or {@code orderNumber} (a picked-up or completed
     * order; its price is what
     * Fonzkart paid) or {@code device} + {@code variant} + {@code purchasePrice}; {@code salePrice}; {@code repairs}
     * [{part, cost}] (what was repaired before the sale); {@code grade} superb | good | fair | parts; optional
     * {@code channel}, {@code note}, {@code soldAt} (YYYY-MM-DD).
     */
    public Map<String, Object> recordSale(Optional<SessionPayload> session, JsonNode body) {
        access.requireRole(session, StaffAccess.ADMINS);
        if (body == null || !body.isObject()) {
            throw bad("Enter the sale.");
        }
        String orderId = text(body, "orderId");
        JsonNode number = body.get("orderNumber");
        if (orderId == null && number != null && number.canConvertToInt()) {
            orderId = jdbc.queryForList("SELECT id FROM \"Order\" WHERE \"orderNumber\" = ?", String.class, number.asInt())
                    .stream().findFirst().orElseThrow(() -> new ActionException(HttpStatus.NOT_FOUND, "No order #" + number.asInt() + "."));
        }
        String device;
        long purchase;
        VariantWithModelDto variant;
        if (orderId != null) {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT device, price, status FROM \"Order\" WHERE id = ?", orderId);
            if (rows.isEmpty()) {
                throw new ActionException(HttpStatus.NOT_FOUND, "Order not found.");
            }
            Map<String, Object> o = rows.get(0);
            if (!OrderStatus.isPickedUpOrLater((String) o.get("status"))) {
                throw bad("Only a device Fonzkart has picked up can be resold.");
            }
            if (data.saleForOrder(orderId).isPresent()) {
                throw bad("This order's resale is already recorded.");
            }
            device = (String) o.get("device");
            purchase = ((Number) o.get("price")).longValue();
            int open = device.lastIndexOf(" (");
            variant = open > 0 && device.endsWith(")")
                    ? orders.findDevice(device.substring(0, open), device.substring(open + 2, device.length() - 1)).orElse(null) : null;
        } else {
            String d = text(body, "device");
            String v = text(body, "variant");
            if (d == null || v == null) {
                throw bad("Choose the order, or enter the device and variant.");
            }
            variant = orders.findDevice(d, v).orElseThrow(() -> new ActionException(HttpStatus.NOT_FOUND, "Device not found."));
            device = d + " (" + v + ")";
            purchase = whole(body, "purchasePrice", "the price Fonzkart paid");
        }
        long sale = whole(body, "salePrice", "the sale price");
        List<Map<String, Object>> repairs = new ArrayList<>();
        long repairTotal = 0;
        JsonNode list = body.get("repairs");
        if (list != null && !list.isNull()) {
            if (!list.isArray() || list.size() > 12) {
                throw bad("List the repairs as part and cost.");
            }
            for (JsonNode r : list) {
                String part = r.path("part").asText("");
                long cost = r.path("cost").asLong(-1);
                if (!PartCatalog.LABELS.containsKey(part) || cost < 0 || cost > 500_000) {
                    throw bad("Each repair needs a known part and its cost in rupees.");
                }
                repairs.add(Map.of("part", part, "cost", cost));
                repairTotal += cost;
            }
        }
        String grade = Optional.ofNullable(text(body, "grade")).orElse("good");
        if (!GRADES.contains(grade)) {
            throw bad("Grade: superb, good, fair or parts.");
        }
        LocalDateTime soldAt = JsDates.nowUtc();
        String soldOn = text(body, "soldAt");
        if (soldOn != null) {
            try {
                soldAt = LocalDate.parse(soldOn).atTime(12, 0);
            } catch (DateTimeParseException e) {
                throw bad("Enter the sale date as YYYY-MM-DD.");
            }
        }
        String repairsJson;
        try {
            repairsJson = mapper.writeValueAsString(repairs);
        } catch (Exception e) {
            repairsJson = "[]";
        }
        String by = session.map(sp -> sp.user() == null ? null : sp.user().name()).orElse("admin");
        String category = variant == null ? null : CustomerOrderService.sellCategory(variant.model() == null ? null : variant.model().category());
        String id = data.insertSale(new PricingData.Sale(null, orderId, variant == null ? null : variant.id(),
                variant == null ? null : variant.modelId(), device, category, purchase,
                variant == null || variant.basePrice() == null ? null : variant.basePrice().longValue(), sale, repairTotal,
                repairsJson, text(body, "channel"), grade, text(body, "note"), soldAt, by));
        knowledge.invalidate();
        long profit = sale - purchase - repairTotal - Math.round(settings.logisticsCost());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        m.put("id", id);
        m.put("profit", profit);
        m.put("marginPercent", sale > 0 ? Math.round(profit * 1000.0 / sale) / 10.0 : null);
        return m;
    }

    public List<PricingData.Sale> sales(Optional<SessionPayload> session) {
        access.requireRole(session, StaffAccess.ADMINS);
        return data.sales();
    }

    public Map<String, Object> deleteSale(Optional<SessionPayload> session, String id) {
        access.requireRole(session, StaffAccess.ADMINS);
        data.deleteSale(id);
        knowledge.invalidate();
        return Map.of("success", true);
    }

    // ------------------------------------------------------------------------------------------------ repair costs

    public List<PricingData.RepairCost> repairCosts(Optional<SessionPayload> session, String category) {
        access.requireRole(session, StaffAccess.ADMINS);
        return data.repairCosts(category == null || category.isBlank() ? null : PartCatalog.normalize(category));
    }

    /**
     * Adds or replaces repair costs. Body: one row, or {@code {"rows": [...]}} (up to 2,000, e.g. a brand's official
     * spare-part list). A row: {@code category, part, cost, source} ("admin": what Fonzkart pays; "official": a brand's
     * list price) and optionally {@code brandId}, {@code modelId}, {@code sourceUrl}, {@code note}.
     */
    public Map<String, Object> saveRepairCosts(Optional<SessionPayload> session, JsonNode body) {
        access.requireRole(session, StaffAccess.ADMINS);
        List<JsonNode> rows = new ArrayList<>();
        if (body != null && body.has("rows") && body.get("rows").isArray()) {
            body.get("rows").forEach(rows::add);
        } else if (body != null && body.isObject()) {
            rows.add(body);
        }
        if (rows.isEmpty() || rows.size() > MAX_IMPORT) {
            throw bad("Send 1 to " + MAX_IMPORT + " repair costs.");
        }
        int n = 0;
        for (JsonNode r : rows) {
            String category = PartCatalog.normalize(text(r, "category"));
            String part = text(r, "part");
            String source = Optional.ofNullable(text(r, "source")).orElse(RepairCostEstimator.SOURCE_ADMIN);
            JsonNode cost = r.get("cost");
            if (part == null || !PartCatalog.LABELS.containsKey(part)) {
                throw bad("Unknown part " + part + " (row " + (n + 1) + ").");
            }
            if (!SOURCES.contains(source)) {
                throw bad("Source must be admin or official (row " + (n + 1) + ").");
            }
            if (cost == null || !cost.isNumber() || cost.asDouble() < 1 || cost.asDouble() > 500_000) {
                throw bad("Enter the cost in rupees (row " + (n + 1) + ").");
            }
            data.upsertRepairCost(category, text(r, "brandId"), text(r, "modelId"), part, Math.round(cost.asDouble()), source,
                    text(r, "sourceUrl"), text(r, "note"));
            n++;
        }
        return Map.of("success", true, "saved", n);
    }

    public Map<String, Object> deleteRepairCost(Optional<SessionPayload> session, String id) {
        access.requireRole(session, StaffAccess.ADMINS);
        data.deleteRepairCost(id);
        return Map.of("success", true);
    }

    /** The open suggestions (or the decided ones with {@code status}), most certain first. */
    public List<PricingData.Recommendation> recommendations(Optional<SessionPayload> session, String status) {
        access.requireRole(session, StaffAccess.ADMINS);
        return data.recommendations(status == null || status.isBlank() ? "open" : "all".equals(status) ? null : status, 300);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private Long count(String sql) {
        try {
            return jdbc.queryForObject(sql, Long.class);
        } catch (RuntimeException e) {
            return 0L;
        }
    }

    private JsonNode parse(String json) {
        try {
            return json == null ? mapper.createObjectNode() : mapper.readTree(json);
        } catch (Exception e) {
            return mapper.createObjectNode();
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node == null ? null : node.get(field);
        if (v == null || v.isNull() || !v.isValueNode()) {
            return null;
        }
        String s = v.asText().trim();
        return s.isEmpty() ? null : s;
    }

    private static long whole(JsonNode body, String field, String what) {
        JsonNode v = body.get(field);
        if (v == null || !v.isNumber() || v.asDouble() < 0 || v.asDouble() > 10_000_000) {
            throw bad("Enter " + what + " in rupees.");
        }
        return Math.round(v.asDouble());
    }

    private static ActionException bad(String message) {
        return new ActionException(HttpStatus.BAD_REQUEST, message);
    }

}
