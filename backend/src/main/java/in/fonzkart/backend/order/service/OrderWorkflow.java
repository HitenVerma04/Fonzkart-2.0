package in.fonzkart.backend.order.service;

import static in.fonzkart.backend.order.service.OrderAccess.FORBIDDEN_ASSIGNEE;
import static in.fonzkart.backend.order.service.OrderAccess.invalid;
import static in.fonzkart.backend.order.service.OrderAccess.requireStatus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.rules.StaffAccess.Staff;
import in.fonzkart.backend.order.entity.CustomerOrder;
import in.fonzkart.backend.order.repository.CustomerOrderRepository;
import in.fonzkart.backend.order.rules.OrderJson;
import in.fonzkart.backend.order.rules.OrderStatus;
import in.fonzkart.backend.order.service.OrderAccess.OrderContext;
import in.fonzkart.backend.pricing.rules.JsValues;
import in.fonzkart.backend.rider.entity.Rider;
import in.fonzkart.backend.rider.repository.RiderRepository;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Port of lib/order-workflow.ts: every change of an order's state, shared by the customer, executive and staff
 * endpoints. Callers check WHO may act ({@link OrderAccess}); these methods check that the change makes sense for the
 * order's current status and record it. Logs in {@code answers} name the actor by role and id, never by email,
 * because customers can see their own order's data.
 * <p>
 * Each change is written on its own (only the changed columns, plus updatedAt) and notifications follow it, as in
 * the original: a failed notification never undoes the change.
 */
@Service
public class OrderWorkflow {

    /** Who made a change; {@code name} is shown to staff (hub receipts, payouts). */
    public record Actor(String role, String id, String name) {
    }

    private static final JsonNodeFactory F = JsonNodeFactory.instance;

    private final CustomerOrderRepository orders;
    private final RiderRepository riders;
    private final UserRepository users;
    private final OrderNotifications notify;
    private final OrderJson json;
    private final TransactionTemplate tx;

    public OrderWorkflow(CustomerOrderRepository orders, RiderRepository riders, UserRepository users,
                         OrderNotifications notify, OrderJson json, TransactionTemplate tx) {
        this.orders = orders;
        this.riders = riders;
        this.users = users;
        this.notify = notify;
        this.json = json;
        this.tx = tx;
    }

    /** staffActor(staff): the display name for logs shown to staff. */
    public Actor staffActor(Staff staff) {
        String name = staff.user().getName();
        return new Actor(staff.role(), staff.id(), JsText.truthy(name) ? name : staff.role());
    }

    // ------------------------------------------------------------------------------------------------ routing

    /** Routes (or re-routes) an order to a partner. A different partner takes over: the executive is released. */
    public Map<String, Object> assignPartner(OrderContext ctx, String partnerId) {
        CustomerOrder order = ctx.order();
        requireStatus(OrderStatus.isAssignable(order.getStatus()));
        User partner = JsText.truthy(partnerId) ? users.findById(partnerId).orElse(null) : null;
        if (partner == null || !Roles.PARTNER.equals(partner.getRole())) {
            throw invalid("Invalid: Not a partner");
        }
        if (!OrderAccess.canRouteTo(ctx.scope(), partner.getId())) {
            throw ActionException.forbidden(FORBIDDEN_ASSIGNEE);
        }
        if (partner.getId().equals(order.getPartnerId())) {
            return result("changed", false);
        }

        ObjectNode answers = json.parseAnswers(order.getAnswers());
        ObjectNode entry = F.objectNode();
        entry.put("date", now());
        entry.put("partnerId", partner.getId());
        entry.put("previousPartnerId", order.getPartnerId());
        by(entry, ctx.staff().role(), ctx.staff().id());
        OrderJson.appendToLog(answers, "routingLog", entry);
        boolean hadExecutive = JsText.truthy(order.getRiderId());
        update(order, o -> {
            o.setPartnerId(partner.getId());
            if (hadExecutive) {
                o.setRiderId(null);
                o.setStatus(OrderStatus.PENDING);
            }
            o.setAnswers(json.stringify(answers));
        });

        notify.notifyUsers(List.of(partner.getId()), "Order routed to you",
                "Order #" + order.getOrderNumber() + " (" + order.getDevice() + ") is now yours to assign.",
                "order_new", order.getId());
        if (hadExecutive) {
            notify.notifyRider(order.getRiderId(), "Order reassigned",
                    "Order #" + order.getOrderNumber() + " was moved to another partner and is no longer yours.",
                    "order_assigned", order.getId());
        }
        return result("changed", true);
    }

