package in.fonzkart.backend.catalog.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

/**
 * Maps the existing Prisma table {@code "Variant"} (prisma/schema.prisma → model Variant).
 */
@Entity
@Immutable
@Table(name = "Variant")
public class Variant {

    @Id
    private String id;

    private String modelId;

    private String name;

    private int basePrice;

    protected Variant() {
    }

    public String getId() {
        return id;
    }

    public String getModelId() {
        return modelId;
    }

    public String getName() {
        return name;
    }

    public int getBasePrice() {
        return basePrice;
    }
}
