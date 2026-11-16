package in.fonzkart.backend.pricing.engine;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SheetPricerTest {

    private static final ObjectMapper M = new ObjectMapper();

    private static PriceSheet.Line share(String q, String a, double share) {
        return new PriceSheet.Line(q, a, PriceSheet.VALUE, share, null, 0, 0.5, "builtin");
    }

    private static PriceSheet.Line repair(String q, String a, String part, long cost, double confidence) {
        return new PriceSheet.Line(q, a, PriceSheet.REPAIR, 0, part, cost, confidence, "prior");
    }

    /** A ₹50,000 phone: shares for scratches and accessories, repairs for screen, board and cameras. */
    private static PriceSheet phone(PriceSheet.ProfitGuard guard) {
        return new PriceSheet("test", "smartphone", 50000, 7500, 300, 150, List.of(
                share("physical_condition", "good", 0.04),
                share("physical_condition", "average", 0.12),
                repair("physical_condition", "below_average", "display", 12000, 0.6),
                share("body_condition", "average", 0.08),
                repair("functional_issues", "wifi", "board", 3500, 0.3),
                repair("functional_issues", "sim1", "board", 3000, 0.3),
                repair("functional_issues", "back_camera", "rear_camera", 5000, 0.5),
                repair("functional_issues", "back_camera_blur", "rear_camera", 3500, 0.5),
                share("accessories", "!box", 0.02),
                share("accessories", "!bill", 0.04)),
                Map.of("physical_condition", 0.9, "body_condition", 0.9, "accessories", 0.1), guard, 0.8, "auto");
    }

    private static JsonNode answers(String json) throws Exception {
        return M.readTree(json);
    }

    private static long sum(SheetPricer.Result r) {
        return r.breakdown().stream().mapToLong(SheetPricer.Item::amount).sum();
    }

    @Test
    void nothingWrongIsTheMaxValueExactly() throws Exception {
        SheetPricer.Result r = SheetPricer.price(phone(null), answers(
                "{\"physical_condition\":\"flawless\",\"body_condition\":\"flawless\",\"functional_issues\":[],\"accessories\":[\"box\",\"bill\"]}"));
        assertThat(r.price()).isEqualTo(50000);
        assertThat(r.breakdown()).isEmpty();
    }

    @Test
    void sharesMultiplyAndRepairsCostRupees() throws Exception {
        // 50,000 × 0.96 (good) × 0.92 (body average) = 44,160; − 5,000 camera − 300 labour = 38,860
        SheetPricer.Result r = SheetPricer.price(phone(null), answers(
                "{\"physical_condition\":\"good\",\"body_condition\":\"average\",\"functional_issues\":[\"back_camera\"],\"accessories\":[\"box\",\"bill\"]}"));
        assertThat(r.price()).isEqualTo(38860);
        assertThat(sum(r)).isEqualTo(50000 - 38860);
        assertThat(r.breakdown()).extracting(SheetPricer.Item::kind).containsExactly("value", "value", "repair", "labour");
    }

    @Test
    void answersOnTheSamePartArePaidOnce() throws Exception {
        // wifi + sim1 are one board repair (the dearer, 3,500); camera + blurry camera one camera (5,000)
        SheetPricer.Result r = SheetPricer.price(phone(null), answers(
                "{\"functional_issues\":[\"wifi\",\"sim1\",\"back_camera\",\"back_camera_blur\"],\"accessories\":[\"box\",\"bill\"]}"));
        // 50,000 − 3,500 − 5,000 − (300 + 150 labour) = 41,050
        assertThat(r.price()).isEqualTo(41050);
        assertThat(r.breakdown()).filteredOn(i -> i.kind().equals("repair")).hasSize(2);
    }

    @Test
    void missingAccessoriesOverlapUpToTheirCap() throws Exception {
        // !box 2% and !bill 4% together: 1 − 0.98 × 0.96 = 5.92%
        SheetPricer.Result r = SheetPricer.price(phone(null), answers("{\"accessories\":[]}"));
        assertThat(r.price()).isEqualTo(47040);
    }

    @Test
    void neverBelowTheLowestOffer() throws Exception {
        PriceSheet sheet = new PriceSheet("test", "smartphone", 10000, 1500, 300, 150,
                List.of(repair("physical_condition", "below_average", "display", 9000, 0.4),
                        repair("functional_issues", "back_camera", "rear_camera", 4000, 0.4)),
                Map.of(), null, 0.6, "manual");
        SheetPricer.Result r = SheetPricer.price(sheet, answers("{\"physical_condition\":\"below_average\",\"functional_issues\":[\"back_camera\"]}"));
        assertThat(r.price()).isEqualTo(1500);
        assertThat(r.floorApplied()).isTrue();
        assertThat(sum(r)).isEqualTo(10000 - 1500);
    }

    @Test
    void profitGuardCapsWhatResalesCannotPayFor() throws Exception {
        // resales: a flawless one sells for 52,000. At 12% margin and ₹250 logistics, a screen repair (12,000 + 300
        // labour) leaves 52,000 × 0.88 − 12,300 − 250 = 33,210, below the 37,700 the max value alone would give.
        PriceSheet.ProfitGuard guard = new PriceSheet.ProfitGuard(45760, 250, 0.6, 4); // resale 52,000 less 12%
        SheetPricer.Result r = SheetPricer.price(phone(guard), answers("{\"physical_condition\":\"below_average\",\"accessories\":[\"box\",\"bill\"]}"));
        assertThat(r.price()).isEqualTo(33210);
        assertThat(r.breakdown()).extracting(SheetPricer.Item::kind).contains("profit");
        assertThat(sum(r)).isEqualTo(50000 - 33210);
        assertThat(r.belowCost()).isFalse();
    }

    @Test
    void profitGuardNeverGoesBelowTheLowestOffer() throws Exception {
        PriceSheet.ProfitGuard guard = new PriceSheet.ProfitGuard(13200, 250, 0.6, 4);
        SheetPricer.Result r = SheetPricer.price(phone(guard), answers("{\"physical_condition\":\"below_average\",\"accessories\":[\"box\",\"bill\"]}"));
        assertThat(r.price()).isEqualTo(7500);
        assertThat(r.belowCost()).isTrue();
        assertThat(r.floorApplied()).isTrue();
    }

    @Test
    void confidenceFollowsTheRepairsApplied() throws Exception {
        SheetPricer.Result none = SheetPricer.price(phone(null), answers("{\"physical_condition\":\"good\",\"accessories\":[\"box\",\"bill\"]}"));
        SheetPricer.Result board = SheetPricer.price(phone(null), answers("{\"functional_issues\":[\"wifi\"],\"accessories\":[\"box\",\"bill\"]}"));
        assertThat(none.confidence()).isEqualTo(0.8);
        assertThat(board.confidence()).isLessThan(none.confidence());
    }

    @Test
    void noMaxValueNoPrice() throws Exception {
        PriceSheet sheet = new PriceSheet("test", "smartphone", 0, 0, 300, 150, List.of(), Map.of(), null, 0, "manual");
        assertThat(SheetPricer.price(sheet, answers("{}")).price()).isZero();
    }
}
