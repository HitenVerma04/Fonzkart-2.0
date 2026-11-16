package in.fonzkart.backend.pricing.rules;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.YearMonth;
import org.junit.jupiter.api.Test;

/** The max value rule: launch price × kept share for the device's kind, brand and age (worked out in the comments). */
class MaxValueRuleTest {

    private static final YearMonth NOW = YearMonth.of(2026, 11);

    @Test
    void aNewIPhoneKeepsMostOfItsLaunchPrice() {
        // iPhone 18 Pro 256GB, ₹1,64,900, September 2026: 2 months → 0.78 × 0.86^(2/12) = 76.1% → ₹1,25,438 → 1,25,400.
        MaxValueRule.Suggestion s = MaxValueRule.suggest(164_900, YearMonth.of(2026, 9), "smartphone", "apple", NOW);
        assertThat(s.maxValue()).isEqualTo(125_400);
        assertThat(s.ageMonths()).isEqualTo(2);
        assertThat(s.tier()).isEqualTo("apple");
    }

    @Test
    void newerAndBiggerIsWorthMore() {
        long pro18 = MaxValueRule.suggest(164_900, YearMonth.of(2026, 9), "smartphone", "apple", NOW).maxValue();
        long pro17 = MaxValueRule.suggest(134_900, YearMonth.of(2025, 9), "smartphone", "apple", NOW).maxValue();
        long pro18big = MaxValueRule.suggest(189_900, YearMonth.of(2026, 9), "smartphone", "apple", NOW).maxValue();
        assertThat(pro18).isGreaterThan(pro17);
        assertThat(pro18big).isGreaterThan(pro18);
        // The same launch price a year older is worth less.
        assertThat(MaxValueRule.suggest(100_000, YearMonth.of(2025, 11), "tablet", "samsung", NOW).maxValue())
                .isLessThan(MaxValueRule.suggest(100_000, YearMonth.of(2026, 11), "tablet", "samsung", NOW).maxValue());
    }

    @Test
    void appleKeepsValueBetterThanPremiumAndroidThanTheRest() {
        long apple = MaxValueRule.suggest(80_000, YearMonth.of(2025, 11), "smartphone", "apple", NOW).maxValue();
        long samsung = MaxValueRule.suggest(80_000, YearMonth.of(2025, 11), "smartphone", "samsung", NOW).maxValue();
        long vivo = MaxValueRule.suggest(80_000, YearMonth.of(2025, 11), "smartphone", "vivo", NOW).maxValue();
        assertThat(apple).isGreaterThan(samsung);
        assertThat(samsung).isGreaterThan(vivo);
        assertThat(MaxValueRule.tier("Samsung")).isEqualTo("premium");
        assertThat(MaxValueRule.tier("realme")).isEqualTo("standard");
    }

    @Test
    void itMatchesTheCatalogsOwnConsistentPrices() {
        // MacBook Air 2025 (M4, ₹99,900, March 2025) is ₹55,000 in the catalog; the rule gives ₹54,800.
        assertThat(MaxValueRule.suggest(99_900, YearMonth.of(2025, 3), "laptop", "apple", NOW).maxValue()).isEqualTo(54_800);
        // AirPods Pro 2 (₹26,900, September 2022) is ₹8,000 in the catalog; the rule gives ₹7,900.
        assertThat(MaxValueRule.suggest(26_900, YearMonth.of(2022, 9), "earbuds", "apple", NOW).maxValue()).isEqualTo(7_900);
    }

    @Test
    void oldDevicesStopAtEightPercentAndAFutureMonthCountsAsNew() {
        assertThat(MaxValueRule.suggest(50_000, YearMonth.of(2012, 1), "smartphone", "vivo", NOW).maxValue()).isEqualTo(4_000);
        assertThat(MaxValueRule.suggest(10_000, YearMonth.of(2027, 1), "watch", "apple", NOW).ageMonths()).isZero();
    }

    @Test
    void unknownKindsUseAMiddleCurveAndAliasesAreUnderstood() {
        assertThat(MaxValueRule.suggest(10_000, NOW, "drone", "dji", NOW).maxValue()).isEqualTo(5_000);
        assertThat(MaxValueRule.suggest(10_000, NOW, "smartwatch", "apple", NOW).maxValue())
                .isEqualTo(MaxValueRule.suggest(10_000, NOW, "watch", "apple", NOW).maxValue());
    }
}
