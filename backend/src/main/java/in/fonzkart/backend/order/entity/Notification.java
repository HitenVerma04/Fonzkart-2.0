package in.fonzkart.backend.order.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.LocalDateTime;
import org.springframework.data.domain.Persistable;

/**
 * Maps the Prisma table {@code "Notification"}: addressed to a user ({@code userId}), a role ({@code role}), an
 * executive ({@code riderId}), or — none of these — everyone in the admin panel.
 */
@Entity
@Table(name = "Notification")
public class Notification implements Persistable<String> {

    @Id
    private String id;

    private String userId;

    private String role;

    private String title;

    private String message;

    private String type;

    private String orderId;

    private String riderId;

    private boolean isRead;

    private LocalDateTime createdAt;

    @Transient
    private boolean isNew;

    protected Notification() {
    }

    public static Notification create(String id, String userId, String role, String riderId, String title,
                                      String message, String type, String orderId, LocalDateTime now) {
        Notification n = new Notification();
        n.id = id;
        n.userId = userId;
        n.role = role;
        n.riderId = riderId;
        n.title = title;
        n.message = message;
        n.type = type == null ? "info" : type;
        n.orderId = orderId;
        n.isRead = false;
        n.createdAt = now;
        n.isNew = true;
        return n;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        this.isNew = false;
    }

    @Override
    public String getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getRole() {
        return role;
    }

    public String getTitle() {
        return title;
    }

    public String getMessage() {
        return message;
    }

    public String getType() {
        return type;
    }

    public String getOrderId() {
        return orderId;
    }

    public String getRiderId() {
        return riderId;
    }

    public boolean isRead() {
        return isRead;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
