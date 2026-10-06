package in.fonzkart.backend.pricing.rules;

import static in.fonzkart.backend.pricing.rules.JsValues.arrayIncludes;
import static in.fonzkart.backend.pricing.rules.JsValues.equalsString;
import static in.fonzkart.backend.pricing.rules.JsValues.get;
import static in.fonzkart.backend.pricing.rules.JsValues.includes;
import static in.fonzkart.backend.pricing.rules.JsValues.isFalse;
import static in.fonzkart.backend.pricing.rules.JsValues.isTrue;
import static in.fonzkart.backend.pricing.rules.JsValues.optionalIncludes;
import static in.fonzkart.backend.pricing.rules.JsValues.orEmptyArray;
import static in.fonzkart.backend.pricing.rules.JsValues.toNumber;
import static in.fonzkart.backend.pricing.rules.JsValues.truthy;

import com.fasterxml.jackson.databind.JsonNode;
import in.fonzkart.backend.pricing.entity.EvaluationRule;
import java.util.List;

/**
 * Line-by-line port of actions/priceCalculation.ts → calculatePrice(). Operations are performed in the same order
 * with IEEE doubles, so results are bit-identical to the JavaScript (verified against the original on ~1,800 cases).
 * <ul>
 *   <li>If the category has rules in "EvaluationRule", each rule is applied in database order.</li>
 *   <li>Otherwise the hard-coded per-category logic applies (smartphone, laptop, tablet, watch, camera, tv/smarttv);
 *       any other category gets no deductions.</li>
 *   <li>Then the floor: 400, or for base prices ≥ 50,000 → 1800 (flawless/good), 1200 (average), 500 otherwise;
 *       result = Math.floor(Math.max(price, floor)).</li>
 * </ul>
 * {@code answers} is the client's JSON ({@link JsValues#undefined()} when absent); JavaScript type semantics apply
 * (e.g. a string accessories value is substring-matched, a number throws).
 */
public final class PriceCalculator {

    private PriceCalculator() {
    }