    /** Gives the order to an executive; the order follows the executive's partner. */
    public Rider assignRider(OrderContext ctx, String riderId) {
        CustomerOrder order = ctx.order();
        requireStatus(OrderStatus.isAssignable(order.getStatus()));
        Rider rider = JsText.truthy(riderId) ? riders.findById(riderId).orElse(null) : null;
        if (rider == null) {
            throw invalid("Invalid: Executive not found");
        }
        if (!OrderAccess.canAssignRider(ctx.scope(), rider)) {
            throw ActionException.forbidden(FORBIDDEN_ASSIGNEE);
        }
        update(order, o -> {
            o.setRiderId(rider.getId());
            o.setStatus(OrderStatus.ASSIGNED);
            o.setPartnerId(rider.getPartnerId() != null ? rider.getPartnerId() : order.getPartnerId());
        });
        notify.notifyRider(rider.getId(), "New Task Assigned",
                "You have been assigned order #" + order.getOrderNumber() + " for pickup.", "order_assigned", order.getId());
        if (JsText.truthy(order.getRiderId()) && !order.getRiderId().equals(rider.getId())) {
            notify.notifyRider(order.getRiderId(), "Order reassigned",
                    "Order #" + order.getOrderNumber() + " was given to another executive.", "order_assigned", order.getId());
        }
        notify.notifyCustomer(order.getUserId(), "Executive assigned",
                rider.getName() + " will pick up your " + order.getDevice() + ". They will call you before arriving.",
                order.getId());
        return rider;
    }

    // ------------------------------------------------------------------------------------------------ price review

    /**
     * The executive's pickup decision. The quoted price stands: picked up. A different price: the order waits for
     * approval (partner, RM, zonal head or admin) before the device may be collected.
     */
    public Map<String, Object> submitPickup(CustomerOrder order, JsonNode priceInput, JsonNode riderAnswers,
                                            JsonNode images, JsonNode updatedAnswers) {
        requireStatus(OrderStatus.ASSIGNED.equals(OrderStatus.normalize(order.getStatus())));
        long price = jsRound(JsValues.toNumber(priceInput == null ? JsValues.undefined() : priceInput));
        if (price == INVALID) {
            throw invalid("Invalid: Price");
        }

        ObjectNode answers = json.parseAnswers(order.getAnswers());
        answers.setAll(json.parseAnswers(updatedAnswers));
        String[] imageList = strings(images);
        String riderAnswersText = json.stringify(riderAnswers);

        if (price == order.getPrice()) {
            if (!JsValues.truthy(answers.get("hubStatus"))) {
                answers.put("hubStatus", "pending");
            }
            update(order, o -> {
                o.setRiderAnswers(riderAnswersText);
                o.setVerificationImages(imageList);
                o.setOfferedPrice((int) price);
                o.setStatus(OrderStatus.PICKED_UP);
                o.setAnswers(json.stringify(answers));
            });
            notify.notifyCustomer(order.getUserId(), "Device picked up",
                    "Your " + order.getDevice() + " was picked up at " + rupees(price) + ".", order.getId());
            return result("status", OrderStatus.PICKED_UP);
        }

        ObjectNode review = F.objectNode();
        JsonNode quoted = answers.get("quotedPrice");
        if (quoted != null && quoted.isNumber()) {
            review.set("quotedPrice", quoted);
        } else {
            review.put("quotedPrice", order.getPrice());
        }
        review.put("requestedPrice", price);
        review.put("requestedAt", now());
        review.put("decision", "pending");
        answers.set("priceReview", review);
        update(order, o -> {
            o.setRiderAnswers(riderAnswersText);
            o.setVerificationImages(imageList);
            o.setOfferedPrice((int) price);
            o.setStatus(OrderStatus.PRICE_REVIEW);
            o.setAnswers(json.stringify(answers));
        });

        List<String> approvers = new ArrayList<>(notify.caretakers(order.getPartnerId()));
        approvers.addAll(notify.adminIds());
        notify.notifyUsers(approvers, "Price approval needed",
                "Order #" + order.getOrderNumber() + ": the executive offers ₹" + price + " instead of ₹" + order.getPrice()
                        + ". Approve or reject it.", "order_price_review", order.getId());
        notify.notifyCustomer(order.getUserId(), "Revised price under review",
                "After checking your " + order.getDevice() + ", the executive offered " + rupees(price) + " (quoted "
                        + rupees(order.getPrice()) + "). We will confirm it shortly.", order.getId());
        return result("status", OrderStatus.PRICE_REVIEW);
    }

