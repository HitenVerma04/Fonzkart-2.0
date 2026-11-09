package in.fonzkart.backend.push;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * Maps the Prisma table {@code "PushToken"}: one phone's Expo push token, owned by a signed-in user ({@code userId})
 * or a field executive ({@code riderId}). The token is the key, so a phone that signs in as someone else moves over.
 */
@Entity
@Table(name = "PushToken")
public class PushToken {

    @Id
    private String token;

    private String userId;

    private String riderId;

    private String platform;

    private String app;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected PushToken() {
    }

    public PushToken(String token, LocalDateTime now) {
        this.token = token;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** Points this phone at its current owner (exactly one of userId and riderId). */
    public void assign(String userId, String riderId, String platform, String app, LocalDateTime now) {
        this.userId = userId;
        this.riderId = riderId;
        this.platform = platform;
        this.app = app;
        this.updatedAt = now;
    }

    public String getToken() {
        return token;
    }

    public String getUserId() {
        return userId;
    }

    public String getRiderId() {
        return riderId;
    }

    public String getPlatform() {
        return platform;
    }

    public String getApp() {
        return app;
    }
}
