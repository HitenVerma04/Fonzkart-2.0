package in.fonzkart.backend.pricing.service;

import in.fonzkart.backend.pricing.data.PricingData;
import in.fonzkart.backend.pricing.engine.PartCatalog;
import in.fonzkart.backend.pricing.engine.PriceSheet;
import in.fonzkart.backend.pricing.engine.RepairCostEstimator;
import in.fonzkart.backend.pricing.entity.EvaluationRule;
import in.fonzkart.backend.pricing.repository.EvaluationRuleRepository;
import in.fonzkart.backend.pricing.rules.MaxValueRule;
import in.fonzkart.backend.pricing.rules.PricingDefaults;
import in.fonzkart.backend.shared.time.JsDates;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Builds a device's {@link PriceSheet}: what every answer takes off its max value.
 * <ul>
 *   <li><b>Repairs</b> (cracked screen, dead camera, faulty port...) cost what that part costs for <i>this</i> model:
 *       {@link RepairCostEstimator} weighs an admin's cost, official brand price lists, Fonzkart's repair price list,
 *       what Fonzkart itself paid and the part's usual share of the model's launch price. The less certain the
 *       estimate, the more it is padded (up to {@link #UNCERTAINTY_BUFFER}), so a guess never costs Fonzkart money.</li>
 *   <li><b>Everything else</b> (scratches, age, missing box, bought abroad) takes a share of the max value: the admins'
 *       rule for that answer, or the built-in share.</li>
 *   <li>An admin's rule for a <i>repair</i> answer is the least it takes: the repair estimate takes more when the part
 *       costs more (an old 20% screen rule would otherwise make a ₹40,000 foldable display cost ₹9,000).</li>
 *   <li>When resales show what this model sells for, the sheet carries a profit guard (see {@link SheetPricer}).</li>
 * </ul>
 */
@Service
public class PriceSheetService {

    public static final String ENGINE_VERSION = "2026.11-v2";
    /** A repair estimate with no confidence at all is padded by this much (none at full confidence). */
    static final double UNCERTAINTY_BUFFER = 0.2;
    /** Fonzkart's repair list issues → parts. */
    static final Map<String, String> REPAIR_LIST_PARTS = Map.of("screen", PartCatalog.DISPLAY, "battery", PartCatalog.BATTERY,
            "charging", PartCatalog.CHARGING_PORT, "camera", PartCatalog.REAR_CAMERA, "speaker", PartCatalog.SPEAKER,
            "back", PartCatalog.BACK_PANEL);

    /** One device to price; variantId and model may be unknown (the website's old calculation by max value only). */
    public record Device(String variantId, long basePrice, String category, String brandId, String modelId, String modelName) {
    }

    /** The launch price repair costs are scaled by, and where it came from (variant, reference, estimated). */
    public record Reference(double price, String source, String launchMonth) {
    }

    private final PricingData data;
    private final EvaluationRuleRepository rules;
    private final PricingSettings settings;
    private final PricingKnowledge knowledge;
    private final ModelReference references;

    public PriceSheetService(PricingData data, EvaluationRuleRepository rules, PricingSettings settings,
                             PricingKnowledge knowledge, ModelReference references) {
        this.data = data;
        this.rules = rules;
        this.settings = settings;
        this.knowledge = knowledge;
        this.references = references;
    }

    public PriceSheet sheet(Device d) {
        String category = PartCatalog.normalize(d.category());
        String rulesCategory = d.category() == null || d.category().isBlank() ? "smartphone" : d.category();
        long max = Math.max(0, d.basePrice());
        String tier = MaxValueRule.tier(d.brandId());
        Optional<PricingData.VariantPricing> vp = d.variantId() == null ? Optional.empty() : data.variantPricing(d.variantId());
        Reference ref = reference(d, category);
        RepairCostEstimator.Device device = new RepairCostEstimator.Device(category, tier,
                PartCatalog.foldable(d.modelName()), ref.price(), !"estimated".equals(ref.source()), ageYears(ref));

        Map<String, List<RepairCostEstimator.Listed>> listed = listed(d, category);
        LocalDateTime now = JsDates.nowUtc();
        Map<String, Optional<RepairCostEstimator.Estimate>> estimates = new HashMap<>();

        Map<String, EvaluationRule> ruleByAnswer = new LinkedHashMap<>();
        for (EvaluationRule r : rules.findByCategoryUnordered(rulesCategory)) {
            if (r.getQuestionKey() != null && r.getAnswerKey() != null) {
                ruleByAnswer.put(r.getQuestionKey() + "=" + r.getAnswerKey(), r);
            }
        }
        Map<String, PricingDefaults.Question> builtIn = PricingDefaults.forCategory(rulesCategory);
        Set<String> answers = new LinkedHashSet<>();
        builtIn.forEach((q, question) -> question.answers().keySet().forEach(a -> answers.add(q + "=" + a)));
        answers.addAll(PartCatalog.uses(category).keySet());
        answers.addAll(ruleByAnswer.keySet());

        List<PriceSheet.Line> lines = new ArrayList<>();
        Map<String, Double> caps = new LinkedHashMap<>();
        builtIn.forEach((q, question) -> caps.put(q, question.capPercent() / 100));
        for (String qa : answers) {
            int at = qa.indexOf('=');
            String q = qa.substring(0, at);
            String a = qa.substring(at + 1);
            EvaluationRule rule = ruleByAnswer.get(qa);
            double ruleShare = rule == null || max <= 0 ? 0
                    : rule.getDeductionPercent() / 100 + rule.getDeductionAmount() / (double) max;
            PartCatalog.PartUse use = PartCatalog.use(category, q, a);
            RepairCostEstimator.Estimate estimate = use == null || max <= 0 ? null
                    : estimates.computeIfAbsent(use.part(), part -> Optional.ofNullable(RepairCostEstimator.estimate(part, device,
                    listed.getOrDefault(part, List.of()), knowledge.paid(category, part, d.modelId(), tier), now))).orElse(null);
            if (estimate != null) {
                double padded = estimate.cost() * use.severity() * (1 + UNCERTAINTY_BUFFER * (1 - estimate.confidence()));
                long cost = Math.min(max, Math.round(padded / 10) * 10);
                String source = estimate.source();
                double confidence = estimate.confidence();
                if (rule != null && ruleShare * max > cost) {
                    cost = Math.min(max, Math.round(clamp(ruleShare, 0, 0.9) * max / 10) * 10);
                    source = RepairCostEstimator.SOURCE_ADMIN;
                    confidence = Math.max(confidence, 0.7);
                }
                if (cost > 0) {
                    lines.add(new PriceSheet.Line(q, a, PriceSheet.REPAIR, 0, use.part(), cost, confidence, source));
                }
                continue;
            }
            if (rule != null) {
                if (ruleShare > 0) {
                    lines.add(new PriceSheet.Line(q, a, PriceSheet.VALUE, round4(clamp(ruleShare, 0, 0.9)), null, 0, 0.7, "admin"));
                }
                if (!caps.containsKey(q)) {
                    caps.put(q, a.equals("true") || a.equals("false") ? 0.9 : 0.6);
                }
                continue;
            }
            PricingDefaults.Question question = builtIn.get(q);
            Double percent = question == null ? null : question.answers().get(a);
            if (percent != null && percent > 0) {
                lines.add(new PriceSheet.Line(q, a, PriceSheet.VALUE, round4(percent / 100), null, 0, 0.5, "builtin"));
            }
        }

        long floor = (long) Math.floor(max * clamp(settings.minOfferPercent(), 0, 100) / 100);
        PartCatalog.Labour labour = PartCatalog.labour(category);
        PriceSheet.ProfitGuard guard = null;
        PricingKnowledge.Resale resale = knowledge.resale(category, d.brandId(), d.modelId());
        if (resale != null && resale.confidence() >= 0.4 && max > 0) {
            double resaleValue = resale.ratio() * max;
            guard = new PriceSheet.ProfitGuard(Math.round(resaleValue * (1 - settings.targetMarginPercent() / 100)),
                    Math.round(settings.logisticsCost()), resale.confidence(), resale.sales());
        }
        boolean auto = vp.map(v -> v.auto() && v.hasLaunch()).orElse(false);
        double confidence = max <= 0 ? 0 : auto ? 0.8 : 0.6;
        return new PriceSheet(ENGINE_VERSION, category, max, floor, labour.first(), labour.extra(), List.copyOf(lines),
                caps, guard, confidence, auto ? "auto" : "manual");
    }

    /**
     * The model's launch price for scaling repair costs: the lowest launch price of its variants (a display costs the
     * same on every storage size), else catalog/model-reference.json, else worked back from the max value (an
     * 18-month-old device of its kind, at most twice the max value), marked "estimated" so it counts for less.
     */
    public Reference reference(Device d, String category) {
        if (d.modelId() != null) {
            Optional<Map.Entry<Long, String>> launch = data.modelLaunch(d.modelId());
            if (launch.isPresent()) {
                return new Reference(launch.get().getKey(), "variant", launch.get().getValue());
            }
        }
        Optional<ModelReference.Ref> ref = references.find(d.brandId(), d.modelName());
        if (ref.isPresent()) {
            return new Reference(ref.get().launchPrice(), "reference", ref.get().launchMonth());
        }
        if (d.basePrice() <= 0) {
            return new Reference(0, "none", null);
        }
        YearMonth now = YearMonth.now(ZoneId.of("Asia/Kolkata"));
        // an 18-month-old device of its kind, but never more than twice its max value: inverting a steep depreciation
        // curve (laptops) would otherwise make a ₹42,000 laptop a ₹1.4 lakh one
        double kept = MaxValueRule.suggest(100000, now.minusMonths(18), category, d.brandId(), now).keptPercent() / 100;
        return new Reference(Math.min(2.0 * d.basePrice(), d.basePrice() / Math.max(0.08, kept)), "estimated", null);
    }

    /** Years since the model launched: from its launch month, 1.5 for a launch price worked back from the max value. */
    static double ageYears(Reference ref) {
        if ("estimated".equals(ref.source())) {
            return 1.5;
        }
        if (ref.launchMonth() == null) {
            return 0;
        }
        try {
            long months = java.time.temporal.ChronoUnit.MONTHS.between(YearMonth.parse(ref.launchMonth()), YearMonth.now(ZoneId.of("Asia/Kolkata")));
            return Math.max(0, months / 12.0);
        } catch (RuntimeException e) {
            return 0;
        }
    }

    /** List prices that apply to the model, by part: RepairCost rows and Fonzkart's own repair price list. */
    private Map<String, List<RepairCostEstimator.Listed>> listed(Device d, String category) {
        Map<String, List<RepairCostEstimator.Listed>> byPart = new HashMap<>();
        for (PricingData.RepairCost r : data.repairCostsFor(category, d.brandId(), d.modelId())) {
            byPart.computeIfAbsent(r.part(), k -> new ArrayList<>())
                    .add(new RepairCostEstimator.Listed(r.cost(), r.source(), r.scope()));
        }
        if ("smartphone".equals(category) && d.brandId() != null && d.modelName() != null) {
            String brandName = data.brandName(d.brandId()).orElse(d.brandId());
            for (PricingData.RepairListPrice p : data.repairList(brandName, d.modelName())) {
                String part = REPAIR_LIST_PARTS.get(p.issue());
                if (part != null) {
                    byPart.computeIfAbsent(part, k -> new ArrayList<>())
                            .add(new RepairCostEstimator.Listed(p.price(), RepairCostEstimator.SOURCE_REPAIR_LIST, "model"));
                }
            }
        }
        return byPart;
    }

    static double clamp(double v, double low, double high) {
        return Double.isNaN(v) ? low : Math.max(low, Math.min(high, v));
    }

    static double round4(double v) {
        return Math.round(v * 10000) / 10000.0;
    }
}