    /** Approve (optionally at another price) or reject the executive's revised price. Either way the executive continues. */
    public Map<String, Object> decidePrice(OrderContext ctx, boolean approve, JsonNode overridePrice, JsonNode reasonInput) {
        CustomerOrder order = ctx.order();
        requireStatus(OrderStatus.PRICE_REVIEW.equals(OrderStatus.normalize(order.getStatus())));
        ObjectNode answers = json.parseAnswers(order.getAnswers());
        ObjectNode review = OrderStatus.priceReviewOf(answers);
        if (review == null) {
            review = F.objectNode();
            review.put("quotedPrice", order.getPrice());
            review.put("requestedPrice", order.getOfferedPrice() != null ? order.getOfferedPrice() : order.getPrice());
            review.put("decision", "pending");
        }
        String decidedAt = now();

        if (approve) {
            long price;
            if (overridePrice == null || overridePrice.isNull() || overridePrice.isMissingNode()
                    || (overridePrice.isTextual() && overridePrice.asText().isEmpty())) {
                price = order.getOfferedPrice() != null ? order.getOfferedPrice() : order.getPrice();
            } else {
                price = jsRound(JsValues.toNumber(overridePrice));
            }
            if (price == INVALID) {
                throw invalid("Invalid: Price");
            }
            JsonNode quoted = answers.get("quotedPrice");
            if (quoted == null || !quoted.isNumber()) {
                JsonNode reviewQuoted = review.get("quotedPrice");
                if (reviewQuoted == null) {
                    answers.remove("quotedPrice");
                } else {
                    answers.set("quotedPrice", reviewQuoted);
                }
            }
            ObjectNode decided = review.deepCopy();
            decided.put("decidedAt", decidedAt);
            decided.put("decidedBy", ctx.staff().role());
            decided.put("decision", "approved");
            decided.put("approvedPrice", price);
            answers.set("priceReview", decided);
            update(order, o -> {
                o.setStatus(OrderStatus.ASSIGNED);
                o.setPrice((int) price);
                o.setOfferedPrice((int) price);
                o.setAnswers(json.stringify(answers));
            });
            notify.notifyRider(order.getRiderId(), "Price approved",
                    "Order #" + order.getOrderNumber() + ": ₹" + price + " approved. Pay the customer and confirm the pickup.",
                    "order_assigned", order.getId());
            notify.notifyCustomer(order.getUserId(), "Revised price approved",
                    "The revised price of " + rupees(price) + " for your " + order.getDevice() + " was approved.", order.getId());
            return result("price", price);
        }

        String reason = reasonInput != null && reasonInput.isTextual() ? jsSlice(reasonInput.asText(), 500) : "";
        if (!reason.isEmpty()) {
            ObjectNode entry = F.objectNode();
            entry.put("date", decidedAt);
            entry.put("reason", reason);
            OrderJson.appendToLog(answers, "adminRejectionLog", entry);
        }
        ObjectNode decided = review.deepCopy();
        decided.put("decidedAt", decidedAt);
        decided.put("decidedBy", ctx.staff().role());
        decided.put("decision", "rejected");
        if (reason.isEmpty()) {
            decided.remove("reason");
        } else {
            decided.put("reason", reason);
        }
        answers.set("priceReview", decided);
        update(order, o -> {
            o.setStatus(OrderStatus.ASSIGNED);
            o.setVerificationImages(new String[0]);
            o.setOfferedPrice(null);
            o.setRiderAnswers(null);
            o.setAnswers(json.stringify(answers));
        });
        notify.notifyRider(order.getRiderId(), "Revised price rejected",
                JsText.trim("Order #" + order.getOrderNumber() + ": the revised price was not approved. " + reason),
                "order_assigned", order.getId());
        notify.notifyCustomer(order.getUserId(), "Price check continues",
                "The revised price was not approved. The executive will check your " + order.getDevice() + " again.",
                order.getId());
        return result("price", order.getPrice());
    }

