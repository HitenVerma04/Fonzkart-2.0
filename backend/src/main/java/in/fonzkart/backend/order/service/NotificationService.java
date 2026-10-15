package in.fonzkart.backend.order.service;

import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.rules.StaffAccess.Staff;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.order.entity.Notification;
import in.fonzkart.backend.order.repository.NotificationRepository;
import in.fonzkart.backend.rider.entity.Rider;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.time.JsDates;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/**
 * Port of actions/notifications.ts (the admin panel bell), plus the inboxes of the apps: a customer's own
 * notifications ({@code userId}) and an executive's ({@code riderId}). Who the caller is comes from the session,
 * never from arguments.
 */
@Service
public class NotificationService {

    /** Everyone who can open the admin panel (lib/auth-utils.ts → isAdmin). */
    private static final List<String> PANEL_ROLES = List.of(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.ZONAL_HEAD,
            Roles.RELATIONSHIP_MANAGER, Roles.PARTNER, Roles.FIELD_EXECUTIVE);
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    /** A "Notification" row as Prisma returns it. */
    public record NotificationDto(String id, String userId, String role, String title, String message, String type,
                                  String orderId, String riderId, boolean isRead, String createdAt) {
        static NotificationDto from(Notification n) {
            return new NotificationDto(n.getId(), n.getUserId(), n.getRole(), n.getTitle(), n.getMessage(), n.getType(),
                    n.getOrderId(), n.getRiderId(), n.isRead(), JsDates.toIsoString(n.getCreatedAt()));
        }
    }

    private final NotificationRepository notifications;
    private final StaffAccess staffAccess;

    public NotificationService(NotificationRepository notifications, StaffAccess staffAccess) {
        this.notifications = notifications;
        this.staffAccess = staffAccess;
    }

    /** Staff: getNotifications() (latest 20). Customers: their own (latest 50). No session: none. */
    public Map<String, Object> list(Optional<SessionPayload> session) {
        try {
            Optional<Staff> me = staffAccess.current(session);
            if (me.isEmpty()) {
                return result(List.of());
            }
            Staff staff = me.get();
            List<Notification> rows = PANEL_ROLES.contains(staff.role())
                    ? notifications.findForStaff(staff.id(), staff.role(), PageRequest.of(0, 20))
                    : notifications.findForUser(staff.id(), PageRequest.of(0, 50));
            return result(rows.stream().map(NotificationDto::from).toList());
        } catch (RuntimeException e) {
            log.error("Failed to load notifications: {}", e.getMessage());
            return Map.of("success", false);
        }
    }

    public Map<String, Object> markAsRead(Optional<SessionPayload> session, String id) {
        Optional<Staff> me = staffAccess.current(session);
        if (me.isEmpty() || !JsText.truthy(id)) {
            return Map.of("success", false);
        }
        Staff staff = me.get();
        int count = PANEL_ROLES.contains(staff.role())
                ? notifications.markReadForStaff(id, staff.id(), staff.role())
                : notifications.markReadForUser(id, staff.id());
        return Map.of("success", count > 0);
    }

    public Map<String, Object> markAllAsRead(Optional<SessionPayload> session) {
        Optional<Staff> me = staffAccess.current(session);
        if (me.isEmpty()) {
            return Map.of("success", false);
        }
        Staff staff = me.get();
        if (PANEL_ROLES.contains(staff.role())) {
            notifications.markAllReadForStaff(staff.id(), staff.role());
        } else {
            notifications.markAllReadForUser(staff.id());
        }
        return Map.of("success", true);
    }

    // ------------------------------------------------------------------------------------------------ executives

    public Map<String, Object> listForRider(Optional<Rider> executive) {
        if (executive.isEmpty()) {
            return result(List.of());
        }
        return result(notifications.findForRider(executive.get().getId(), PageRequest.of(0, 50)).stream()
                .map(NotificationDto::from).toList());
    }

    public Map<String, Object> markAsReadForRider(Optional<Rider> executive, String id) {
        if (executive.isEmpty() || !JsText.truthy(id)) {
            return Map.of("success", false);
        }
        return Map.of("success", notifications.markReadForRider(id, executive.get().getId()) > 0);
    }

    public Map<String, Object> markAllAsReadForRider(Optional<Rider> executive) {
        if (executive.isEmpty()) {
            return Map.of("success", false);
        }
        notifications.markAllReadForRider(executive.get().getId());
        return Map.of("success", true);
    }

    private static Map<String, Object> result(List<NotificationDto> rows) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        m.put("notifications", rows);
        return m;
    }
}
