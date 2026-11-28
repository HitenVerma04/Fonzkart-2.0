package in.fonzkart.backend.pricing.rules;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.TextNode;
import in.fonzkart.backend.pricing.entity.EvaluationRule;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The offer for a device, worked out like Cashify's: the variant's base price is the max value (flawless, everything
 * working, newest, bought in India, with box and bill) and an answer can only take something off it.
 * <ol>
 *   <li>Each answer takes a share of the max value: the admin's pricing rule for that answer when there is one (its
 *       percent, plus its ₹ amount as a share of the max value), otherwise the built-in share
 *       ({@link PricingDefaults}). A share is between 0 and 90%, so no rule can raise the price.</li>
 *   <li>Answers to the same question that apply together (several functional problems, several missing accessories)
 *       overlap instead of adding up: two 10% problems take 19%, not 20%. A question takes at most its cap (functional
 *       problems on a phone: 50%).</li>
 *   <li>Questions multiply: each takes its share of what the others left, so the price can never reach zero. A 30%
 *       screen and an 18% body leave 70% × 82% = 57.4% of the max value, not 100% − 48% = 52%.</li>
 *   <li>The offer never drops below the lowest offer (a percent of the max value that admins set, 15% until they do)
 *       and never goes above the max value. It is rounded down to ₹10.</li>
 * </ol>
 * Before this, deductions were subtracted one by one from the full price with a fixed ₹400–1,800 floor, a warranty
 * answer added up to 10% on top (offers above the max value), and once any rule was saved for a category, every
 * answer without a rule stopped counting.
 */
public final class PriceCalculator {

    /** The lowest offer, in percent of the max value, until the admins set one. */
    public static final double DEFAULT_MIN_OFFER_PERCENT = 15;
    /** The most a single answer can take. */
    static final double MAX_ANSWER_SHARE = 0.9;
    /** The most a several-choice question without a built-in cap can take (a question only an admin priced). */
    static final double OPEN_MULTI_CAP = 0.6;
    /** The device age question; left unanswered it counts as over 11 months or out of warranty (answer "no"). */
    static final String DEVICE_AGE = "warranty";
    static final String OUT_OF_WARRANTY = "no";

    private PriceCalculator() {
    }

    /**
     * The offer in rupees (a whole number of tens; the max value itself when nothing is taken off).
     *
     * @param basePrice       the variant's max value; 0 when it is not a positive number
     * @param answers         the questionnaire answers (option id, list of option ids, or true / false per question)
     * @param category        the sell category, for the built-in shares
     * @param rules           the admins' pricing rules of that category
     * @param minOfferPercent the lowest offer, in percent of the max value
     */
    public static double calculate(double basePrice, JsonNode answers, String category, List<EvaluationRule> rules,
                                   double minOfferPercent) {
        if (!(basePrice > 0) || Double.isInfinite(basePrice)) {
            return 0;
        }
        double max = Math.floor(basePrice);
        double kept = keptShare(basePrice, answers, category, rules);
        if (kept >= 1) {
            return max;
        }
        double lowest = basePrice * clamp(minOfferPercent, 0, 100) / 100;
        double offer = Math.max(basePrice * kept, lowest);
        return Math.min(max, Math.floor(offer / 10) * 10);
    }

    /** The share of the max value that the answers leave (1 = nothing taken off). */
    static double keptShare(double basePrice, JsonNode answers, String category, List<EvaluationRule> rules) {
        Map<String, PricingDefaults.Question> builtIn = PricingDefaults.forCategory(category);

        // question → answer → share taken: the built-in shares, with the admins' rules in place of them
        Map<String, Map<String, Double>> shares = new LinkedHashMap<>();
        builtIn.forEach((question, q) -> {
            Map<String, Double> byAnswer = new LinkedHashMap<>();
            q.answers().forEach((answer, percent) -> byAnswer.put(answer, percent / 100));
            shares.put(question, byAnswer);
        });
        for (EvaluationRule rule : rules) {
            if (rule.getQuestionKey() == null || rule.getAnswerKey() == null) {
                continue;
            }
            double share = rule.getDeductionPercent() / 100 + rule.getDeductionAmount() / basePrice;
            shares.computeIfAbsent(rule.getQuestionKey(), k -> new LinkedHashMap<>()).put(rule.getAnswerKey(), share);
        }

        double kept = 1;
        for (Map.Entry<String, Map<String, Double>> question : shares.entrySet()) {
            JsonNode answer = answerTo(answers, question.getKey());
            double left = 1;
            for (Map.Entry<String, Double> option : question.getValue().entrySet()) {
                if (applies(answer, option.getKey())) {
                    left *= 1 - clamp(option.getValue(), 0, MAX_ANSWER_SHARE);
                }
            }
            PricingDefaults.Question known = builtIn.get(question.getKey());
            double cap = known != null ? known.capPercent() / 100
                    : answer.isArray() || answer.isMissingNode() ? OPEN_MULTI_CAP : MAX_ANSWER_SHARE;
            kept *= 1 - Math.min(1 - left, cap);
        }
        return kept;
    }

    /** The customer's answer to a question; a device age left unanswered is "no" (over 11 months or out of warranty). */
    public static JsonNode answerTo(JsonNode answers, String question) {
        JsonNode answer = answers == null ? MissingNode.getInstance() : answers.path(question);
        if (DEVICE_AGE.equals(question) && (answer.isMissingNode() || answer.isNull() || answer.asText("").isBlank())) {
            return TextNode.valueOf(OUT_OF_WARRANTY);
        }
        return answer;
    }

    /**
     * Whether a rule's answer key matches the customer's answer: the chosen option, a ticked option ("x") or one not
     * ticked ("!x") of a list, or "true" / "false". A list never answered counts as nothing ticked (no box, no bill).
     */
    public static boolean applies(JsonNode answer, String key) {
        boolean notTicked = key.startsWith("!");
        if (answer == null || answer.isMissingNode() || answer.isNull()) {
            return notTicked;
        }
        if (answer.isBoolean()) {
            return key.equals(Boolean.toString(answer.booleanValue()));
        }
        if (answer.isArray()) {
            String item = notTicked ? key.substring(1) : key;
            boolean ticked = false;
            for (JsonNode value : answer) {
                if (value.isTextual() && value.textValue().equals(item)) {
                    ticked = true;
                    break;
                }
            }
            return notTicked != ticked;
        }
        return answer.isTextual() && answer.textValue().equals(key);
    }

    /** {@code value} within [low, high]; low for NaN. */
    static double clamp(double value, double low, double high) {
        if (Double.isNaN(value)) {
            return low;
        }
        return Math.max(low, Math.min(high, value));
    }
}