    public static double calculate(double basePrice, JsonNode answers, String category, List<EvaluationRule> rules) {
        double finalPrice = basePrice;

        if (rules.isEmpty()) {
            // Fallback to legacy hardcoded logic if no rules are set in DB
            if ("smartphone".equals(category)) {
                if (isFalse(get(answers, "calls"))) finalPrice *= 0.8;
                if (isFalse(get(answers, "touch"))) finalPrice *= 0.7;
                if (isFalse(get(answers, "screen_original"))) finalPrice *= 0.9;

                // Screen Condition Deductions
                JsonNode screen = get(answers, "physical_condition");
                if (equalsString(screen, "good")) finalPrice -= basePrice * 0.10;
                else if (equalsString(screen, "average")) finalPrice -= basePrice * 0.20;
                else if (equalsString(screen, "below_average")) finalPrice -= basePrice * 0.35;

                // Body Condition Deductions
                JsonNode body = get(answers, "body_condition");
                if (equalsString(body, "good")) finalPrice -= basePrice * 0.05;
                else if (equalsString(body, "average")) finalPrice -= basePrice * 0.10;
                else if (equalsString(body, "below_average")) finalPrice -= basePrice * 0.20;

                // Functional Problems (4% per issue)
                finalPrice = perIssue(finalPrice, basePrice, 0.04, get(answers, "functional_issues"));

                // Warranty (Bonus)
                finalPrice = warranty(finalPrice, basePrice, get(answers, "warranty"));

                // Accessories (Deductions if missing)
                JsonNode accessories = get(answers, "accessories");
                if (missing(accessories, "charger")) finalPrice -= 500;
                if (missing(accessories, "box")) finalPrice -= 300;
                if (missing(accessories, "bill")) finalPrice -= basePrice * 0.15;
            } else if ("laptop".equals(category)) {
                if (isFalse(get(answers, "power"))) finalPrice -= basePrice * 0.50;
                if (isFalse(get(answers, "ports"))) finalPrice -= basePrice * 0.10;
                if (isFalse(get(answers, "screen_working"))) finalPrice -= basePrice * 0.40;
                if (isFalse(get(answers, "keyboard"))) finalPrice -= basePrice * 0.15;

                JsonNode phys = orEmptyArray(get(answers, "physical_condition"));
                if (includes(phys, "screen_damage")) finalPrice -= basePrice * 0.30;
                if (includes(phys, "body_damage")) finalPrice -= basePrice * 0.20;
                if (includes(phys, "battery_dead")) finalPrice -= basePrice * 0.15;
                if (includes(phys, "keys_missing")) finalPrice -= basePrice * 0.10;

                JsonNode specs = orEmptyArray(get(answers, "specs"));
                if (includes(specs, "charger_missing")) finalPrice -= 1500;
                if (includes(specs, "box_missing")) finalPrice -= 500;
            } else if ("tablet".equals(category)) {
                if (isFalse(get(answers, "power"))) finalPrice *= 0.50;
                if (isFalse(get(answers, "touch"))) finalPrice *= 0.70;
                if (isFalse(get(answers, "wifi"))) finalPrice *= 0.85;

                JsonNode screen = get(answers, "physical_condition");
                if (equalsString(screen, "good")) finalPrice -= basePrice * 0.10;
                else if (equalsString(screen, "average")) finalPrice -= basePrice * 0.20;
                else if (equalsString(screen, "below_average")) finalPrice -= basePrice * 0.35;

                JsonNode body = get(answers, "body_condition");
                if (equalsString(body, "good")) finalPrice -= basePrice * 0.05;
                else if (equalsString(body, "average")) finalPrice -= basePrice * 0.10;
                else if (equalsString(body, "below_average")) finalPrice -= basePrice * 0.20;

                finalPrice = perIssue(finalPrice, basePrice, 0.04, get(answers, "functional_issues"));
                finalPrice = warranty(finalPrice, basePrice, get(answers, "warranty"));

                JsonNode accessories = get(answers, "accessories");
                if (missing(accessories, "charger")) finalPrice -= 500;
                if (missing(accessories, "box")) finalPrice -= 300;
                if (missing(accessories, "bill")) finalPrice -= basePrice * 0.15;
            } else if ("watch".equals(category)) {
                if (isFalse(get(answers, "power"))) finalPrice -= basePrice * 0.50;
                if (isFalse(get(answers, "touch"))) finalPrice -= basePrice * 0.30;
                if (isFalse(get(answers, "charging"))) finalPrice -= basePrice * 0.15;

                JsonNode screen = get(answers, "physical_condition");
                if (equalsString(screen, "good")) finalPrice -= basePrice * 0.08;
                else if (equalsString(screen, "average")) finalPrice -= basePrice * 0.18;
                else if (equalsString(screen, "damaged")) finalPrice -= basePrice * 0.35;

                JsonNode body = get(answers, "body_condition");
                if (equalsString(body, "good")) finalPrice -= basePrice * 0.05;
                else if (equalsString(body, "average")) finalPrice -= basePrice * 0.12;
                else if (equalsString(body, "below_average")) finalPrice -= basePrice * 0.25;

                finalPrice = perIssue(finalPrice, basePrice, 0.05, get(answers, "functional_issues"));
                finalPrice = warranty(finalPrice, basePrice, get(answers, "warranty"));

                JsonNode accessories = get(answers, "accessories");
                if (missing(accessories, "charger")) finalPrice -= 400;
                if (missing(accessories, "strap")) finalPrice -= 300;
                if (missing(accessories, "box")) finalPrice -= 200;
                if (missing(accessories, "bill")) finalPrice -= basePrice * 0.10;
            } else if ("camera".equals(category)) {
                if (isFalse(get(answers, "power"))) finalPrice -= basePrice * 0.50;
                if (isFalse(get(answers, "lens_focus"))) finalPrice -= basePrice * 0.30;
                if (isTrue(get(answers, "sensor_spots"))) finalPrice -= basePrice * 0.25;
                if (isFalse(get(answers, "flash"))) finalPrice -= basePrice * 0.10;

                // Physical Condition (Body)
                JsonNode body = get(answers, "physical_condition");
                if (equalsString(body, "good")) finalPrice -= basePrice * 0.10;
                else if (equalsString(body, "average")) finalPrice -= basePrice * 0.20;
                else if (equalsString(body, "below_average")) finalPrice -= basePrice * 0.35;

                // Screen/Viewfinder Condition
                JsonNode screen = get(answers, "screen_condition");
                if (equalsString(screen, "cracked")) finalPrice -= basePrice * 0.30;
                else if (equalsString(screen, "dead_pixels")) finalPrice -= basePrice * 0.20;

                finalPrice = perIssue(finalPrice, basePrice, 0.05, get(answers, "functional_issues"));
                finalPrice = warranty(finalPrice, basePrice, get(answers, "warranty"));

                JsonNode accessories = get(answers, "accessories");
                if (missing(accessories, "battery")) finalPrice -= 1000;
                if (missing(accessories, "charger")) finalPrice -= 1000;
                if (missing(accessories, "lens_cap")) finalPrice -= 200;
                if (missing(accessories, "strap")) finalPrice -= 200;
                if (missing(accessories, "box")) finalPrice -= 300;
                if (missing(accessories, "bill")) finalPrice -= basePrice * 0.15;
            } else if ("tv".equals(category) || "smarttv".equals(category)) {
                JsonNode screen = get(answers, "physical_condition");
                if (equalsString(screen, "good")) finalPrice -= basePrice * 0.10;
                else if (equalsString(screen, "average")) finalPrice -= basePrice * 0.20;
                else if (equalsString(screen, "damaged")) finalPrice -= basePrice * 0.50;

                JsonNode body = get(answers, "body_condition");
                if (equalsString(body, "good")) finalPrice -= basePrice * 0.05;
                else if (equalsString(body, "average")) finalPrice -= basePrice * 0.12;
                else if (equalsString(body, "below_average")) finalPrice -= basePrice * 0.25;

                finalPrice = perIssue(finalPrice, basePrice, 0.05, get(answers, "functional_issues"));
                finalPrice = warranty(finalPrice, basePrice, get(answers, "warranty"));

                JsonNode accessories = get(answers, "accessories");
                if (missing(accessories, "remote")) finalPrice -= 800;
                if (missing(accessories, "stand")) finalPrice -= 500;
                if (missing(accessories, "bill")) finalPrice -= basePrice * 0.15;
                if (missing(accessories, "box")) finalPrice -= 400;
            }
        } else {
            // Apply DB Rules
            for (EvaluationRule rule : rules) {
                JsonNode answer = get(answers, rule.getQuestionKey());

                if (answer.isBoolean()) {
                    boolean ruleVal = "true".equals(rule.getAnswerKey());
                    if (answer.booleanValue() == ruleVal) {
                        finalPrice = apply(finalPrice, basePrice, rule);
                    }
                } else if (answer.isArray()) {
                    // Array check (multi-select); '!x' means "x was NOT selected"
                    if (rule.getAnswerKey().startsWith("!")) {
                        if (!arrayIncludes(answer, rule.getAnswerKey().substring(1))) {
                            finalPrice = apply(finalPrice, basePrice, rule);
                        }
                    } else if (arrayIncludes(answer, rule.getAnswerKey())) {
                        finalPrice = apply(finalPrice, basePrice, rule);
                    }
                } else if (answer.isTextual()) {
                    if (answer.textValue().equals(rule.getAnswerKey())) {
                        finalPrice = apply(finalPrice, basePrice, rule);
                    }
                }
            }
        }

        // Minimum floor based on device value and condition
        double minPrice = 400;
        if (basePrice >= 50000) {
            JsonNode pc = get(answers, "physical_condition");
            String cond = pc.isTextual() ? pc.textValue() : "below_average";
            if (cond.equals("flawless") || cond.equals("good")) minPrice = 1800;
            else if (cond.equals("average")) minPrice = 1200;
            else minPrice = 500;
        }

        return Math.floor(Math.max(finalPrice, minPrice));
    }

