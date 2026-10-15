package in.fonzkart.backend.order.api;

import com.fasterxml.jackson.databind.JsonNode;
import in.fonzkart.backend.order.dto.AppOrderDto;
import in.fonzkart.backend.order.service.ExecutiveOrderService;
import in.fonzkart.backend.order.service.NotificationService;
import in.fonzkart.backend.rider.service.ExecutiveAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The field executive's orders (actions/executive.ts) and inbox, for the website's pickup pages and the Partner app's
 * rider mode. Identity: the executive_id token (cookie, or {@code Authorization: Bearer} from the app) or a
 * FIELD_EXECUTIVE account's session.
 */
@RestController
@RequestMapping("/api/executive")
public class ExecutiveOrderController {

    private final ExecutiveOrderService orders;
    private final NotificationService notifications;
    private final ExecutiveAuthService executives;

    public ExecutiveOrderController(ExecutiveOrderService orders, NotificationService notifications,
                                    ExecutiveAuthService executives) {
        this.orders = orders;
        this.notifications = notifications;
        this.executives = executives;
    }

    /** getExecutiveOrders() */
    @GetMapping("/orders")
    public List<AppOrderDto> orders(HttpServletRequest request) {
        return orders.getExecutiveOrders(request);
    }

    @GetMapping("/orders/{id}")
    public AppOrderDto order(HttpServletRequest request, @PathVariable String id) {
        return orders.getExecutiveOrder(request, id);
    }

    /** updateOrderStatus(orderId, status, reason?): body {@code {status, reason?}} */
    @PostMapping("/orders/{id}/status")
    public Map<String, Object> updateStatus(HttpServletRequest request, @PathVariable String id,
                                            @RequestBody(required = false) JsonNode body) {
        String status = body != null && body.path("status").isTextual() ? body.get("status").asText() : null;
        return orders.updateOrderStatus(request, id, status, body == null ? null : body.get("reason"));
    }

    /** submitVerification(orderId, {riderAnswers, verificationImages, offeredPrice, status?}) */
    @PostMapping("/orders/{id}/verification")
    public Map<String, Object> submitVerification(HttpServletRequest request, @PathVariable String id,
                                                  @RequestBody(required = false) JsonNode body) {
        return orders.submitVerification(request, id, body);
    }

    /** markPayoutPaidByExecutive(orderId, reference?): body {@code {reference?}} */
    @PostMapping("/orders/{id}/payout")
    public Map<String, Object> markPayoutPaid(HttpServletRequest request, @PathVariable String id,
                                              @RequestBody(required = false) JsonNode body) {
        return orders.markPayoutPaid(request, id, body == null ? null : body.get("reference"));
    }

    @GetMapping("/notifications")
    public Map<String, Object> notifications(HttpServletRequest request) {
        return notifications.listForRider(executives.currentExecutive(request));
    }

    @PostMapping("/notifications/{id}/read")
    public Map<String, Object> markAsRead(HttpServletRequest request, @PathVariable String id) {
        return notifications.markAsReadForRider(executives.currentExecutive(request), id);
    }

    @PostMapping("/notifications/read-all")
    public Map<String, Object> markAllAsRead(HttpServletRequest request) {
        return notifications.markAllAsReadForRider(executives.currentExecutive(request));
    }
}
