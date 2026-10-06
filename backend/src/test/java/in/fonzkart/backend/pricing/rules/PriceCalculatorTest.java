package in.fonzkart.backend.pricing.rules;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.pricing.entity.EvaluationRule;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * Business rules of actions/priceCalculation.ts, spelled out case by case (values hand-computed from the original
 * code). Bit-for-bit parity over ~1,800 generated cases is covered by PricingCasesParityTest.
 */
class PriceCalculatorTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    // ------------------------------------------------------------------------------------- floors

    @ParameterizedTest(name = "base {0}, condition {1} -> {2}")
    @CsvSource({
            "300, flawless, 400",          // below 50,000: floor 400
            "49999, below_average, 49999",
            "50000, flawless, 50000",      // no deductions for an unknown category: price stays
            "0, good, 400",
            "1, good, 400",
    })
    void unknownCategoryOnlyAppliesTheFloor(double base, String condition, double expected) throws Exception {
        assertThat(calc(base, "{\"physical_condition\":\"" + condition + "\"}", "console", List.of())).isEqualTo(expected);
    }

    @ParameterizedTest(name = "base {0}, condition {1} -> floor {2}")
    @CsvSource({
            "49999, flawless, 400",
            "50000, flawless, 1800",
            "50000, good, 1800",
            "50000, average, 1200",
            "50000, below_average, 500",
            "50000, damaged, 500",
    })
    void floorForExpensiveDevicesDependsOnCondition(double base, String condition, double expectedFloor) throws Exception {
        // A rule larger than any price drives the result to the floor.
        EvaluationRule huge = rule("touch", "false", 10_000_000, 0);
        String answers = "{\"touch\":false,\"physical_condition\":\"" + condition + "\"}";
        assertThat(calc(base, answers, "smartphone", List.of(huge))).isEqualTo(expectedFloor);
    }

    @Test
    void nonStringConditionUsesTheLowestHighValueFloor() throws Exception {
        EvaluationRule huge = rule("touch", "false", 10_000_000, 0);
        assertThat(calc(60000, "{\"touch\":false,\"physical_condition\":[\"good\"]}", "x", List.of(huge))).isEqualTo(500);
        assertThat(calc(60000, "{\"touch\":false}", "x", List.of(huge))).isEqualTo(500);
    }

    @Test
    void resultIsRoundedDown() throws Exception {
        // 1001 - 15% of 1001 = 850.85 -> 850
        assertThat(calc(1001, "{\"physical_condition\":\"good\"}", "smartphone",
                List.of(rule("physical_condition", "good", 0, 15)))).isEqualTo(850);
    }

    // -------------------------------------------------------------------------------------- rules

    @Test
    void rulesMatchBooleansArraysWithNegationAndStrings() throws Exception {
        List<EvaluationRule> rules = List.of(
                rule("calls", "false", 0, 10),       // boolean: applies when answer === (answerKey === 'true')
                rule("touch", "true", 100, 0),
                rule("accessories", "!charger", 800, 0), // '!x': x not selected
                rule("accessories", "box", 50, 0),
                rule("physical_condition", "good", 0, 5));
        // 10000 - 10% (1000) - 100 - 800 - 50 - 5% (500) = 7550
        assertThat(calc(10000, "{\"calls\":false,\"touch\":true,\"accessories\":[\"box\"],\"physical_condition\":\"good\"}",
                "smartphone", rules)).isEqualTo(7550);
        // charger selected: no '!charger' deduction; box missing: no 'box' deduction
        assertThat(calc(10000, "{\"calls\":true,\"touch\":false,\"accessories\":[\"charger\"]}", "smartphone", rules))
                .isEqualTo(10000);
    }

    @Test
    void percentagesAreOfTheBasePriceAndDoNotCompound() throws Exception {
        List<EvaluationRule> rules = List.of(rule("a", "x", 0, 50), rule("b", "y", 0, 50));
        assertThat(calc(10000, "{\"a\":\"x\",\"b\":\"y\"}", "c", rules)).isEqualTo(400); // 10000 - 5000 - 5000 = 0 -> floor
    }

    @Test
    void negativeRulesAreBonuses() throws Exception {
        assertThat(calc(10000, "{\"w\":\"y\"}", "c", List.of(rule("w", "y", -500, -10)))).isEqualTo(11500);
    }

    @Test
    void anyRuleForTheCategoryDisablesTheHardCodedLogic() throws Exception {
        // smartphone fallback would deduct for missing accessories; a single unrelated rule switches it off
        assertThat(calc(10000, "{}", "smartphone", List.of(rule("q", "a", 1, 0)))).isEqualTo(10000);
        assertThat(calc(10000, "{}", "smartphone", List.of())).isEqualTo(10000 - 500 - 300 - 1500);
    }

    // --------------------------------------------------------------------- hard-coded fallback

    @Test
    void smartphoneFallbackMultipliesForFaultsThenSubtractsFromBase() throws Exception {
        // 20000 * 0.8 = 16000; - 10% of base (2000) = 14000; - 4% * 2 issues (1600) = 12400; + 5% warranty (1000)
        // = 13400; all accessories present
        String answers = "{\"calls\":false,\"physical_condition\":\"good\",\"functional_issues\":[\"wifi\",\"camera\"],"
                + "\"warranty\":\"0_3_months\",\"accessories\":[\"charger\",\"box\",\"bill\"]}";
        assertThat(calc(20000, answers, "smartphone", List.of())).isEqualTo(13400);
    }

    @Test
    void smartwatchFromTheSellFlowGetsNoDeductionsWhileWatchDoes() throws Exception {
        String answers = "{\"power\":false,\"accessories\":[]}";
        assertThat(calc(8000, answers, "smartwatch", List.of())).isEqualTo(8000);
        // watch: -50% (4000) - 400 - 300 - 200 - 10% (800) = 2300
        assertThat(calc(8000, answers, "watch", List.of())).isEqualTo(2300);
    }

    @Test
    void javascriptTypeSemanticsArePreserved() throws Exception {
        // string accessories are substring-matched: "charger box" contains charger and box, not bill
        assertThat(calc(10000, "{\"accessories\":\"charger box\"}", "tablet", List.of())).isEqualTo(10000 - 1500);
        // a string functional_issues counts its characters: "ab" = 2 issues at 4%
        assertThat(calc(10000, "{\"functional_issues\":\"ab\",\"accessories\":[\"charger\",\"box\",\"bill\"]}", "tablet",
                List.of())).isEqualTo(9200);
        // laptop: falsy physical_condition becomes []
        assertThat(calc(10000, "{\"physical_condition\":0}", "laptop", List.of())).isEqualTo(10000);
        // includes() on a number throws (the original action fails)
        assertThatThrownBy(() -> calc(10000, "{\"accessories\":5}", "camera", List.of()))
                .isInstanceOf(JsValues.JsTypeError.class);
        assertThatThrownBy(() -> calc(10000, "{\"physical_condition\":7}", "laptop", List.of()))
                .isInstanceOf(JsValues.JsTypeError.class);
    }

    @Test
    void missingAnswersOnlyFailWhenRead() {
        assertThat(PriceCalculator.calculate(1000, JsValues.undefined(), "console", List.of())).isEqualTo(1000);
        assertThatThrownBy(() -> PriceCalculator.calculate(60000, JsValues.undefined(), "console", List.of()))
                .isInstanceOf(JsValues.JsTypeError.class);
    }

    // ---------------------------------------------------------------------------------- helpers

    private static double calc(double base, String answersJson, String category, List<EvaluationRule> rules) throws Exception {
        JsonNode answers = MAPPER.readTree(answersJson);
        return PriceCalculator.calculate(base, answers, category, rules);
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
