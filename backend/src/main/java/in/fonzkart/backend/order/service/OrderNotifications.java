package in.fonzkart.backend.order.service;

import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.order.entity.Notification;
import in.fonzkart.backend.order.repository.NotificationRepository;
import in.fonzkart.backend.order.repository.OrderPeopleRepository;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * The notifications of lib/order-workflow.ts (notifyUsers, notifyRider, orderCaretakers) and lib/store.ts → addOrder.
 * Like the original, a failed notification is logged and never fails the order change that caused it.
 * <p>
 * {@link #notifyCustomer} is new: order updates for the customer's inbox in the Customer app ({@code order_update}).
 */
@Service
public class OrderNotifications {

    public static final String CUSTOMER_UPDATE = "order_update";

    private static final Logger log = LoggerFactory.getLogger(OrderNotifications.class);

    private final NotificationRepository notifications;
    private final OrderPeopleRepository people;
    private final UserRepository users;

    public OrderNotifications(NotificationRepository notifications, OrderPeopleRepository people, UserRepository users) {
        this.notifications = notifications;
        this.people = people;
        this.users = users;
    }

    /** notifyUsers(userIds, title, message, type, orderId): one notification per distinct id. */
    public void notifyUsers(List<String> userIds, String title, String message, String type, String orderId) {
        Set<String> ids = new LinkedHashSet<>();
        for (String id : userIds) {
            if (JsText.truthy(id)) {
                ids.add(id);
            }
        }
        try {
            for (String userId : ids) {
                notifications.save(Notification.create(Cuid.next(), userId, null, null, title, message, type, orderId,
                        JsDates.nowUtc()));
            }
        } catch (RuntimeException e) {
            log.error("Order notification failed: {}", e.getMessage());
        }
    }

    /** notifyRider(riderId, ...): nothing when there is no executive. */
    public void notifyRider(String riderId, String title, String message, String type, String orderId) {
        if (!JsText.truthy(riderId)) {
            return;
        }
        try {
            notifications.save(Notification.create(Cuid.next(), null, null, riderId, title, message, type, orderId,
                    JsDates.nowUtc()));
        } catch (RuntimeException e) {
            log.error("Rider notification failed: {}", e.getMessage());
        }
    }

    /** A broadcast to everyone with a role (addOrder's "New Order Placed" for ADMIN). */
    public void notifyRole(String role, String title, String message, String type, String orderId) {
        notifications.save(Notification.create(Cuid.next(), null, role, null, title, message, type, orderId,
                JsDates.nowUtc()));
    }

    /** An update for the customer's own inbox (Customer app). Never fails the order change. */
    public void notifyCustomer(String userId, String title, String message, String orderId) {
        if (!JsText.truthy(userId)) {
            return;
        }
        try {
            notifications.save(Notification.create(Cuid.next(), userId, null, null, title, message, CUSTOMER_UPDATE,
                    orderId, JsDates.nowUtc()));
        } catch (RuntimeException e) {
            log.error("Customer notification failed: {}", e.getMessage());
        }
    }

    /** orderCaretakers(partnerId): the partner, the partner's RM and zonal head; all RMs when unrouted. */
    public List<String> caretakers(String partnerId) {
        if (JsText.truthy(partnerId)) {
            Optional<User> partner = users.findById(partnerId);
            if (partner.isPresent()) {
                List<String> ids = new ArrayList<>();
                for (String id : new String[]{partner.get().getId(), partner.get().getRelationshipManagerId(),
                        partner.get().getManagerId()}) {
                    if (JsText.truthy(id)) {
                        ids.add(id);
                    }
                }
                return ids;
            }
        }
        return people.findByRoleIn(List.of(Roles.RELATIONSHIP_MANAGER)).stream().map(User::getId).toList();
    }

    /** adminIds(): every SUPER_ADMIN and ADMIN account. */
    public List<String> adminIds() {
        return people.findByRoleIn(List.of(Roles.SUPER_ADMIN, Roles.ADMIN)).stream().map(User::getId).toList();
    }
}
