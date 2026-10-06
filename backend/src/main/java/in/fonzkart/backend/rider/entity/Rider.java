package in.fonzkart.backend.rider.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.LocalDateTime;
import org.springframework.data.domain.Persistable;

/**
 * Maps the existing Prisma table {@code "Rider"} (field executives; prisma/schema.prisma → model Rider).
 * <p>
 * {@code password} is the executive phone-login password: a bcrypt hash, or — for rows written before the security
 * hardening and not yet converted by a login or scripts/hash-rider-passwords.ts — the legacy plain text
 * ({@code RiderPasswords} accepts both). Empty or null means "needs onboarding". It is never returned by any endpoint.
 */
@Entity
@Table(name = "Rider")
public class Rider implements Persistable<String> {

    @Id
    private String id;

    private String name;

    private String phone;

    private String email;

    private String status;

    private String password;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String partnerId;

    @Transient
    private boolean isNew;

    protected Rider() {
    }

    /** prisma.rider.create(...) */
    public static Rider newRider(String id, String name, String phone, String email, String status, String password,
                                 String partnerId, LocalDateTime now) {
        Rider r = new Rider();
        r.id = id;
        r.name = name;
        r.phone = phone;
        r.email = email;
        r.status = status;
        r.password = password;
        r.partnerId = partnerId;
        r.createdAt = now;
        r.updatedAt = now;
        r.isNew = true;
        return r;
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

    public String getName() {
        return name;
    }

    public String getPhone() {
        return phone;
    }

    public String getEmail() {
        return email;
    }

    public String getStatus() {
        return status;
    }

    public String getPassword() {
        return password;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public String getPartnerId() {
        return partnerId;
    }
}
