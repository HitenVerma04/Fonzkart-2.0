package in.fonzkart.backend.catalog.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

/**
 * Maps the existing Prisma table {@code "Model"} (prisma/schema.prisma → model Model).
 * Named DeviceModel in Java to avoid confusion with framework "model" types.
 */
@Entity(name = "DeviceModel")
@Immutable
@Table(name = "Model")
public class DeviceModel {

    @Id
    private String id;

    private String brandId;

    private String name;

    private String img;

    private String category;

    private int priority;

    protected DeviceModel() {
    }

    public String getId() {
        return id;
    }

    public String getBrandId() {
        return brandId;
    }

    public String getName() {
        return name;
    }

    public String getImg() {
        return img;
    }

    public String getCategory() {
        return category;
    }

    public int getPriority() {
        return priority;
    }
}
