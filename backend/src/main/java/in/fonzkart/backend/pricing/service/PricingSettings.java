package in.fonzkart.backend.pricing.service;

import in.fonzkart.backend.pricing.data.PricingData;
import in.fonzkart.backend.pricing.rules.PriceCalculator;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * The few pricing numbers an admin may set ("AppSetting"), each with a safe default so nothing has to be set:
 * <ul>
 *   <li>{@code pricing.minOfferPercent}: the lowest offer, percent of the max value (15).</li>
 *   <li>{@code pricing.targetMarginPercent}: the margin Fonzkart wants on a resale, percent of the resale price (12).</li>
 *   <li>{@code pricing.logisticsCost}: what one pickup, check and hand-over costs, rupees (250).</li>
 *   <li>{@code pricing.autoApply}: whether the engine may make small, well-evidenced changes itself ("true").</li>
 * </ul>
 */
@Component
public class PricingSettings {

    public static final String MIN_OFFER = "pricing.minOfferPercent";
    public static final String TARGET_MARGIN = "pricing.targetMarginPercent";
    public static final String LOGISTICS = "pricing.logisticsCost";
    public static final String AUTO_APPLY = "pricing.autoApply";

    public static final double DEFAULT_TARGET_MARGIN = 12;
    public static final double DEFAULT_LOGISTICS = 250;

    /** Allowed range of each number. */
    static final Map<String, double[]> RANGES = Map.of(
            MIN_OFFER, new double[]{0, 90},
            TARGET_MARGIN, new double[]{0, 60},
            LOGISTICS, new double[]{0, 5000});

    private final PricingData data;

    public PricingSettings(PricingData data) {
        this.data = data;
    }

    public double minOfferPercent() {
        return number(MIN_OFFER, PriceCalculator.DEFAULT_MIN_OFFER_PERCENT);
    }

    public double targetMarginPercent() {
        return number(TARGET_MARGIN, DEFAULT_TARGET_MARGIN);
    }

    public double logisticsCost() {
        return number(LOGISTICS, DEFAULT_LOGISTICS);
    }

    public boolean autoApply() {
        return !"false".equals(data.setting(AUTO_APPLY).orElse("true"));
    }

    public Map<String, Object> all() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("minOfferPercent", minOfferPercent());
        m.put("targetMarginPercent", targetMarginPercent());
        m.put("logisticsCost", logisticsCost());
        m.put("autoApply", autoApply());
        return m;
    }

    private double number(String key, double fallback) {
        String raw = data.setting(key).orElse(null);
        if (raw == null) {
            return fallback;
        }
        try {
            double v = Double.parseDouble(raw);
            double[] range = RANGES.get(key);
            return Double.isFinite(v) && v >= range[0] && v <= range[1] ? v : fallback;
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
