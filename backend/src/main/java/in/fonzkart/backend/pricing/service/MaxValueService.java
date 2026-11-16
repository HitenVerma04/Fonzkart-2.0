package in.fonzkart.backend.pricing.service;

import com.fasterxml.jackson.databind.JsonNode;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.pricing.data.PricingData;
import in.fonzkart.backend.pricing.rules.MaxValueRule;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Keeps max values current without anyone editing them. A variant is "auto" when its launch price and month are known
 * and no admin has set its price by hand: once a month its max value becomes
 * <pre>
 *   MaxValueRule(launch price, age) × market factor
 * </pre>
 * where the market factor (1 to start) is what Fonzkart's resales and price checks taught about this model (see
 * {@link PricingLearningService}). A month's change is at most {@link #MAX_STEP}, so a wrong input can never move a
 * price far, and every change is kept in the variant's history. An admin's own price ("manual") is never touched.
 */
@Service
public class MaxValueService {

    private static final Logger LOG = LoggerFactory.getLogger(MaxValueService.class);
    /** The most one revaluation moves a max value. */
    static final double MAX_STEP = 0.08;
    /** The market factor stays within this range of the rule. */
    public static final double MIN_FACTOR = 0.7;
    public static final double MAX_FACTOR = 1.3;

    public record Revaluation(int auto, int changed, List<String> examples) {
    }

    private final PricingData data;
    private final StaffAccess access;

    public MaxValueService(PricingData data, StaffAccess access) {
        this.data = data;
        this.access = access;
    }

    /** Revalues every auto variant not yet revalued this month. */
    public Revaluation revalueAll(YearMonth now) {
        Map<String, PricingData.VariantPricing> pricing = data.allVariantPricing();
        int auto = 0;
        int changed = 0;
        List<String> examples = new ArrayList<>();
        LocalDateTime at = JsDates.nowUtc();
        for (PricingData.CatalogVariant v : data.catalogVariants()) {
            PricingData.VariantPricing vp = pricing.get(v.variantId());
            if (vp == null || !vp.auto() || !vp.hasLaunch() || v.basePrice() == null) {
                continue;
            }
            auto++;
            if (vp.lastAutoAt() != null && YearMonth.from(vp.lastAutoAt()).equals(now)) {
                continue;
            }
            try {
                long next = step(v.basePrice(), target(v, vp, now));
                if (Math.abs(next - v.basePrice()) >= 100) {
                    data.setBasePrice(v.variantId(), v.basePrice(), (int) next, reason(v, vp, now), "engine");
                    changed++;
                    if (examples.size() < 10) {
                        examples.add(v.modelName() + " " + v.variantName() + ": ₹" + v.basePrice() + " → ₹" + next);
                    }
                }
                data.markRevalued(v.variantId(), at);
            } catch (RuntimeException e) {
                LOG.warn("[pricing] revaluation of {} skipped: {}", v.variantId(), e.getMessage());
            }
        }
        if (changed > 0) {
            LOG.info("[pricing] monthly revaluation: {} of {} auto variants changed", changed, auto);
        }
        return new Revaluation(auto, changed, examples);
    }

    /** What the rule says this variant is worth this month, with its market factor. */
    public static long target(PricingData.CatalogVariant v, PricingData.VariantPricing vp, YearMonth now) {
        long rule = MaxValueRule.suggest(vp.launchPrice(), YearMonth.parse(vp.launchMonth()), v.category(), v.brandId(), now).maxValue();
        double factor = clamp(vp.marketFactor() <= 0 ? 1 : vp.marketFactor(), MIN_FACTOR, MAX_FACTOR);
        return (long) (Math.floor(rule * factor / 100) * 100);
    }

    /** Moves from the current price toward the target by at most {@link #MAX_STEP}, in hundreds. */
    static long step(long current, long target) {
        double low = current * (1 - MAX_STEP);
        double high = current * (1 + MAX_STEP);
        double next = Math.max(low, Math.min(high, target));
        return (long) (Math.floor(next / 100) * 100);
    }

    private static String reason(PricingData.CatalogVariant v, PricingData.VariantPricing vp, YearMonth now) {
        long age = java.time.temporal.ChronoUnit.MONTHS.between(YearMonth.parse(vp.launchMonth()), now);
        String factor = Math.abs(vp.marketFactor() - 1) < 0.005 ? "" : String.format(Locale.ROOT, ", market ×%.2f", vp.marketFactor());
        return "Monthly revaluation: launched at ₹" + vp.launchPrice() + ", " + age + " months old" + factor;
    }

