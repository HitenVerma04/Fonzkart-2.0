package in.fonzkart.backend.catalog.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Maps the existing Prisma table {@code "Brand"} (prisma/schema.prisma → model Brand).
 * Read-only: this backend does not write catalog data yet.
 */
@Entity
@Immutable
@Table(name = "Brand")
public class Brand {

    @Id
    private String id;

    private String name;

    private String logo;

    /** {@code text[]}, nullable in the database. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] categories;

    private int priority;

    protected Brand() {
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getLogo() {
        return logo;
    }

    public String[] getCategories() {
        return categories;
    }

    public int getPriority() {
        return priority;
    }
}
