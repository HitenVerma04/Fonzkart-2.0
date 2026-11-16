package in.fonzkart.backend.pricing.rules;

import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * A variant's max value (its base price: what a flawless device gets) worked out from its launch price in India and
 * its age, so that newer models are worth more than older ones, bigger storage more than smaller, cellular more than
 * WiFi only, and every max value comes down a little as the model gets older.
 * <pre>
 *   max value = launch price × kept share, rounded down to ₹100
 *   kept share = start × yearly ^ (age in months / 12), never below 8%
 * </pre>
 * {@code start} is what a nearly new device keeps (the price a reseller can pay after its margin and the
 * refurbishing), {@code yearly} what it keeps of that each further year. Both depend on the kind of device and the
 * brand: iPhones keep their value best, then Samsung, Google and OnePlus, then the other brands. The numbers were
 * matched to the catalog's own prices where those are consistent (iPhone 13 to 17, Galaxy S25 / S26, Pixel 9 / 10,
 * MacBook Air 2025, AirPods).
 */
public final class MaxValueRule {

    /** What a nearly new device keeps of its launch price, and what it keeps of that each further year. */
    public record Curve(double start, double yearly) {
    }

    /** The suggested max value, with how it was reached. */
    public record Suggestion(long maxValue, int ageMonths, double keptPercent, String tier) {
    }

    public static final String APPLE = "apple";
    public static final String PREMIUM = "premium";
    public static final String STANDARD = "standard";

    /** Brands whose Android devices keep their value better than the rest. */
    static final Set<String> PREMIUM_BRANDS = Set.of("samsung", "google", "oneplus");
    /** No device is valued below this share of its launch price by the rule. */
    static final double FLOOR = 0.08;

    private static final Map<String, Map<String, Curve>> CURVES = Map.of(
            "smartphone", Map.of(APPLE, new Curve(0.78, 0.86), PREMIUM, new Curve(0.72, 0.82), STANDARD, new Curve(0.65, 0.78)),
            "tablet", Map.of(APPLE, new Curve(0.75, 0.85), PREMIUM, new Curve(0.65, 0.80), STANDARD, new Curve(0.58, 0.76)),
            "watch", Map.of(APPLE, new Curve(0.62, 0.78), PREMIUM, new Curve(0.52, 0.74), STANDARD, new Curve(0.45, 0.70)),
            "earbuds", Map.of(APPLE, new Curve(0.58, 0.85), PREMIUM, new Curve(0.52, 0.82), STANDARD, new Curve(0.45, 0.78)),
            "laptop", Map.of(APPLE, new Curve(0.72, 0.85), PREMIUM, new Curve(0.58, 0.78), STANDARD, new Curve(0.52, 0.75)),
            "desktop", Map.of(APPLE, new Curve(0.68, 0.84), PREMIUM, new Curve(0.50, 0.75), STANDARD, new Curve(0.50, 0.75)),
            "console", Map.of(APPLE, new Curve(0.70, 0.86), PREMIUM, new Curve(0.70, 0.86), STANDARD, new Curve(0.70, 0.86)),
            "camera", Map.of(APPLE, new Curve(0.65, 0.88), PREMIUM, new Curve(0.65, 0.88), STANDARD, new Curve(0.65, 0.88)),
            "tv", Map.of(APPLE, new Curve(0.45, 0.75), PREMIUM, new Curve(0.45, 0.75), STANDARD, new Curve(0.45, 0.75)));
    private static final Curve OTHER = new Curve(0.50, 0.75);

    private MaxValueRule() {
    }

    /**
     * The max value for a variant launched at {@code launchPrice} in {@code launched}, as of {@code now}.
     *
     * @param category the catalog category (smartphone, tablet, watch, earbuds, laptop, desktop, console, camera, tv)
     * @param brandId  the catalog brand id ("apple", "samsung", ...)
     */
    public static Suggestion suggest(double launchPrice, YearMonth launched, String category, String brandId, YearMonth now) {
        int age = Math.max(0, (int) ChronoUnit.MONTHS.between(launched, now));
        String tier = tier(brandId);
        Curve curve = curve(category, tier);
        double kept = Math.max(FLOOR, curve.start() * Math.pow(curve.yearly(), age / 12.0));
        long value = launchPrice > 0 ? (long) (Math.floor(launchPrice * kept / 100) * 100) : 0;
        return new Suggestion(value, age, Math.round(kept * 1000) / 10.0, tier);
    }

    /** apple, premium (Samsung, Google, OnePlus) or standard. */
    public static String tier(String brandId) {
        String brand = brandId == null ? "" : brandId.trim().toLowerCase(Locale.ROOT);
        if (brand.equals(APPLE)) {
            return APPLE;
        }
        return PREMIUM_BRANDS.contains(brand) ? PREMIUM : STANDARD;
    }

    static Curve curve(String category, String tier) {
        String c = category == null ? "" : category.trim().toLowerCase(Locale.ROOT);
        c = switch (c) {
            case "mobile", "" -> "smartphone";
            case "ipad" -> "tablet";
            case "smartwatch" -> "watch";
            case "smarttv" -> "tv";
            default -> c;
        };
        Map<String, Curve> byTier = CURVES.get(c);
        return byTier == null ? OTHER : byTier.get(tier);
    }
}
