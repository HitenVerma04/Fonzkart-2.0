package in.fonzkart.backend.pricing.engine;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * What a repair is expected to cost Fonzkart for one device, from every kind of evidence there is, weighted by how much
 * each can be trusted (credibility weighting, as insurers price risks with little data of their own):
 * <pre>
 *   estimate   = Σ strength × cost / Σ strength
 *   confidence = Σ strength / (Σ strength + 4)
 * </pre>
 * <ul>
 *   <li><b>Prices from a list</b> ({@code "RepairCost"} rows): an admin's own cost (strength 8), an official brand price
 *       list (6, at {@link #OFFICIAL_TO_COST} of the list price: those include the service centre's labour, margin and
 *       GST), Fonzkart's own repair price list (4, less its {@link #REPAIR_LIST_TO_COST} margin). A row for the model
 *       counts fully, one for the brand 60%, one for the whole category 40%.</li>
 *   <li><b>What Fonzkart paid</b> to repair devices it bought (recorded with each resale): for this model, strength 1
 *       per repair; for other models of the same kind and brand tier, 0.3 per repair, scaled by their launch price
 *       (so a Galaxy S24 display repair teaches something about a Galaxy S25's). Older repairs count less (half after
 *       180 days).</li>
 *   <li><b>The prior</b> ({@link PartCatalog.Ratio}): a share of the launch price read off official price lists (so,
 *       like them, at {@link #OFFICIAL_TO_COST}), 10% less for each year since launch (to 55% at most), strength 1.5, or 0.9 when the launch price itself is only estimated from the max value.</li>
 * </ul>
 * With no evidence at all (no launch price, no max value) there is no estimate: the answer then takes its category
 * share, as before, rather than an invented rupee figure.
 */
public final class RepairCostEstimator {

    public static final double OFFICIAL_TO_COST = 0.75;
    public static final double REPAIR_LIST_TO_COST = 0.75;
    static final double CREDIBILITY_K = 4;
    static final double YEARLY_PART_FACTOR = 0.9;
    static final double MIN_AGE_FACTOR = 0.55;
    static final double HALF_LIFE_DAYS = 180;

    public static final String SOURCE_ADMIN = "admin";
    public static final String SOURCE_OFFICIAL = "official";
    public static final String SOURCE_REPAIR_LIST = "fonzkart_repair";
    public static final String SOURCE_OBSERVED = "observed";
    public static final String SOURCE_PRIOR = "prior";

    /** A price from a list, for this model ({@code scope} "model"), its brand ("brand") or the category ("category"). */
    public record Listed(long cost, String source, String scope) {
    }

    /** A repair Fonzkart paid for: on this model, or on another one launched at {@code launchPrice}. */
    public record Paid(long cost, boolean sameModel, double launchPrice, LocalDateTime at) {
    }

    /**
     * One device to estimate for. {@code ageYears}: how long ago the model launched; parts for older models cost less
     * (third-party and pulled parts, older panels), so the prior falls 10% a year to at most {@link #MIN_AGE_FACTOR}.
     */
    public record Device(String category, String tier, boolean foldable, double referencePrice, boolean referenceIsLaunch,
                         double ageYears) {
        public Device(String category, String tier, boolean foldable, double referencePrice, boolean referenceIsLaunch) {
            this(category, tier, foldable, referencePrice, referenceIsLaunch, 0);
        }
    }

    /** The estimate: rupees, 0–1 confidence, the strongest kind of evidence and how many repairs it learnt from. */
    public record Estimate(long cost, double confidence, String source, int observations) {
    }

    private RepairCostEstimator() {
    }

    /** The estimate for one part, or null when nothing is known (no prior applies and no evidence was given). */
    public static Estimate estimate(String part, Device device, List<Listed> listed, List<Paid> paid, LocalDateTime now) {
        List<double[]> weighted = new ArrayList<>(); // {cost, strength}
        String best = null;
        double bestStrength = 0;

        PartCatalog.Ratio ratio = PartCatalog.ratio(device.category(), part, device.foldable());
        if (ratio != null && device.referencePrice() > 0) {
            double age = Math.max(MIN_AGE_FACTOR, Math.pow(YEARLY_PART_FACTOR, Math.max(0, device.ageYears())));
            // the ratios were read off official price lists, so like those they are taken at what Fonzkart pays
            double cost = clamp(device.referencePrice() * ratio.share(device.tier()) * age * OFFICIAL_TO_COST, ratio.min(), ratio.max());
            double s = device.referenceIsLaunch() ? 1.5 : 0.9;
            weighted.add(new double[]{cost, s});
            best = SOURCE_PRIOR;
            bestStrength = s;
        }
        for (Listed l : listed == null ? List.<Listed>of() : listed) {
            if (l.cost() <= 0) {
                continue;
            }
            double base = switch (l.source()) {
                case SOURCE_ADMIN -> 8;
                case SOURCE_OFFICIAL -> 6;
                case SOURCE_REPAIR_LIST -> 4;
                default -> 2;
            };
            double scope = switch (l.scope()) {
                case "model" -> 1;
                case "brand" -> 0.6;
                default -> 0.4;
            };
            double factor = switch (l.source()) {
                case SOURCE_OFFICIAL -> OFFICIAL_TO_COST;
                case SOURCE_REPAIR_LIST -> REPAIR_LIST_TO_COST;
                default -> 1;
            };
            double s = base * scope;
            weighted.add(new double[]{l.cost() * factor, s});
            if (s > bestStrength) {
                bestStrength = s;
                best = l.source();
            }
        }
        int observations = 0;
        double observedStrength = 0;
        for (Paid p : paid == null ? List.<Paid>of() : paid) {
            if (p.cost() <= 0) {
                continue;
            }
            double decay = decay(p.at(), now);
            if (p.sameModel()) {
                weighted.add(new double[]{p.cost(), decay});
                observedStrength += decay;
            } else if (p.launchPrice() > 0 && device.referencePrice() > 0) {
                double scaled = p.cost() * device.referencePrice() / p.launchPrice();
                if (ratio != null) {
                    scaled = clamp(scaled, ratio.min(), ratio.max());
                }
                weighted.add(new double[]{scaled, 0.3 * decay});
                observedStrength += 0.3 * decay;
            } else {
                continue;
            }
            observations++;
        }
        if (observedStrength > bestStrength) {
            best = SOURCE_OBSERVED;
        }
        if (weighted.isEmpty()) {
            return null;
        }
        double sum = 0;
        double strength = 0;
        for (double[] w : weighted) {
            sum += w[0] * w[1];
            strength += w[1];
        }
        long cost = Math.round(sum / strength / 10) * 10;
        double confidence = strength / (strength + CREDIBILITY_K);
        return new Estimate(Math.max(0, cost), Math.round(confidence * 100) / 100.0, best, observations);
    }

    /** 1 for a repair today, ½ after {@link #HALF_LIFE_DAYS}. */
    static double decay(LocalDateTime at, LocalDateTime now) {
        if (at == null || now == null) {
            return 1;
        }
        double days = Math.max(0, Duration.between(at, now).toHours() / 24.0);
        return Math.pow(0.5, days / HALF_LIFE_DAYS);
    }

    static double clamp(double v, double low, double high) {
        return Math.max(low, Math.min(high, v));
    }
}
