package in.fonzkart.backend.user.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

/**
 * Maps the existing Prisma table {@code "User"} (prisma/schema.prisma → model User).
 * Relations (city, manager, managedCities, ...) are kept as plain id columns and resolved by queries.
 * Timestamps are UTC wall-clock values, like Prisma; {@code updatedAt} is set explicitly on every write
 * because Prisma's {@code @updatedAt} is maintained by the client, not the database.
 */
@Entity
@Table(name = "User")
public class User implements Persistable<String> {

    @Id
    private String id;

    private String name;

    private String email;

    private String passwordHash;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String role;

    private String phone;

    private String resetToken;

    private LocalDateTime resetTokenExpiry;

    private String cityId;

    /** {@code text[]}, nullable in the database (Prisma default '{}'). */
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] pincodes;

    private String managerId;

    /** A partner's relationship manager (role RELATIONSHIP_MANAGER). */
    private String relationshipManagerId;

    @Transient
    private boolean isNew;

    protected User() {
    }

    /**
     * A new user as Prisma's {@code user.create()} would insert it: unspecified optional columns are null,
     * {@code pincodes} gets its database default (empty array).
     */
    public static User newUser(String id, String name, String email, String phone, String passwordHash, String role,
                               LocalDateTime now) {
        User u = new User();
        u.id = id;
        u.name = name;
        u.email = email;
        u.phone = phone;
        u.passwordHash = passwordHash;
        u.role = role;
        u.createdAt = now;
        u.updatedAt = now;
        u.pincodes = new String[0];
        u.isNew = true;
        return u;
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

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public String getRole() {
        return role;
    }

    public String getPhone() {
        return phone;
    }

    public String getResetToken() {
        return resetToken;
    }

    public LocalDateTime getResetTokenExpiry() {
        return resetTokenExpiry;
    }

    public String getCityId() {
        return cityId;
    }

    public String[] getPincodes() {
        return pincodes;
    }

    public String getManagerId() {
        return managerId;
    }

    public String getRelationshipManagerId() {
        return relationshipManagerId;
    }

    public void setCityId(String cityId) {
        this.cityId = cityId;
    }

    public void setManagerId(String managerId) {
        this.managerId = managerId;
    }

    public void setRelationshipManagerId(String relationshipManagerId) {
        this.relationshipManagerId = relationshipManagerId;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public void touch(LocalDateTime now) {
        this.updatedAt = now;
    }
}
