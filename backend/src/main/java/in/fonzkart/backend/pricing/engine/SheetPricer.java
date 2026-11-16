package in.fonzkart.backend.pricing.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import in.fonzkart.backend.pricing.rules.PriceCalculator;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The offer for a device's answers, from its {@link PriceSheet}. The same steps run on the phone
 * (mobile/packages/core/src/priceSheet.ts); backend/src/test/resources/golden/price-sheet-cases.json holds the cases
 * both must agree on.
 * <ol>
 *   <li><b>How it looks and sells</b>: each share question takes its share of what is left (several answers to one
 *       question overlap, 1 − Π(1 − share), up to the question's cap), so these can never reach zero together.</li>
 *   <li><b>Repairs</b>: the rupee cost of each part to repair, once per part (the most expensive answer pointing at
 *       it), plus labour for the first job and less for each further one.</li>
 *   <li><b>Limits</b>: never below the lowest offer; when resales show what this model sells for, never more than
 *       Fonzkart can pay and keep its margin (but still not below the lowest offer); never above the max value.
 *       Rounded down to ₹10; the max value exactly when nothing is taken off.</li>
 * </ol>
 */
public final class SheetPricer {

    static final double MAX_SHARE = 0.9;

    /** One step of the price, in rupees taken off (negative: given back, as when the lowest offer applies). */
    public record Item(String kind, String question, List<String> answers, String part, long amount) {
    }

    /**
     * @param price        the offer
     * @param breakdown    max value → offer, step by step (the amounts add up to max value − offer)
     * @param confidence   how sure this offer is (0–1): the max value's confidence and the applied repairs' confidence
     * @param floorApplied the lowest offer raised the price
     * @param belowCost    resales say Fonzkart loses money at this price (the lowest offer kept it up)
     */
    public record Result(long price, List<Item> breakdown, double confidence, boolean floorApplied, boolean belowCost) {
    }

    private SheetPricer() {
    }

    public static Result price(PriceSheet sheet, JsonNode answers) {
        long max = sheet.maxValue();
        if (max <= 0) {
            return new Result(0, List.of(), 0, false, false);
        }
        JsonNode given = answers == null ? MissingNode.getInstance() : answers;
        List<Item> items = new ArrayList<>();

        // 1. shares, question by question in sheet order
        Map<String, List<PriceSheet.Line>> shareQuestions = new LinkedHashMap<>();
        Map<String, PriceSheet.Line> parts = new LinkedHashMap<>();
        Map<String, List<String>> partAnswers = new LinkedHashMap<>();
        for (PriceSheet.Line line : sheet.lines()) {
            if (PriceSheet.REPAIR.equals(line.kind())) {
                if (PriceCalculator.applies(given.path(line.question()), line.answer())) {
                    PriceSheet.Line held = parts.get(line.part());
                    if (held == null || line.cost() > held.cost()) {
                        parts.put(line.part(), line);
                    }
                    partAnswers.computeIfAbsent(line.part(), k -> new ArrayList<>()).add(line.answer());
                }
            } else {
                shareQuestions.computeIfAbsent(line.question(), k -> new ArrayList<>()).add(line);
            }
        }
        double kept = 1;
        double running = max;
        for (Map.Entry<String, List<PriceSheet.Line>> q : shareQuestions.entrySet()) {
            JsonNode answer = given.path(q.getKey());
            double left = 1;
            List<String> matched = new ArrayList<>();
            for (PriceSheet.Line line : q.getValue()) {
                if (PriceCalculator.applies(answer, line.answer())) {
                    left *= 1 - clamp(line.share(), 0, MAX_SHARE);
                    if (line.share() > 0) {
                        matched.add(line.answer());
                    }
                }
            }
            Double cap = sheet.caps() == null ? null : sheet.caps().get(q.getKey());
            double taken = Math.min(1 - left, cap == null ? MAX_SHARE : clamp(cap, 0, MAX_SHARE));
            if (taken > 0) {
                double amount = running * taken;
                items.add(new Item(PriceSheet.VALUE, q.getKey(), matched, null, Math.round(amount)));
                running -= amount;
                kept *= 1 - taken;
            }
        }

        // 2. repairs, once per part
        long repairs = 0;
        double weightedConfidence = 0;
        for (Map.Entry<String, PriceSheet.Line> p : parts.entrySet()) {
            PriceSheet.Line line = p.getValue();
            repairs += line.cost();
            weightedConfidence += line.cost() * line.confidence();
            items.add(new Item(PriceSheet.REPAIR, line.question(), partAnswers.get(p.getKey()), p.getKey(), line.cost()));
        }
        long labour = parts.isEmpty() ? 0 : sheet.labourFirst() + sheet.labourExtra() * (parts.size() - 1);
        if (labour > 0) {
            items.add(new Item("labour", null, List.of(), null, labour));
        }
        PriceSheet.ProfitGuard guard = sheet.profitGuard();
        boolean guarded = guard != null && guard.payable() > 0;
        double affordable = guarded ? guard.payable() * kept - repairs - labour - guard.logistics() : 0;
        if (kept >= 1 && parts.isEmpty() && (!guarded || affordable >= max)) {
            return new Result(max, List.of(), sheet.confidence(), false, false);
        }

        // 3. limits (the profit guard applies to a flawless device too: resales may show the max value is too high)
        double offer = max * kept - repairs - labour;
        long floor = Math.max(0, Math.min(sheet.floor(), max));
        boolean belowCost = false;
        if (guarded) {
            if (affordable < offer) {
                items.add(new Item("profit", null, List.of(), null, Math.round(offer - affordable)));
                offer = affordable;
            }
            belowCost = affordable < floor;
        }
        boolean floorApplied = offer < floor;
        if (floorApplied) {
            items.add(new Item("floor", null, List.of(), null, -Math.round(floor - offer)));
            offer = floor;
        }
        long price = Math.min(max, (long) (Math.floor(offer / 10) * 10));
        price = Math.max(0, price);

        long listed = 0;
        for (Item i : items) {
            listed += i.amount();
        }
        long rounding = (max - price) - listed;
        if (rounding != 0) {
            items.add(new Item("rounding", null, List.of(), null, rounding));
        }
        double repairConfidence = repairs > 0 ? weightedConfidence / repairs : 1;
        double confidence = sheet.confidence() * (0.5 + 0.5 * repairConfidence);
        return new Result(price, List.copyOf(items), Math.round(confidence * 100) / 100.0, floorApplied, belowCost);
    }

    static double clamp(double v, double low, double high) {
        if (Double.isNaN(v)) {
            return low;
        }
        return Math.max(low, Math.min(high, v));
    }
}
