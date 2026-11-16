package in.fonzkart.backend.pricing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.pricing.data.PricingData;
import in.fonzkart.backend.pricing.engine.PartCatalog;
import in.fonzkart.backend.pricing.engine.RepairCostEstimator;
import in.fonzkart.backend.pricing.rules.MaxValueRule;
import in.fonzkart.backend.shared.time.JsDates;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * What Fonzkart's own resales have taught, kept in memory (rebuilt every {@link #TTL_MINUTES} minutes or when a sale is
 * recorded), so a quote never has to scan the sales:
 * <ul>
 *   <li>the repairs it paid for, per category ({@link RepairCostEstimator.Paid} evidence);</li>
 *   <li>what devices resold for, as a share of their max value, per model, per brand and category, and per category
 *       (normalised to a flawless device by the resale grade).</li>
 * </ul>
 */
@Component
public class PricingKnowledge {

    static final long TTL_MINUTES = 10;
    /** A resale in each grade, as a share of a flawless one. "parts" sales say nothing about resale value. */
    static final Map<String, Double> GRADE = Map.of("superb", 1.0, "good", 0.93, "fair", 0.84);

    /** A repair Fonzkart paid for. */
    public record PaidRepair(String part, long cost, String modelId, String tier, double launchPrice, LocalDateTime at) {
    }

    /** Resale values seen for a scope: flawless-equivalent resale ÷ max value, with when. */
    public record ResaleRatio(double ratio, LocalDateTime at) {
    }

    /** What resales say for one device. */
    public record Resale(double ratio, double confidence, int sales, String scope) {
    }

    private record Snapshot(LocalDateTime builtAt, Map<String, List<PaidRepair>> repairs,
                            Map<String, List<ResaleRatio>> resale, int sales) {
    }

    private final PricingData data;
    private final ObjectMapper mapper;
    private volatile Snapshot snapshot;

    public PricingKnowledge(PricingData data, ObjectMapper mapper) {
        this.data = data;
        this.mapper = mapper;
    }

    /** Forget the snapshot (a sale was recorded or removed). */
    public void invalidate() {
        snapshot = null;
    }

    /** The repairs paid for in a category, as evidence for one model (same model fully, others of its tier scaled). */
    public List<RepairCostEstimator.Paid> paid(String category, String part, String modelId, String tier) {
        List<RepairCostEstimator.Paid> out = new ArrayList<>();
        for (PaidRepair r : current().repairs().getOrDefault(PartCatalog.normalize(category), List.of())) {
            if (!r.part().equals(part)) {
                continue;
            }
            boolean same = modelId != null && modelId.equals(r.modelId());
            if (same || tier.equals(r.tier())) {
                out.add(new RepairCostEstimator.Paid(r.cost(), same, r.launchPrice(), r.at()));
            }
        }
        return out;
    }

    /**
     * The resale value of a device as a share of its max value: from this model's resales (2 or more), else its brand's
     * in the category (5 or more), else the category's (10 or more); null when resales do not show it yet.
     */
    public Resale resale(String category, String brandId, String modelId) {
        Map<String, List<ResaleRatio>> resale = current().resale();
        LocalDateTime now = JsDates.nowUtc();
        Resale model = summarise(resale.get("model:" + modelId), 2, 3, 1.0, "model", now);
        if (model != null) {
            return model;
        }
        String cat = PartCatalog.normalize(category);
        Resale brand = summarise(resale.get("brand:" + cat + ":" + brandId), 5, 5, 0.75, "brand", now);
        if (brand != null) {
            return brand;
        }
        return summarise(resale.get("category:" + cat), 10, 10, 0.6, "category", now);
    }

    public int salesCount() {
        return current().sales();
    }