    // ------------------------------------------------------------------------------------------------ other changes

    public void failOrder(CustomerOrder order, Actor actor, JsonNode reason) {
        requireStatus(!OrderStatus.isCompleted(order.getStatus()) && !OrderStatus.isFailed(order.getStatus()));
        ObjectNode answers = json.parseAnswers(order.getAnswers());
        String text = reason != null && reason.isTextual() && !JsText.trim(reason.asText()).isEmpty()
                ? JsText.trim(reason.asText()) : "Marked as failed";
        ObjectNode entry = F.objectNode();
        entry.put("date", now());
        entry.put("reason", jsSlice(text, 500));
        entry.put("by", Roles.FIELD_EXECUTIVE.equals(actor.role()) ? "executive" : actor.role());
        OrderJson.appendToLog(answers, "failLog", entry);
        update(order, o -> {
            o.setStatus(OrderStatus.FAILED);
            o.setAnswers(json.stringify(answers));
        });
        notify.notifyCustomer(order.getUserId(), "Order cancelled",
                "Your order for " + order.getDevice() + " was cancelled. Contact us if this is unexpected.", order.getId());
    }

    public String restoreOrder(CustomerOrder order, Actor actor) {
        requireStatus(OrderStatus.isFailed(order.getStatus()));
        ObjectNode answers = json.parseAnswers(order.getAnswers());
        ObjectNode entry = F.objectNode();
        entry.put("date", now());
        entry.put("previousStatus", order.getStatus());
        by(entry, actor.role(), actor.id());
        OrderJson.appendToLog(answers, "restoreLog", entry);
        // With an executive: back to them (In Progress). Without: back to "To Be Assigned".
        String status = JsText.truthy(order.getRiderId()) ? OrderStatus.ASSIGNED : OrderStatus.PENDING;
        update(order, o -> {
            o.setStatus(status);
            o.setAnswers(json.stringify(answers));
        });
        notify.notifyCustomer(order.getUserId(), "Order restored",
                "Your order for " + order.getDevice() + " is active again.", order.getId());
        return status;
    }

    public String setHubStatus(CustomerOrder order, Actor actor, JsonNode hubStatusInput) {
        String hubStatus = hubStatusInput != null && hubStatusInput.isTextual() ? hubStatusInput.asText() : null;
        if (!"handed_over".equals(hubStatus) && !"pending".equals(hubStatus)) {
            throw invalid("Invalid: Hub status");
        }
        requireStatus(OrderStatus.isCompleted(order.getStatus()));
        ObjectNode answers = json.parseAnswers(order.getAnswers());
        boolean handedOver = "handed_over".equals(hubStatus);
        answers.put("hubStatus", hubStatus);
        if (handedOver) {
            answers.put("hubHandoverAt", now());
            answers.put("hubReceivedBy", JsText.truthy(actor.name()) ? actor.name() : "Hub Staff");
        } else {
            answers.putNull("hubHandoverAt");
            answers.putNull("hubReceivedBy");
        }
        update(order, o -> o.setAnswers(json.stringify(answers)));
        return hubStatus;
    }

    /** The executive delivered the device to the hub. */
    public void completeAtHub(CustomerOrder order) {
        requireStatus(OrderStatus.PICKED_UP.equals(OrderStatus.normalize(order.getStatus())));
        ObjectNode answers = json.parseAnswers(order.getAnswers());
        if (!JsValues.truthy(answers.get("hubStatus"))) {
            answers.put("hubStatus", "pending");
        }
        update(order, o -> {
            o.setStatus(OrderStatus.COMPLETED);
            o.setAnswers(json.stringify(answers));
        });
    }

    /** The executive confirms the pickup at the order's current (quoted or approved) price. */
    public void confirmPickup(CustomerOrder order) {
        requireStatus(OrderStatus.ASSIGNED.equals(OrderStatus.normalize(order.getStatus())));
        ObjectNode answers = json.parseAnswers(order.getAnswers());
        if (!JsValues.truthy(answers.get("hubStatus"))) {
            answers.put("hubStatus", "pending");
        }
        update(order, o -> {
            o.setStatus(OrderStatus.PICKED_UP);
            o.setAnswers(json.stringify(answers));
        });
        notify.notifyCustomer(order.getUserId(), "Device picked up",
                "Your " + order.getDevice() + " was picked up at " + rupees(order.getPrice()) + ".", order.getId());
    }

