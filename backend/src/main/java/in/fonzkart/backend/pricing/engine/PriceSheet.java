package in.fonzkart.backend.pricing.engine;

import java.util.List;
import java.util.Map;

/**
 * Everything needed to price one device for any answers, worked out once on the server: the apps download it with
 * the device and recalculate the offer on the phone as the customer ticks or unticks a problem (no network round trip),
 * and the server prices the order from the same sheet ({@link SheetPricer}), so the live price and the booked price are
 * the same number.
 *
 * @param engineVersion  the pricing engine that made it (kept with every logged quote)
 * @param category       the sell category
 * @param maxValue       the variant's max value (a flawless device)
 * @param floor          the lowest offer in rupees
 * @param labourFirst    repair labour for the first repair job
 * @param labourExtra    repair labour for each further job (parts come off together)
 * @param lines          what each answer takes: a share of the max value, or a repair in rupees
 * @param caps           the most each share question takes in all (0–1)
 * @param profitGuard    the most Fonzkart can pay and still make its margin; null until resales show it
 * @param confidence     how sure the max value is (0–1)
 * @param maxValueSource how the max value is kept: "auto" (launch price and age), "manual" (an admin's price)
 */
public record PriceSheet(String engineVersion, String category, long maxValue, long floor, long labourFirst,
                         long labourExtra, List<Line> lines, Map<String, Double> caps, ProfitGuard profitGuard,
                         double confidence, String maxValueSource) {

    public static final String VALUE = "value";
    public static final String REPAIR = "repair";

    /**
     * One answer's deduction. A "value" line takes {@code share} of the max value (cosmetic grade, age, accessories,
     * bought abroad); a "repair" line costs {@code cost} rupees for {@code part} (paid once per part, however many
     * answers point at it).
     *
     * @param answer the option id, "!item" for an item the customer does not have, "true" / "false" for yes/no
     * @param source where the figure comes from: builtin, admin, prior, official, fonzkart_repair, observed
     */
    public record Line(String question, String answer, String kind, double share, String part, long cost,
                       double confidence, String source) {
    }

    /**
     * What resales show: the most Fonzkart can pay for a flawless one and keep its margin ({@code payable}: resale value
     * less the margin, so the sheet, which anyone can download, never shows the margin itself), and what one pickup
     * costs ({@code logistics}).
     */
    public record ProfitGuard(long payable, long logistics, double confidence, int sales) {
    }
}
