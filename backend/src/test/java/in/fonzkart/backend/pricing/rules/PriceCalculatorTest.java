package in.fonzkart.backend.pricing.rules;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.pricing.entity.EvaluationRule;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The offer formula (PriceCalculator), case by case. Values are worked out by hand in the comments, with the built-in
 * shares of PricingDefaults and the default lowest offer of 15%.
 */
class PriceCalculatorTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final double IPHONE_17_PRO = 92_400;

    private static final String ALL_PHONE_ISSUES = "[\"wifi\",\"sim1\",\"sim2\",\"bluetooth\",\"front_camera\",\"back_camera\","
            + "\"camera_glass\",\"finger_sensor\",\"face_sensor\",\"power_button\",\"volume_button\",\"silent_button\",\"speaker\","
            + "\"earpiece\",\"microphone\",\"audio_ic\",\"charging_port\",\"proximity\",\"vibrator\",\"battery\","
            + "\"front_camera_blur\",\"back_camera_blur\"]";
    private static final String WORST_PHONE = "{\"physical_condition\":\"below_average\",\"body_condition\":\"below_average\","
            + "\"functional_issues\":" + ALL_PHONE_ISSUES + ",\"purchase_location\":\"global\",\"accessories\":[],\"warranty\":\"no\"}";

    // ------------------------------------------------------------------------------ never above the max value

    @Test
    void theReportedCaseStaysBelowTheMaxValue() throws Exception {
        // Flawless, flawless, no problems, India, box + bill (no charger), 0-3 months. Before: 92,400 + 5% warranty
        // bonus - ₹500 charger = 96,520. Now only the missing charger counts: 92,400 × 0.99 = 91,476 → 91,470.
        String answers = "{\"physical_condition\":\"flawless\",\"body_condition\":\"flawless\",\"functional_issues\":[],"
                + "\"purchase_location\":\"india\",\"accessories\":[\"box\",\"bill\"],\"warranty\":\"0_3_months\"}";
        assertThat(phone(IPHONE_17_PRO, answers)).isEqualTo(91_470);
    }

    @Test
    void aPerfectDeviceGetsExactlyTheMaxValue() throws Exception {
        String perfect = "{\"physical_condition\":\"flawless\",\"body_condition\":\"flawless\",\"functional_issues\":[],"
                + "\"purchase_location\":\"india\",\"accessories\":[\"charger\",\"box\",\"bill\"],\"warranty\":\"0_3_months\"}";
        assertThat(phone(IPHONE_17_PRO, perfect)).isEqualTo(92_400);
        assertThat(phone(51_239, perfect)).isEqualTo(51_239); // not rounded when nothing is taken off
    }

    @Test
    void aRuleCanNeverRaiseThePrice() throws Exception {
        // An old-style "bonus" (negative deduction) counts as no deduction.
        String perfect = "{\"physical_condition\":\"flawless\",\"accessories\":[\"charger\",\"box\",\"bill\"],\"warranty\":\"0_3_months\"}";
        assertThat(calc(IPHONE_17_PRO, perfect, "smartphone", List.of(rule("warranty", "0_3_months", -500, -5)), 15))
                .isEqualTo(92_400);
    }

    // ------------------------------------------------------------------------------------ typical devices

    @Test
    void aTypicalUsedPhone() throws Exception {
        // Screen good 4%, body good 3%, box only (charger 1% and bill 4% overlap: 1 - 0.99 × 0.96 = 4.96%),
        // over 11 months 8%: 92,400 × 0.96 × 0.97 × 0.9504 × 0.92 = 75,233 → 75,230. Before: 64,180 (bill alone -15%).
        String answers = "{\"physical_condition\":\"good\",\"body_condition\":\"good\",\"functional_issues\":[],"
                + "\"purchase_location\":\"india\",\"accessories\":[\"box\"],\"warranty\":\"no\"}";
        assertThat(phone(IPHONE_17_PRO, answers)).isEqualTo(75_230);
    }

    @Test
    void aCrackedPhoneWithThreeProblems() throws Exception {
        // ₹50,000: screen 30%, body average 8%, back camera 15% + Face ID 15% + battery 8% → 1 - 0.85 × 0.85 × 0.92
        // = 33.5%, no charger 1%, over 11 months 8%: 50,000 × 0.70 × 0.92 × 0.6647 × 0.99 × 0.92 = 19,494 → 19,490.
        String answers = "{\"physical_condition\":\"below_average\",\"body_condition\":\"average\","
                + "\"functional_issues\":[\"back_camera\",\"face_sensor\",\"battery\"],\"purchase_location\":\"india\","
                + "\"accessories\":[\"box\",\"bill\"],\"warranty\":\"no\"}";
        assertThat(phone(50_000, answers)).isEqualTo(19_490);
    }

    @Test
    void everyDefectAtOnceStaysAFairShareOfTheMaxValue() throws Exception {
        // 0.70 × 0.82 × 0.50 (problems capped) × 0.9314 (no accessories) × 0.90 (abroad) × 0.92 (no warranty) = 22.1%.
        // Before: ₹500 (50,000 phone: 35% + 20% + 22 × 4% + ... went below zero, then a fixed ₹500 floor).
        assertThat(phone(IPHONE_17_PRO, WORST_PHONE)).isEqualTo(20_450);
        assertThat(phone(50_000, WORST_PHONE)).isEqualTo(11_060);
    }

    // ------------------------------------------------------------------------------------- the lowest offer

    @Test
    void theLowestOfferIsAPercentOfTheMaxValue() throws Exception {
        // A ₹40,000 tablet that does not turn on and has everything else wrong works out to 7.1% (₹2,839): the lowest
        // offer (15% unless the admins set another) gives ₹6,000; at 25% it is ₹10,000.
        String deadTablet = "{\"power\":false,\"touch\":false,\"wifi\":false,\"physical_condition\":\"below_average\","
                + "\"body_condition\":\"below_average\",\"functional_issues\":[\"bluetooth\",\"front_camera\",\"back_camera\","
                + "\"camera_glass\",\"power_button\",\"volume_button\",\"speaker\",\"microphone\",\"charging_port\",\"battery\"],"
                + "\"purchase_location\":\"global\",\"accessories\":[],\"warranty\":\"no\"}";
        assertThat(calc(40_000, deadTablet, "tablet", List.of(), 15)).isEqualTo(6_000);
        assertThat(calc(40_000, deadTablet, "tablet", List.of(), 25)).isEqualTo(10_000);
        assertThat(calc(40_000, deadTablet, "tablet", List.of(), 0)).isEqualTo(2_830);
    }

    @Test
    void harshRulesStillStopAtTheLowestOffer() throws Exception {
        List<EvaluationRule> harsh = List.of(rule("physical_condition", "below_average", 0, 90), rule("body_condition", "below_average", 0, 90));
        assertThat(calc(IPHONE_17_PRO, WORST_PHONE, "smartphone", harsh, 15)).isEqualTo(13_860);
    }

    // ------------------------------------------------------------------------------------------- the rules

    @Test
    void aRuleReplacesTheBuiltInShareOfItsAnswerOnly() throws Exception {
        // Live today: one rule, screen below average 20% (built in: 30%). Before, saving it made every other answer
        // stop counting (a phone with everything broken got 92,400 - 20% = 73,920). Now the rest still counts:
        // 0.80 × 0.82 × 0.50 × 0.9314 × 0.90 × 0.92 × 92,400 = 23,372 → 23,370.
        List<EvaluationRule> live = List.of(rule("physical_condition", "below_average", 0, 20));
        assertThat(calc(IPHONE_17_PRO, WORST_PHONE, "smartphone", live, 15)).isEqualTo(23_370);
    }

    @Test
    void anAmountIsAShareOfTheMaxValue() throws Exception {
        // ₹924 of 92,400 = 1%, like the built-in missing charger.
        String noBox = "{\"accessories\":[\"charger\",\"bill\"]}";
        assertThat(calc(IPHONE_17_PRO, noBox, "smartphone", List.of(rule("accessories", "!box", 924, 0)), 15)).isEqualTo(91_470);
    }

    @Test
    void problemsOfOneQuestionOverlapInsteadOfAddingUp() throws Exception {
        // Two 10% problems take 19% (10% + 10% of the 90% left), not 20%.
        List<EvaluationRule> rules = List.of(rule("faults", "a", 0, 10), rule("faults", "b", 0, 10));
        assertThat(calc(10_000, "{\"faults\":[\"a\",\"b\"]}", "console", rules, 15)).isEqualTo(8_100);
    }

    @Test
    void manyProblemsStopAtTheQuestionsCap() throws Exception {
        // All 22 problems would take 78%; phone problems take at most 50%.
        assertThat(phone(10_000, "{\"functional_issues\":" + ALL_PHONE_ISSUES + "}")).isEqualTo(4_650); // 50%, and no box/bill/charger: × 0.9314
    }

    @Test
    void anAccessoryListNeverAnsweredMeansNothingTicked() throws Exception {
        assertThat(phone(10_000, "{}")).isEqualTo(9_310); // no charger, box or bill: 1 - 0.99 × 0.98 × 0.96 = 6.86%
    }

    @Test
    void yesNoQuestionsCountTheirBadAnswer() throws Exception {
        assertThat(calc(10_000, "{\"sensor_spots\":true,\"accessories\":[\"battery\",\"charger\",\"lens_cap\",\"strap\",\"box\",\"bill\"]}",
                "camera", List.of(), 15)).isEqualTo(8_000);
        assertThat(calc(10_000, "{\"sensor_spots\":false,\"lens_focus\":true,\"accessories\":[\"battery\",\"charger\",\"lens_cap\",\"strap\",\"box\",\"bill\"]}",
                "camera", List.of(), 15)).isEqualTo(10_000);
    }

    @Test
    void aCategoryWithoutBuiltInSharesOrRulesKeepsTheMaxValue() throws Exception {
        assertThat(calc(1_000, "{\"physical_condition\":\"good\"}", "drone", List.of(), 15)).isEqualTo(1_000);
    }

    @Test
    void noPositiveMaxValueMeansNoOffer() throws Exception {
        assertThat(calc(0, "{}", "smartphone", List.of(), 15)).isZero();
        assertThat(calc(-5, "{}", "smartphone", List.of(), 15)).isZero();
        assertThat(calc(Double.NaN, "{}", "smartphone", List.of(), 15)).isZero();
    }

    // ---------------------------------------------------------------------------------- helpers

    private static double phone(double base, String answersJson) throws Exception {
        return calc(base, answersJson, "smartphone", List.of(), PriceCalculator.DEFAULT_MIN_OFFER_PERCENT);
    }

    private static double calc(double base, String answersJson, String category, List<EvaluationRule> rules, double minOffer) throws Exception {
        JsonNode answers = MAPPER.readTree(answersJson);
        return PriceCalculator.calculate(base, answers, category, rules, minOffer);
    }

    private static EvaluationRule rule(String questionKey, String answerKey, int amount, double percent) throws Exception {
        Constructor<EvaluationRule> ctor = EvaluationRule.class.getDeclaredConstructor();
        ctor.setAccessible(true);
        EvaluationRule r = ctor.newInstance();
        set(r, "questionKey", questionKey);
        set(r, "answerKey", answerKey);
        set(r, "deductionAmount", amount);
        set(r, "deductionPercent", percent);
        return r;
    }

    private static void set(Object target, String field, Object value) throws Exception {
        Field f = EvaluationRule.class.getDeclaredField(field);
        f.setAccessible(true);
        f.set(target, value);
    }
}