    /**
     * Records that the customer was paid (cash handed over, gift card / UPI / bank transfer sent). Once the device is
     * collected; once only. {@code reference} is a transaction or gift-card ORDER id — never the gift card code itself.
     */
    public ObjectNode markPayoutPaid(CustomerOrder order, Actor actor, JsonNode reference) {
        String status = OrderStatus.normalize(order.getStatus());
        requireStatus(OrderStatus.PICKED_UP.equals(status) || OrderStatus.COMPLETED.equals(status));
        ObjectNode answers = json.parseAnswers(order.getAnswers());
        if (OrderStatus.payoutPaid(answers)) {
            throw invalid("Invalid: Payout already recorded");
        }
        String ref = reference != null && reference.isTextual() ? jsSlice(JsText.trim(reference.asText()), 100) : "";
        JsonNode method = answers.get("paymentMethod");
        ObjectNode payout = F.objectNode();
        payout.put("status", "paid");
        if (JsValues.truthy(method)) {
            payout.set("method", method);
        } else {
            payout.put("method", "cash");
        }
        payout.put("amount", order.getPrice());
        if (ref.isEmpty()) {
            payout.putNull("reference");
        } else {
            payout.put("reference", ref);
        }
        payout.put("paidAt", now());
        payout.put("paidBy", JsText.truthy(actor.name()) ? actor.name() : actor.role());
        by(payout, actor.role(), actor.id());
        answers.set("payout", payout);
        update(order, o -> o.setAnswers(json.stringify(answers)));
        notify.notifyCustomer(order.getUserId(), "Payment sent",
                rupees(order.getPrice()) + " for your " + order.getDevice() + " was marked as paid.", order.getId());
        return payout;
    }

    // ------------------------------------------------------------------------------------------------ helpers

    /**
     * prisma.order.update({ where: { id }, data }): only the changed columns and updatedAt are written. A deleted
     * order makes the original throw P2025 ("Record to update not found.").
     */
    public CustomerOrder update(CustomerOrder snapshot, Consumer<CustomerOrder> changes) {
        return tx.execute(status -> {
            CustomerOrder current = orders.findById(snapshot.getId()).orElseThrow(ActionException::recordNotFound);
            changes.accept(current);
            current.touch(JsDates.nowUtc());
            return orders.saveAndFlush(current);
        });
    }

    static Map<String, Object> result(String key, Object value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put(key, value);
        return m;
    }

    private static void by(ObjectNode target, String role, String id) {
        target.put("byRole", role);
        target.put("byId", id);
    }

    static String now() {
        return JsDates.toIsoString(JsDates.nowUtc());
    }

    private static final long INVALID = Long.MIN_VALUE;

    /** Math.round(Number(x)) with the original's check {@code Number.isFinite(price) && price >= 0}. */
    static long jsRound(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return INVALID;
        }
        long rounded = (long) Math.floor(value + 0.5);
        return rounded < 0 ? INVALID : rounded;
    }

    /** Array.isArray(images) ? images.filter(i => typeof i === 'string') : [] */
    static String[] strings(JsonNode images) {
        if (images == null || !images.isArray()) {
            return new String[0];
        }
        List<String> out = new ArrayList<>();
        for (JsonNode i : (ArrayNode) images) {
            if (i.isTextual()) {
                out.add(i.asText());
            }
        }
        return out.toArray(String[]::new);
    }

    /** String.prototype.slice(0, n) (UTF-16 code units, like Java). */
    static String jsSlice(String s, int n) {
        return s.length() <= n ? s : s.substring(0, n);
    }

    /** ₹ amounts with Indian digit grouping (₹1,23,456), as the tracker shows them, for the customer's inbox. */
    static String rupees(long amount) {
        String digits = Long.toString(Math.abs(amount));
        StringBuilder out = new StringBuilder();
        int n = digits.length();
        for (int i = 0; i < n; i++) {
            int fromEnd = n - i;
            out.append(digits.charAt(i));
            if (fromEnd > 1 && (fromEnd == 4 || (fromEnd > 4 && fromEnd % 2 == 0))) {
                out.append(',');
            }
        }
        return (amount < 0 ? "-₹" : "₹") + out;
    }
}
