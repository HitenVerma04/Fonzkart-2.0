package in.fonzkart.backend.city.entity;

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
 * Maps the existing Prisma table {@code "City"} (prisma/schema.prisma → model City).
 * Writes go through {@link in.fonzkart.backend.city.repository.CityRepository} single-statement updates that also
 * set {@code updatedAt} (Prisma's client-side {@code @updatedAt}).
 */
@Entity
@Table(name = "City")
public class City implements Persistable<String> {

    @Id
    private String id;

    private String name;

    private boolean isActive;

    /** {@code text[]}, nullable in the database (Prisma default '{}'). */
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] pincodes;

    private int displayOrder;

    private boolean isFeatured;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String managerId;

    @Transient
    private boolean isNew;

    protected City() {
    }

    /** prisma.city.create({ data: { name, isActive, pincodes } }) — other columns take their Prisma defaults. */
    public static City newCity(String id, String name, boolean isActive, String[] pincodes, LocalDateTime now) {
        City c = new City();
        c.id = id;
        c.name = name;
        c.isActive = isActive;
        c.pincodes = pincodes == null ? new String[0] : pincodes;
        c.displayOrder = 0;
        c.isFeatured = false;
        c.createdAt = now;
        c.updatedAt = now;
        c.isNew = true;
        return c;
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

    public boolean isActive() {
        return isActive;
    }

    public String[] getPincodes() {
        return pincodes;
    }

    public int getDisplayOrder() {
        return displayOrder;
    }

    public boolean isFeatured() {
        return isFeatured;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public String getManagerId() {
        return managerId;
    }
}
