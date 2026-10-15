package in.fonzkart.backend.order.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.order.dto.AppOrderDto;
import in.fonzkart.backend.order.entity.CustomerOrder;
import in.fonzkart.backend.order.repository.CustomerOrderRepository;
import in.fonzkart.backend.order.rules.OrderJson;
import in.fonzkart.backend.order.service.OrderWorkflow.Actor;
import in.fonzkart.backend.pricing.rules.JsValues;
import in.fonzkart.backend.rider.entity.Rider;
import in.fonzkart.backend.rider.service.ExecutiveAuthService;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Port of the order actions of actions/executive.ts: the signed-in field executive (executive_id token, or a
 * FIELD_EXECUTIVE account) sees and changes only the orders assigned to them.
 */
@Service
public class ExecutiveOrderService {

    public static final String NOT_YOUR_ORDER = "Forbidden: Not your order";

    private final ExecutiveAuthService executives;
    private final CustomerOrderRepository orders;
    private final UserRepository users;
    private final OrderWorkflow workflow;
    private final AppOrderMapper mapper;
    private final OrderJson json;

    public ExecutiveOrderService(ExecutiveAuthService executives, CustomerOrderRepository orders, UserRepository users,
                                 OrderWorkflow workflow, AppOrderMapper mapper, OrderJson json) {
        this.executives = executives;
        this.orders = orders;
        this.users = users;
        this.workflow = workflow;
        this.mapper = mapper;
        this.json = json;
    }

    private record Own(Rider executive, CustomerOrder order, Actor actor) {
    }

    /** getExecutiveOrders(): every order assigned to the executive, newest first (none without a session). */
    public List<AppOrderDto> getExecutiveOrders(HttpServletRequest request) {
        Optional<Rider> executive = executives.currentExecutive(request);
        if (executive.isEmpty()) {
            return List.of();
        }
        List<CustomerOrder> mine = orders.findAllByOrderByCreatedAtDesc().stream()
                .filter(o -> executive.get().getId().equals(o.getRiderId())).toList();
        Map<String, User> customers = users.findAllById(mine.stream().map(CustomerOrder::getUserId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return mine.stream().map(o -> mapper.toAppOrder(o, customers.get(o.getUserId()))).toList();
    }

    /** One of the executive's own orders (Partner app, rider mode). */
    public AppOrderDto getExecutiveOrder(HttpServletRequest request, String orderId) {
        Own own = requireOwnOrder(request, orderId);
        return mapper.toAppOrder(own.order(), users.findById(own.order().getUserId()).orElse(null));
    }

    /**
     * updateOrderStatus(orderId, status, reason?): fail an open pickup, confirm a pickup at the current (quoted or
     * approved) price, or report the device delivered to the hub. A changed price goes through submitVerification.
     */
    public Map<String, Object> updateOrderStatus(HttpServletRequest request, String orderId, String status, JsonNode reason) {
        Own own = requireOwnOrder(request, orderId);
        if ("failed".equals(status)) {
            JsonNode why = JsValues.truthy(reason) ? reason : JsonNodeFactory.instance.textNode("Handled by executive");
            workflow.failOrder(own.order(), own.actor(), why);
        } else if ("picked_up".equals(status)) {
            workflow.confirmPickup(own.order());
        } else if ("completed".equals(status)) {
            workflow.completeAtHub(own.order());
        } else {
            throw OrderAccess.invalid("Invalid: Status");
        }
        return OrderWorkflow.result("success", true);
    }

    /**
     * submitVerification(orderId, payload). Decline: the order fails. Pickup at the quoted price: picked up. Pickup at
     * another price: the order waits for approval (pending_verification) before the device may be collected.
     */
    public Map<String, Object> submitVerification(HttpServletRequest request, String orderId, JsonNode payload) {
        Own own = requireOwnOrder(request, orderId);
        JsonNode p = payload == null ? JsonNodeFactory.instance.objectNode() : payload;
        JsonNode riderAnswers = p.get("riderAnswers");

        if ("failed".equals(p.path("status").asText(null))) {
            JsonNode notes = riderAnswers != null && riderAnswers.isObject() ? riderAnswers.get("notes") : null;
            JsonNode why = JsValues.truthy(notes) ? notes : JsonNodeFactory.instance.textNode("Verification declined by executive");
            workflow.failOrder(own.order(), own.actor(), why);
            double offered = JsValues.toNumber(p.has("offeredPrice") ? p.get("offeredPrice") : JsValues.undefined());
            Integer offeredPrice = Double.isFinite(offered) ? (int) Math.floor(offered + 0.5) : null;
            String riderAnswersText = json.stringify(riderAnswers);
            String[] images = OrderWorkflow.strings(p.get("verificationImages"));
            workflow.update(own.order(), o -> {
                o.setRiderAnswers(riderAnswersText);
                o.setVerificationImages(images);
                o.setOfferedPrice(offeredPrice);
            });
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("success", true);
            m.put("status", "failed");
            return m;
        }

        JsonNode updatedAnswers = riderAnswers != null && riderAnswers.isObject() ? riderAnswers.get("answers") : null;
        Map<String, Object> result = workflow.submitPickup(own.order(), p.get("offeredPrice"), riderAnswers,
                p.get("verificationImages"), updatedAnswers);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        m.put("status", result.get("status"));
        return m;
    }

    /** markPayoutPaidByExecutive(orderId, reference?): the executive paid the customer. */
    public Map<String, Object> markPayoutPaid(HttpServletRequest request, String orderId, JsonNode reference) {
        Own own = requireOwnOrder(request, orderId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        m.put("payout", workflow.markPayoutPaid(own.order(), own.actor(), reference));
        return m;
    }

    /** The signed-in executive and one of THEIR orders; anything else is refused. */
    private Own requireOwnOrder(HttpServletRequest request, String orderId) {
        Rider executive = executives.currentExecutive(request).orElseThrow(ActionException::unauthorized);
        CustomerOrder order = JsText.truthy(orderId) ? orders.findById(orderId).orElse(null) : null;
        if (order == null || !executive.getId().equals(order.getRiderId())) {
            throw ActionException.forbidden(NOT_YOUR_ORDER);
        }
        return new Own(executive, order, new Actor(Roles.FIELD_EXECUTIVE, executive.getId(), executive.getName()));
    }
}
