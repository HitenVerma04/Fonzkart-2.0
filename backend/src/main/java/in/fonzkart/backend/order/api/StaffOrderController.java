package in.fonzkart.backend.order.api;

import com.fasterxml.jackson.databind.JsonNode;
import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.order.service.StaffOrderService;
import in.fonzkart.backend.order.service.StaffOrderService.OrdersPage;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Staff order screens (admin panel, Partner app, Admin app): app/admin/orders/page.tsx, app/api/admin/orders and the
 * order actions of actions/admin.ts. Every action checks the caller's role and that the order is in their scope.
 */
@RestController
@RequestMapping("/api/staff/orders")
public class StaffOrderController {

    private final StaffOrderService orders;
    private final SessionService sessions;

    public StaffOrderController(StaffOrderService orders, SessionService sessions) {
        this.orders = orders;
        this.sessions = sessions;
    }

    /** The Orders page: orders in the caller's scope, the executives and partners they may use, their permissions. */
    @GetMapping
    public OrdersPage ordersPage(HttpServletRequest request, @RequestParam(required = false) String riderId) {
        return orders.ordersPage(sessions.getSession(request), riderId);
    }

    @GetMapping("/unassigned-count")
    public Map<String, Object> unassignedCount(HttpServletRequest request) {
        return orders.unassignedCount(sessions.getSession(request));
    }

    /** assignPartner(orderId, partnerId): body {@code {partnerId}} */
    @PostMapping("/{id}/partner")
    public Map<String, Object> assignPartner(HttpServletRequest request, @PathVariable String id,
                                             @RequestBody(required = false) JsonNode body) {
        return orders.assignPartner(sessions.getSession(request), id, text(body, "partnerId"));
    }

    /** assignRider(orderId, riderId): body {@code {riderId}} */
    @PostMapping("/{id}/rider")
    public Map<String, Object> assignRider(HttpServletRequest request, @PathVariable String id,
                                           @RequestBody(required = false) JsonNode body) {
        return orders.assignRider(sessions.getSession(request), id, text(body, "riderId"));
    }

    /**
     * Body {@code {action: approve_verification | reject_verification | fail_order | restore_order |
     * update_hub_status | mark_payout_paid | delete_order, overridePrice?, reason?, hubStatus?, reference?}}.
     */
    @PostMapping("/{id}")
    public Map<String, Object> action(HttpServletRequest request, @PathVariable String id,
                                      @RequestBody(required = false) JsonNode body) {
        return orders.orderAction(sessions.getSession(request), id, body);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(HttpServletRequest request, @PathVariable String id) {
        return orders.deleteOrder(sessions.getSession(request), id);
    }

    /** Body {@code {action: bulk_fail | bulk_restore | bulk_hub_handover | bulk_delete, ids: [...], reason?, hubStatus?}} */
    @PostMapping("/bulk")
    public Map<String, Object> bulk(HttpServletRequest request, @RequestBody(required = false) JsonNode body) {
        return orders.bulk(sessions.getSession(request), body);
    }

    private static String text(JsonNode body, String field) {
        return body != null && body.path(field).isTextual() ? body.get(field).asText() : null;
    }
}