    /** A variant's max value explained: how it is kept, its launch data, what the rule says now, its history. */
    public Map<String, Object> explain(String variantId, YearMonth now) {
        PricingData.CatalogVariant v = data.catalogVariant(variantId)
                .orElseThrow(() -> new ActionException(HttpStatus.NOT_FOUND, "Variant not found."));
        Optional<PricingData.VariantPricing> vp = data.variantPricing(variantId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("variantId", v.variantId());
        m.put("device", v.modelName() + " (" + v.variantName() + ")");
        m.put("category", v.category());
        m.put("basePrice", v.basePrice());
        m.put("mode", vp.map(p -> p.hasLaunch() && p.auto() ? "auto" : "manual").orElse("manual"));
        m.put("launchPrice", vp.map(PricingData.VariantPricing::launchPrice).orElse(null));
        m.put("launchMonth", vp.map(PricingData.VariantPricing::launchMonth).orElse(null));
        m.put("marketFactor", vp.map(PricingData.VariantPricing::marketFactor).orElse(1.0));
        m.put("suggested", vp.filter(PricingData.VariantPricing::hasLaunch).map(p -> target(v, p, now)).orElse(null));
        m.put("history", data.history(variantId, 20));
        return m;
    }

    /**
     * Sets a variant's launch data and how its max value is kept (administrators only). Body {@code {launchPrice,
     * launchMonth: "YYYY-MM", mode: "auto" | "manual"}}; "auto" prices it from the rule at once.
     */
    public Map<String, Object> setLaunch(Optional<SessionPayload> session, String variantId, JsonNode body, YearMonth now) {
        access.requireRole(session, StaffAccess.ADMINS);
        PricingData.CatalogVariant v = data.catalogVariant(variantId)
                .orElseThrow(() -> new ActionException(HttpStatus.NOT_FOUND, "Variant not found."));
        JsonNode price = body == null ? null : body.get("launchPrice");
        JsonNode month = body == null ? null : body.get("launchMonth");
        if (price != null && !price.isNull()) {
            if (!price.isNumber() || price.asDouble() < 100 || price.asDouble() > 10_000_000) {
                throw new ActionException(HttpStatus.BAD_REQUEST, "Enter the launch price in rupees.");
            }
            String m = month == null ? "" : month.asText("").trim();
            try {
                YearMonth parsed = YearMonth.parse(m);
                if (parsed.isAfter(now)) {
                    throw new ActionException(HttpStatus.BAD_REQUEST, "The launch month cannot be in the future.");
                }
            } catch (DateTimeParseException e) {
                throw new ActionException(HttpStatus.BAD_REQUEST, "Enter the launch month as YYYY-MM, e.g. 2025-09.");
            }
            data.upsertLaunch(variantId, price.asInt(), m);
        }
        JsonNode mode = body == null ? null : body.get("mode");
        if (mode != null && !mode.isNull()) {
            String value = mode.asText("");
            if (!value.equals("auto") && !value.equals("manual")) {
                throw new ActionException(HttpStatus.BAD_REQUEST, "mode must be auto or manual.");
            }
            data.setMode(variantId, value);
            PricingData.VariantPricing vp = data.variantPricing(variantId).orElse(null);
            if (value.equals("auto") && vp != null && vp.hasLaunch() && v.basePrice() != null) {
                long target = target(v, vp, now);
                if (target != v.basePrice()) {
                    String actor = session.map(sp -> sp.user() == null ? null : sp.user().name()).orElse("admin");
                    data.setBasePrice(variantId, v.basePrice(), (int) target, "Set to automatic by an admin", actor);
                }
                data.markRevalued(variantId, JsDates.nowUtc());
            }
        }
        return explain(variantId, now);
    }

    /**
     * Records the launch data of every variant catalog/launch-prices.json lists (they were priced from it, so they are
     * auto). Idempotent: run on every start, it only fills in what is missing or changed.
     */
    public int syncLaunchFile(JsonNode file) {
        int n = 0;
        Map<String, PricingData.VariantPricing> pricing = data.allVariantPricing();
        Map<String, List<PricingData.CatalogVariant>> byModel = new LinkedHashMap<>();
        for (PricingData.CatalogVariant v : data.catalogVariants()) {
            byModel.computeIfAbsent(key(v.brandId(), v.category(), v.modelName()), k -> new ArrayList<>()).add(v);
        }
        for (JsonNode m : file.path("models")) {
            List<PricingData.CatalogVariant> variants = byModel.get(key(m.path("brandId").asText(), m.path("category").asText(), m.path("name").asText()));
            if (variants == null) {
                continue;
            }
            String month = m.path("launched").asText();
            for (JsonNode fv : m.path("variants")) {
                int launch = fv.path("launchPrice").asInt();
                for (PricingData.CatalogVariant v : variants) {
                    if (!v.variantName().equalsIgnoreCase(fv.path("name").asText())) {
                        continue;
                    }
                    PricingData.VariantPricing vp = pricing.get(v.variantId());
                    if (vp == null || vp.launchPrice() == null || vp.launchPrice() != launch || !month.equals(vp.launchMonth())) {
                        data.upsertLaunch(v.variantId(), launch, month);
                        n++;
                    }
                }
            }
        }
        return n;
    }

    /** Brand, category (watch and smartwatch alike, as the catalog reads them) and name, for matching the launch file. */
    private static String key(String brand, String category, String name) {
        String canonical = LaunchPriceImport.aliases(category).get(0);
        return (brand + "|" + canonical + "|" + (name == null ? "" : name.trim())).toLowerCase(Locale.ROOT);
    }

    static double clamp(double v, double low, double high) {
        return Math.max(low, Math.min(high, v));
    }
}