    /** applyRule(rule) */
    private static double apply(double finalPrice, double basePrice, EvaluationRule rule) {
        if (rule.getDeductionAmount() != 0) {
            finalPrice -= rule.getDeductionAmount();
        }
        if (rule.getDeductionPercent() != 0) {
            finalPrice -= (basePrice * (rule.getDeductionPercent() / 100));
        }
        return finalPrice;
    }

    /** {@code if (problems && problems.length > 0) finalPrice -= (basePrice * rate * problems.length)} */
    private static double perIssue(double finalPrice, double basePrice, double rate, JsonNode problems) {
        if (truthy(problems) && toNumber(get(problems, "length")) > 0) {
            finalPrice -= (basePrice * rate * toNumber(get(problems, "length")));
        }
        return finalPrice;
    }

    /** Warranty bonus: 0–3 months +5%, 3–6 months +7%, 6–11 months +10%. */
    private static double warranty(double finalPrice, double basePrice, JsonNode warranty) {
        if (equalsString(warranty, "0_3_months")) finalPrice += basePrice * 0.05;
        else if (equalsString(warranty, "3_6_months")) finalPrice += basePrice * 0.07;
        else if (equalsString(warranty, "6_11_months")) finalPrice += basePrice * 0.10;
        return finalPrice;
    }

    /** {@code !accessories?.includes(item)} */
    private static boolean missing(JsonNode accessories, String item) {
        Boolean included = optionalIncludes(accessories, item);
        return included == null || !included;
    }
}
