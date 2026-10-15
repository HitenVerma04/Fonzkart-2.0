package in.fonzkart.backend.order.api;

import com.fasterxml.jackson.databind.JsonNode;
import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.order.service.CustomerOrderService;
import in.fonzkart.backend.order.service.CustomerOrderService.PlaceOrderRequest;
import in.fonzkart.backend.order.service.NotificationService;
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
 * The customer's orders and notifications (actions/orders.ts, actions/notifications.ts), for the website and the
 * Customer app. Same contract as the other migrated actions: 200 = completed; 400/401/404 = refused, with
 * {@code {"error": message}}.
 */
@RestController
@RequestMapping("/api")
public class CustomerOrderController {

    public record ServiceAreaRequest(String pincode, String phone, String address) {
    }

    private final CustomerOrderService orders;
    private final NotificationService notifications;
    private final SessionService sessions;

    public CustomerOrderController(CustomerOrderService orders, NotificationService notifications, SessionService sessions) {
        this.orders = orders;
        this.notifications = notifications;
        this.sessions = sessions;
    }

    /**
     * placeOrder(device, variant, price, address, pincode, location, answers). The price is calculated here (any
     * price sent is ignored). Body {@code {device, variant, address, pincode, location: {lat, lng} | null, answers,
     * category?}}; response {@code {success: true, id, orderNumber, price}}.
     */
    @PostMapping("/orders")
    public Map<String, Object> placeOrder(HttpServletRequest request, @RequestBody(required = false) PlaceOrderRequest r) {
        return orders.placeOrder(sessions.getSession(request), r);
    }

    /** The final quote: the price placeOrder will record for this device, variant and answers. Body {@code {device, variant, answers}}. */
    @PostMapping("/orders/quote")
    public Map<String, Object> quote(@RequestBody(required = false) PlaceOrderRequest r) {
        r = r == null ? new PlaceOrderRequest(null, null, null, null, null, null, null) : r;
        return orders.quote(r.device(), r.variant(), r.answers());
    }

    /** getUserOrders(): the caller's orders, newest first, each with {@code executive: {name, phone} | null}. */
    @GetMapping("/orders")
    public List<JsonNode> myOrders(HttpServletRequest request) {
        return orders.getUserOrders(sessions.getSession(request));
    }

    /** One of the caller's orders (the tracker). */
    @GetMapping("/orders/{id}")
    public JsonNode myOrder(HttpServletRequest request, @PathVariable String id) {
        return orders.getUserOrder(sessions.getSession(request), id);
    }

    /** requestServiceArea(pincode, phone, address) */
    @PostMapping("/orders/service-area-requests")
    public Map<String, Object> requestServiceArea(@RequestBody(required = false) ServiceAreaRequest r) {
        r = r == null ? new ServiceAreaRequest(null, null, null) : r;
        return orders.requestServiceArea(r.pincode(), r.phone(), r.address());
    }

    // ---- notifications (staff bell and the customer's inbox)

    @GetMapping("/notifications")
    public Map<String, Object> notifications(HttpServletRequest request) {
        return notifications.list(sessions.getSession(request));
    }

    @PostMapping("/notifications/{id}/read")
    public Map<String, Object> markAsRead(HttpServletRequest request, @PathVariable String id) {
        return notifications.markAsRead(sessions.getSession(request), id);
    }

    @PostMapping("/notifications/read-all")
    public Map<String, Object> markAllAsRead(HttpServletRequest request) {
        return notifications.markAllAsRead(sessions.getSession(request));
    }

    /** The admin header's "Pulse Test": a test notification for the staff member who pressed it. */
    @PostMapping("/notifications/pulse-test")
    public Map<String, Object> pulseTest(HttpServletRequest request) {
        return notifications.pulseTest(sessions.getSession(request));
    }
}
