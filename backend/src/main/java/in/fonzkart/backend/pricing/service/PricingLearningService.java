package in.fonzkart.backend.pricing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.catalog.dto.VariantWithModelDto;
import in.fonzkart.backend.order.rules.OrderStatus;
import in.fonzkart.backend.order.service.CustomerOrderService;
import in.fonzkart.backend.pricing.data.PricingData;
import in.fonzkart.backend.pricing.engine.CatalogChecks;
import in.fonzkart.backend.pricing.rules.MaxValueRule;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Makes the prices better from what actually happens, and tells the admin what it would change:
 * <ol>
 *   <li><b>Resales</b>: for each resold device, the most Fonzkart could have paid and still made its margin
 *       (resale × (1 − margin) − repairs − logistics) against what it did pay. Per model, the ratio says whether its max
 *       values are too high (margin lost) or too low (offers below what the device is worth: customers go elsewhere).</li>
 *   <li><b>Pickup checks</b>: the price approved at pickup against what the engine says for the answers the executive
 *       checked. When approvers keep moving a model's price the same way, its max value is off.</li>
 *   <li><b>Catalog checks</b> ({@link CatalogChecks}): prices that cannot be right.</li>
 * </ol>
 * Evidence is weighted by age (half after 180 days) and shrunk toward "no change" (credibility weighting), so a single
 * sale can never move a price much. Small, well-evidenced changes ({@link #AUTO_MAX_CHANGE}, confidence
 * {@link #AUTO_MIN_CONFIDENCE}) are applied by the engine itself when the "auto apply" setting is on; everything else
 * waits for an admin's tap. Every change is recorded.
 */
@Service
public class PricingLearningService {

    private static final Logger LOG = LoggerFactory.getLogger(PricingLearningService.class);
    public static final String LAST_RUN_KEY = "pricing.lastLearningRun";

    static final String KIND_MAX_VALUE = "max_value";
    static final String KIND_DATA_QUALITY = "data_quality";
    static final String KIND_MARGIN = "margin_alert";
    static final double AUTO_MAX_CHANGE = 0.05;
    static final double AUTO_MIN_CONFIDENCE = 0.6;
    /** A model's suggested change stays within ±15% per run. */
    static final double MAX_CHANGE = 0.15;
    static final double SALES_K = 3;
    static final double CHECK_WEIGHT = 0.5;

    public record RunResult(int recommendations, int autoApplied, int resolved, Map<String, Integer> byKind) {
    }

    private final PricingData data;
    private final PricingSettings settings;
    private final PricingService pricing;
    private final CustomerOrderService orders;
    private final MaxValueService maxValues;
    private final ModelReference references;
    private final StaffAccess access;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public PricingLearningService(PricingData data, PricingSettings settings, PricingService pricing,
                                  CustomerOrderService orders, MaxValueService maxValues, ModelReference references,
                                  StaffAccess access, JdbcTemplate jdbc, ObjectMapper mapper) {
        this.data = data;
        this.settings = settings;
        this.pricing = pricing;
        this.orders = orders;
        this.maxValues = maxValues;
        this.references = references;
        this.access = access;
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    // ------------------------------------------------------------------------------------------------ run

    public synchronized RunResult run() {
        LocalDateTime now = JsDates.nowUtc();
        List<String> keep = new ArrayList<>();
        Map<String, Integer> byKind = new LinkedHashMap<>();
        int auto = 0;

        // 1 + 2: resales and pickup checks → max value per model
        Map<String, List<double[]>> evidence = new HashMap<>(); // modelId → {ratio, weight, isSale}
        Map<String, String> modelNames = new HashMap<>();
        Map<String, List<Double>> marginsByCategory = new HashMap<>();
        double margin = settings.targetMarginPercent() / 100;
        double logistics = settings.logisticsCost();
        for (PricingData.Sale s : data.sales()) {
            if (s.purchasePrice() <= 0 || s.salePrice() <= 0) {
                continue;
            }
            double w = decay(s.soldAt(), now);
            double affordable = s.salePrice() * (1 - margin) - s.repairCost() - logistics;
            if (s.modelId() != null) {
                evidence.computeIfAbsent(s.modelId(), k -> new ArrayList<>()).add(new double[]{affordable / s.purchasePrice(), w, 1});
                modelNames.putIfAbsent(s.modelId(), deviceName(s.device()));
            }
            if (s.soldAt() != null && s.soldAt().isAfter(now.minusDays(90))) {
                marginsByCategory.computeIfAbsent(s.category() == null ? "other" : s.category(), k -> new ArrayList<>())
                        .add((s.salePrice() - s.purchasePrice() - s.repairCost() - logistics) / (double) s.salePrice());
            }
        }
        for (Map<String, Object> o : checkedOrders()) {
            try {
                Optional<double[]> ratio = checkRatio(o);
                if (ratio.isPresent()) {
                    String modelId = (String) o.get("_modelId");
                    evidence.computeIfAbsent(modelId, k -> new ArrayList<>())
                            .add(new double[]{ratio.get()[0], CHECK_WEIGHT * decay((LocalDateTime) o.get("_at"), now), 0});
                    modelNames.putIfAbsent(modelId, (String) o.get("_modelName"));
                }
            } catch (RuntimeException e) {
                LOG.debug("[pricing] order skipped in learning: {}", e.getMessage());
            }
        }
        for (Map.Entry<String, List<double[]>> e : evidence.entrySet()) {
            double sum = 0;
            double weight = 0;
            int sales = 0;
            int checks = 0;
            for (double[] x : e.getValue()) {
                double ratio = Math.max(0.5, Math.min(1.5, x[0]));
                sum += ratio * x[1];
                weight += x[1];
                if (x[2] == 1) {
                    sales++;
                } else {
                    checks++;
                }
            }
            double factor = (SALES_K + sum) / (SALES_K + weight);
            factor = Math.max(1 - MAX_CHANGE, Math.min(1 + MAX_CHANGE, factor));
            double confidence = round2(weight / (weight + SALES_K));
            String key = "model:" + e.getKey();
            if (Math.abs(factor - 1) < 0.03 || data.dismissedSince(KIND_MAX_VALUE, key, now.minusDays(30))) {
                continue;
            }
            String name = modelNames.getOrDefault(e.getKey(), "this model");
            int pct = (int) Math.round(Math.abs(factor - 1) * 100);
            String title = (factor < 1 ? "Lower " : "Raise ") + name + " max values by " + pct + "%";
            String detail = (factor < 1
                    ? "Fonzkart paid more for these than it could afford at its " + Math.round(margin * 100) + "% margin"
                    : "Fonzkart paid less for these than they were worth, so offers are below the market")
                    + " (" + evidenceText(sales, checks) + "). The change is spread over the model's variants.";
            ObjectNode ev = mapper.createObjectNode().put("modelId", e.getKey()).put("sales", sales).put("checks", checks)
                    .put("weight", round2(weight));
            String id = data.upsertOpen(KIND_MAX_VALUE, key, title, detail, 1.0, round4(factor), confidence, ev.toString());
            keep.add(id);
            byKind.merge(KIND_MAX_VALUE, 1, Integer::sum);
            if (settings.autoApply() && Math.abs(factor - 1) <= AUTO_MAX_CHANGE && confidence >= AUTO_MIN_CONFIDENCE) {
                try {
                    apply(data.recommendation(id).orElseThrow(), "engine", true);
                    keep.remove(id);
                    auto++;
                } catch (RuntimeException ex) {
                    LOG.warn("[pricing] auto-apply of {} failed: {}", id, ex.getMessage());
                }
            }
        }

        // margins
        for (Map.Entry<String, List<Double>> e : marginsByCategory.entrySet()) {
            if (e.getValue().size() < 3) {
                continue;
            }
            double avg = e.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0);
            String key = "category:" + e.getKey();
            if (avg >= margin / 2 || data.dismissedSince(KIND_MARGIN, key, now.minusDays(30))) {
                continue;
            }
            String id = data.upsertOpen(KIND_MARGIN, key, e.getKey() + " resales made " + Math.round(avg * 100) + "% in the last 90 days",
                    "Target " + Math.round(margin * 100) + "% on " + e.getValue().size() + " resales. The model suggestions above "
                            + "correct max values model by model; check repair costs and the lowest offer too.",
                    round4(avg), null, round2(Math.min(0.9, e.getValue().size() / (e.getValue().size() + 5.0))), null);
            keep.add(id);
            byKind.merge(KIND_MARGIN, 1, Integer::sum);
        }

        // 3: catalog checks
        for (CatalogChecks.Finding f : catalogFindings()) {
            if (data.dismissedSince(KIND_DATA_QUALITY, f.key(), now.minusDays(30))) {
                continue;
            }
            ObjectNode ev = mapper.createObjectNode().put("check", f.check());
            if (f.variantId() != null) {
                ev.put("variantId", f.variantId());
            }
            String id = data.upsertOpen(KIND_DATA_QUALITY, f.key(), f.title(), f.detail(),
                    f.current() == null ? null : f.current().doubleValue(), f.suggested() == null ? null : f.suggested().doubleValue(),
                    f.confidence(), ev.toString());
            keep.add(id);
            byKind.merge(KIND_DATA_QUALITY, 1, Integer::sum);
        }

        int resolved = data.resolveStale(List.of(KIND_MAX_VALUE, KIND_DATA_QUALITY, KIND_MARGIN), keep);
        data.putSetting(LAST_RUN_KEY, JsDates.toIsoString(now));
        LOG.info("[pricing] learning run: {} open suggestions, {} applied automatically, {} resolved", keep.size(), auto, resolved);
        return new RunResult(keep.size(), auto, resolved, byKind);
    }

    /** Run by an admin from the Admin app (administrators only). */
    public RunResult runNow(Optional<SessionPayload> session) {
        access.requireRole(session, StaffAccess.ADMINS);
        maxValues.revalueAll(YearMonth.now(ZoneId.of("Asia/Kolkata")));
        return run();
    }

    // ------------------------------------------------------------------------------------------------ decisions

    public Map<String, Object> decide(Optional<SessionPayload> session, String id, String action) {
        access.requireRole(session, StaffAccess.ADMINS);
        PricingData.Recommendation r = data.recommendation(id)
                .orElseThrow(() -> new ActionException(HttpStatus.NOT_FOUND, "Suggestion not found."));
        if (!"open".equals(r.status())) {
            throw new ActionException(HttpStatus.BAD_REQUEST, "This suggestion was already " + r.status() + ".");
        }
        String by = session.map(sp -> sp.user() == null ? null : sp.user().name()).orElse("admin");
        if ("dismiss".equals(action)) {
            data.decide(id, "dismissed", by, false);
            return Map.of("success", true, "status", "dismissed");
        }
        if (!"apply".equals(action)) {
            throw new ActionException(HttpStatus.BAD_REQUEST, "Apply or dismiss.");
        }
        int changed = apply(r, by, false);
        return Map.of("success", true, "status", "applied", "variantsChanged", changed);
    }

    /** Carries out a suggestion; returns the number of variants whose max value changed. */
    int apply(PricingData.Recommendation r, String by, boolean auto) {
        JsonNode ev = parse(r.evidence());
        YearMonth month = YearMonth.now(ZoneId.of("Asia/Kolkata"));
        int changed = 0;
        switch (r.kind()) {
            case KIND_MAX_VALUE -> {
                String modelId = ev.path("modelId").asText(null);
                double factor = r.suggestedValue() == null ? 1 : r.suggestedValue();
                if (modelId == null || factor <= 0) {
                    throw new ActionException(HttpStatus.BAD_REQUEST, "This suggestion cannot be applied.");
                }
                Map<String, PricingData.VariantPricing> pricingRows = data.allVariantPricing();
                for (PricingData.CatalogVariant v : data.catalogVariants()) {
                    if (!modelId.equals(v.modelId()) || v.basePrice() == null || v.basePrice() <= 0) {
                        continue;
                    }
                    PricingData.VariantPricing vp = pricingRows.get(v.variantId());
                    String reason = (auto ? "Applied automatically: " : "Suggestion applied: ") + r.title();
                    if (vp != null && vp.auto() && vp.hasLaunch()) {
                        double next = MaxValueService.clamp(vp.marketFactor() * factor, MaxValueService.MIN_FACTOR, MaxValueService.MAX_FACTOR);
                        data.setMarketFactor(v.variantId(), round4(next));
                        PricingData.VariantPricing updated = new PricingData.VariantPricing(vp.variantId(), vp.launchPrice(),
                                vp.launchMonth(), vp.mode(), next, vp.lastAutoAt());
                        long target = MaxValueService.target(v, updated, month);
                        if (target != v.basePrice()) {
                            data.setBasePrice(v.variantId(), v.basePrice(), (int) target, reason, by);
                            changed++;
                        }
                    } else {
                        long next = Math.round(v.basePrice() * factor / 100) * 100;
                        if (next != v.basePrice() && next > 0) {
                            data.setBasePrice(v.variantId(), v.basePrice(), (int) next, reason, by);
                            changed++;
                        }
                    }
                }
            }
            case KIND_DATA_QUALITY -> {
                String variantId = ev.path("variantId").asText(null);
                if (variantId == null || r.suggestedValue() == null) {
                    throw new ActionException(HttpStatus.BAD_REQUEST, "This one needs your judgement: fix it in the catalog, then dismiss it.");
                }
                PricingData.CatalogVariant v = data.catalogVariant(variantId)
                        .orElseThrow(() -> new ActionException(HttpStatus.NOT_FOUND, "That variant no longer exists."));
                boolean launchRule = "launch".equals(ev.path("check").asText());
                Optional<PricingData.VariantPricing> vp = data.variantPricing(variantId);
                if (launchRule && vp.isPresent() && vp.get().hasLaunch()) {
                    data.setMode(variantId, "auto"); // the rule's value, kept current from now on
                    data.markRevalued(variantId, JsDates.nowUtc());
                } else {
                    data.setMode(variantId, "manual");
                }
                int next = (int) Math.round(r.suggestedValue());
                if (!Integer.valueOf(next).equals(v.basePrice())) {
                    data.setBasePrice(variantId, v.basePrice(), next, "Suggestion applied: " + r.title(), by);
                    changed++;
                }
            }
            default -> throw new ActionException(HttpStatus.BAD_REQUEST, "This is a warning: nothing to apply. Dismiss it once handled.");
        }
        data.decide(r.id(), "applied", by, auto);
        return changed;
    }

    // ------------------------------------------------------------------------------------------------ evidence

    /** Picked-up and completed orders whose pickup check was recorded. */
    private List<Map<String, Object>> checkedOrders() {
        try {
            return jdbc.queryForList("SELECT id, device, price, answers, \"riderAnswers\", status, \"updatedAt\" FROM \"Order\" "
                    + "WHERE \"riderAnswers\" IS NOT NULL AND lower(status) IN (?, ?) ORDER BY \"updatedAt\" DESC LIMIT 2000",
                    OrderStatus.PICKED_UP, OrderStatus.COMPLETED);
        } catch (RuntimeException e) {
            return List.of();
        }
    }

    /**
     * approved price ÷ the engine's price for the answers the executive checked, for orders where a person changed the
     * price at pickup (an executive's revised price that was approved, or an approver's own price). Orders picked up at
     * the quoted price say nothing about the max value.
     */
    private Optional<double[]> checkRatio(Map<String, Object> o) {
        JsonNode answers = parse((String) o.get("answers"));
        JsonNode review = answers.path("priceReview");
        if (!"approved".equals(review.path("decision").asText())) {
            return Optional.empty();
        }
        String device = (String) o.get("device");
        int open = device == null ? -1 : device.lastIndexOf(" (");
        if (open <= 0 || !device.endsWith(")")) {
            return Optional.empty();
        }
        Optional<VariantWithModelDto> variant = orders.findDevice(device.substring(0, open), device.substring(open + 2, device.length() - 1));
        if (variant.isEmpty() || variant.get().model() == null) {
            return Optional.empty();
        }
        JsonNode checked = parse((String) o.get("riderAnswers")).path("answers");
        if (!checked.isObject()) {
            return Optional.empty();
        }
        ObjectNode merged = answers.deepCopy();
        merged.setAll((ObjectNode) checked);
        long engine = pricing.quote(variant.get(), merged).price();
        double approved = review.path("approvedPrice").asDouble(((Number) o.get("price")).doubleValue());
        if (engine <= 0 || approved <= 0) {
            return Optional.empty();
        }
        o.put("_modelId", variant.get().modelId());
        o.put("_modelName", variant.get().model().name());
        Object at = o.get("updatedAt");
        o.put("_at", at instanceof java.sql.Timestamp t ? t.toLocalDateTime() : JsDates.nowUtc());
        return Optional.of(new double[]{approved / engine});
    }

    private List<CatalogChecks.Finding> catalogFindings() {
        Map<String, PricingData.VariantPricing> pricingRows = data.allVariantPricing();
        Map<String, Map.Entry<Long, String>> modelLaunch = new HashMap<>();
        List<CatalogChecks.Item> items = new ArrayList<>();
        List<PricingData.CatalogVariant> variants = data.catalogVariants();
        for (PricingData.CatalogVariant v : variants) {
            PricingData.VariantPricing vp = pricingRows.get(v.variantId());
            if (vp != null && vp.hasLaunch()) {
                Map.Entry<Long, String> held = modelLaunch.get(v.modelId());
                if (held == null || vp.launchPrice() < held.getKey()) {
                    modelLaunch.put(v.modelId(), Map.entry((long) vp.launchPrice(), vp.launchMonth()));
                }
            }
        }
        for (PricingData.CatalogVariant v : variants) {
            PricingData.VariantPricing vp = pricingRows.get(v.variantId());
            Long launch = null;
            String month = null;
            boolean own = false;
            if (vp != null && vp.hasLaunch()) {
                launch = (long) vp.launchPrice();
                month = vp.launchMonth();
                own = !vp.auto(); // auto variants are at the rule's value already
            } else if (modelLaunch.containsKey(v.modelId())) {
                launch = modelLaunch.get(v.modelId()).getKey();
                month = modelLaunch.get(v.modelId()).getValue();
            } else {
                Optional<ModelReference.Ref> ref = references.find(v.brandId(), v.modelName());
                if (ref.isPresent()) {
                    launch = ref.get().launchPrice();
                    month = ref.get().launchMonth();
                }
            }
            items.add(new CatalogChecks.Item(v.variantId(), v.variantName(), v.basePrice(), v.modelId(), v.modelName(),
                    v.brandId(), categoryOf(v.category()), launch, month, own));
        }
        YearMonth now = YearMonth.now(ZoneId.of("Asia/Kolkata"));
        return CatalogChecks.run(items, (price, launched, category, brand) -> {
            try {
                return MaxValueRule.suggest(price, YearMonth.parse(launched), category, brand, now).maxValue();
            } catch (RuntimeException e) {
                return null;
            }
        });
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private static String evidenceText(int sales, int checks) {
        List<String> parts = new ArrayList<>();
        if (sales > 0) {
            parts.add(sales + (sales == 1 ? " resale" : " resales"));
        }
        if (checks > 0) {
            parts.add(checks + (checks == 1 ? " price changed at pickup" : " prices changed at pickup"));
        }
        return String.join(", ", parts);
    }

    private static String deviceName(String device) {
        if (device == null) {
            return "this model";
        }
        int open = device.lastIndexOf(" (");
        return open > 0 ? device.substring(0, open) : device;
    }

    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) {
            return mapper.createObjectNode();
        }
        try {
            JsonNode n = mapper.readTree(json);
            return n == null ? mapper.createObjectNode() : n;
        } catch (Exception e) {
            return mapper.createObjectNode();
        }
    }

    static double decay(LocalDateTime at, LocalDateTime now) {
        if (at == null) {
            return 1;
        }
        double days = Math.max(0, Duration.between(at, now).toHours() / 24.0);
        return Math.pow(0.5, days / 180);
    }

    static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }

    static double round4(double v) {
        return Math.round(v * 10000) / 10000.0;
    }

    /** The catalog's stored category as the checks group it. */
    static String categoryOf(String category) {
        return category == null ? "smartphone" : category.trim().toLowerCase(Locale.ROOT);
    }
}