    private static Resale summarise(List<ResaleRatio> list, int min, double k, double scale, String scope, LocalDateTime now) {
        if (list == null || list.size() < min) {
            return null;
        }
        double sum = 0;
        double weight = 0;
        for (ResaleRatio r : list) {
            double w = decay(r.at(), now);
            sum += r.ratio() * w;
            weight += w;
        }
        if (weight <= 0) {
            return null;
        }
        double confidence = scale * weight / (weight + k);
        return new Resale(sum / weight, Math.round(confidence * 100) / 100.0, list.size(), scope);
    }

    private static double decay(LocalDateTime at, LocalDateTime now) {
        if (at == null) {
            return 1;
        }
        double days = Math.max(0, java.time.Duration.between(at, now).toHours() / 24.0);
        return Math.pow(0.5, days / 180);
    }

    private Snapshot current() {
        Snapshot s = snapshot;
        if (s == null || s.builtAt().isBefore(JsDates.nowUtc().minusMinutes(TTL_MINUTES))) {
            s = build();
            snapshot = s;
        }
        return s;
    }

    private Snapshot build() {
        Map<String, PricingData.CatalogVariant> variants = new HashMap<>();
        Map<String, PricingData.CatalogVariant> anyOfModel = new HashMap<>();
        List<PricingData.Sale> sales = data.sales();
        if (!sales.isEmpty()) {
            for (PricingData.CatalogVariant v : data.catalogVariants()) {
                variants.put(v.variantId(), v);
                anyOfModel.putIfAbsent(v.modelId(), v);
            }
        }
        Map<String, PricingData.VariantPricing> pricing = sales.isEmpty() ? Map.of() : data.allVariantPricing();
        Map<String, List<PaidRepair>> repairs = new HashMap<>();
        Map<String, List<ResaleRatio>> resale = new HashMap<>();
        for (PricingData.Sale sale : sales) {
            PricingData.CatalogVariant v = sale.variantId() == null ? null : variants.get(sale.variantId());
            if (v == null && sale.modelId() != null) {
                v = anyOfModel.get(sale.modelId());
            }
            String category = PartCatalog.normalize(v != null ? v.category() : sale.category());
            String brand = v == null ? null : v.brandId();
            String modelId = sale.modelId() != null ? sale.modelId() : v == null ? null : v.modelId();
            String tier = MaxValueRule.tier(brand);
            PricingData.VariantPricing vp = v == null ? null : pricing.get(v.variantId());
            double launch = vp != null && vp.launchPrice() != null ? vp.launchPrice() : 0;

            for (JsonNode r : parse(sale.repairs())) {
                String part = r.path("part").asText("");
                long cost = r.path("cost").asLong(0);
                if (!part.isEmpty() && cost > 0) {
                    repairs.computeIfAbsent(category, k -> new ArrayList<>())
                            .add(new PaidRepair(part, cost, modelId, tier, launch, sale.soldAt()));
                }
            }
            Double grade = GRADE.get(sale.grade() == null ? "good" : sale.grade().toLowerCase(Locale.ROOT));
            Long base = sale.basePrice() != null ? sale.basePrice() : v == null || v.basePrice() == null ? null : v.basePrice().longValue();
            if (grade != null && base != null && base > 0 && sale.salePrice() > 0) {
                ResaleRatio ratio = new ResaleRatio(sale.salePrice() / grade / base, sale.soldAt());
                if (modelId != null) {
                    resale.computeIfAbsent("model:" + modelId, k -> new ArrayList<>()).add(ratio);
                }
                if (brand != null) {
                    resale.computeIfAbsent("brand:" + category + ":" + brand, k -> new ArrayList<>()).add(ratio);
                }
                resale.computeIfAbsent("category:" + category, k -> new ArrayList<>()).add(ratio);
            }
        }
        return new Snapshot(JsDates.nowUtc(), repairs, resale, sales.size());
    }

    private Iterable<JsonNode> parse(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            JsonNode node = mapper.readTree(json);
            return node.isArray() ? node : List.of();
        } catch (Exception e) {
            return List.of();
        }
    }
}
