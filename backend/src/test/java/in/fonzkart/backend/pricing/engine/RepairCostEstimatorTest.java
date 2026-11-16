package in.fonzkart.backend.pricing.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class RepairCostEstimatorTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 16, 12, 0);
    private static final RepairCostEstimator.Device IPHONE_15 =
            new RepairCostEstimator.Device("smartphone", "apple", false, 79900, true);
    private static final RepairCostEstimator.Device BUDGET =
            new RepairCostEstimator.Device("smartphone", "standard", false, 12999, true);

    @Test
    void priorScalesWithTheModelsLaunchPrice() {
        RepairCostEstimator.Estimate iphone = RepairCostEstimator.estimate("display", IPHONE_15, List.of(), List.of(), NOW);
        RepairCostEstimator.Estimate budget = RepairCostEstimator.estimate("display", BUDGET, List.of(), List.of(), NOW);
        assertThat(iphone.cost()).isEqualTo(15580); // 26% of 79,900, at the 75% Fonzkart pays of list prices
        assertThat(budget.cost()).isEqualTo(1950);  // 20% of 12,999, at 75%
        assertThat(iphone.source()).isEqualTo("prior");
        assertThat(iphone.confidence()).isLessThan(0.3);
    }

    @Test
    void foldableDisplaysCostFarMore() {
        RepairCostEstimator.Device fold = new RepairCostEstimator.Device("smartphone", "premium", true, 174999, true);
        RepairCostEstimator.Device flat = new RepairCostEstimator.Device("smartphone", "premium", false, 174999, true);
        assertThat(RepairCostEstimator.estimate("display", fold, List.of(), List.of(), NOW).cost())
                .isGreaterThan(RepairCostEstimator.estimate("display", flat, List.of(), List.of(), NOW).cost() + 20000);
    }

    @Test
    void anOfficialPriceOutweighsThePrior() {
        // Apple's ₹25,500 for an iPhone 15 display, at 75% for what Fonzkart pays = 19,125; the prior said 15,580
        RepairCostEstimator.Estimate e = RepairCostEstimator.estimate("display", IPHONE_15,
                List.of(new RepairCostEstimator.Listed(25500, "official", "model")), List.of(), NOW);
        assertThat(e.source()).isEqualTo("official");
        assertThat(e.cost()).isBetween(18000L, 19125L);
        assertThat(e.confidence()).isGreaterThan(0.6);
    }

    @Test
    void whatFonzkartPaidTakesOverAsRepairsAccumulate() {
        List<RepairCostEstimator.Paid> paid = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            paid.add(new RepairCostEstimator.Paid(9000, true, 79900, NOW.minusDays(10)));
        }
        RepairCostEstimator.Estimate e = RepairCostEstimator.estimate("display", IPHONE_15, List.of(), paid, NOW);
        assertThat(e.source()).isEqualTo("observed");
        assertThat(e.observations()).isEqualTo(20);
        assertThat(e.cost()).isBetween(9000L, 10500L);
        assertThat(e.confidence()).isGreaterThan(0.8);
    }

    @Test
    void otherModelsRepairsTeachScaledByLaunchPrice() {
        // a ₹40,000-launch phone's ₹5,000 display repair says ~₹10,000 for an ₹80,000 one
        List<RepairCostEstimator.Paid> paid = List.of(new RepairCostEstimator.Paid(5000, false, 40000, NOW),
                new RepairCostEstimator.Paid(5000, false, 40000, NOW));
        RepairCostEstimator.Device device = new RepairCostEstimator.Device("smartphone", "standard", false, 80000, true);
        RepairCostEstimator.Estimate alone = RepairCostEstimator.estimate("display", device, List.of(), List.of(), NOW);
        RepairCostEstimator.Estimate taught = RepairCostEstimator.estimate("display", device, List.of(), paid, NOW);
        assertThat(alone.cost()).isEqualTo(12000);
        assertThat(taught.cost()).isLessThan(alone.cost()).isGreaterThan(10000);
    }

    @Test
    void partsForOlderModelsCostLess() {
        RepairCostEstimator.Device old = new RepairCostEstimator.Device("smartphone", "apple", false, 79900, true, 5);
        assertThat(RepairCostEstimator.estimate("display", old, List.of(), List.of(), NOW).cost()).isEqualTo(9200); // 0.9^5 = 59%
    }

    @Test
    void oldRepairsCountLess() {
        assertThat(RepairCostEstimator.decay(NOW.minusDays(180), NOW)).isCloseTo(0.5, org.assertj.core.data.Offset.offset(0.01));
    }

    @Test
    void nothingKnownNoEstimate() {
        RepairCostEstimator.Device unknown = new RepairCostEstimator.Device("smartphone", "standard", false, 0, false);
        assertThat(RepairCostEstimator.estimate("display", unknown, List.of(), List.of(), NOW)).isNull();
        assertThat(RepairCostEstimator.estimate("display", new RepairCostEstimator.Device("earbuds", "standard", false, 9999, true),
                List.of(), List.of(), NOW)).isNull();
    }

    @Test
    void foldableNames() {
        assertThat(PartCatalog.foldable("Galaxy Z Fold 7")).isTrue();
        assertThat(PartCatalog.foldable("Galaxy Z Flip 6")).isTrue();
        assertThat(PartCatalog.foldable("iPhone Duo")).isTrue();
        assertThat(PartCatalog.foldable("OnePlus Open")).isTrue();
        assertThat(PartCatalog.foldable("Galaxy S25 Ultra")).isFalse();
        assertThat(PartCatalog.foldable("iPhone 15 Pro")).isFalse();
    }
}
