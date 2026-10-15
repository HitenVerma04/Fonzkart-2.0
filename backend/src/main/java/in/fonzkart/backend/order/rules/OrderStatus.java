package in.fonzkart.backend.order.rules;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.fonzkart.backend.shared.text.JsText;
import java.util.List;

/**
 * Port of lib/order-status.ts (the parts the server needs): the statuses stored in "Order".status and the predicates
 * every order screen and action shares.
 *
 * <pre>
 *   Pending Pickup ──(executive assigned)──> assigned ──(price unchanged)──> picked_up ──> completed (at the hub)
 *                                               │   ↑
 *                          (price changed)      ▼   │ (rejected: re-check)
 *                                     pending_verification ──(approved)──> assigned
 *   Any status before completed can become failed; staff may restore a failed order.
 * </pre>
 */
public final class OrderStatus {

    public static final String PENDING = "Pending Pickup";
    public static final String ASSIGNED = "assigned";
    public static final String PRICE_REVIEW = "pending_verification";
    public static final String PICKED_UP = "picked_up";
    public static final String COMPLETED = "completed";
    public static final String FAILED = "failed";

    private OrderStatus() {
    }

    /** Older rows used capitalised statuses ('Completed', 'Cancelled'); compare case-insensitively. */
    public static String normalize(String status) {
        return JsText.lower(JsText.trim(status == null ? "" : status));
    }

    public static boolean isCompleted(String status) {
        return COMPLETED.equals(normalize(status));
    }

    public static boolean isFailed(String status) {
        return List.of("failed", "cancelled", "unpicked").contains(normalize(status));
    }

    public static boolean isPickedUpOrLater(String status) {
        return List.of(PICKED_UP, COMPLETED).contains(normalize(status));
    }

    /** Before the device is collected: a partner or executive may still be (re)assigned. */
    public static boolean isAssignable(String status) {
        return List.of(normalize(PENDING), normalize(ASSIGNED)).contains(normalize(status));
    }

    /** payoutOf(order).paid: "Mark paid" was recorded. */
    public static boolean payoutPaid(ObjectNode answers) {
        JsonNode payout = answers.get("payout");
        return payout != null && payout.isObject() && "paid".equals(textOrNull(payout.get("status")));
    }

    /** priceReviewOf(order): the latest price review, or null. */
    public static ObjectNode priceReviewOf(ObjectNode answers) {
        JsonNode review = answers.get("priceReview");
        return review != null && review.isObject() ? (ObjectNode) review.deepCopy() : null;
    }

    private static String textOrNull(JsonNode v) {
        return v != null && v.isTextual() ? v.asText() : null;
    }
}
