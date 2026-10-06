package in.fonzkart.backend.order.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * READ-ONLY mapping of the existing Prisma table {@code "Order"}. The order domain is not migrated; this exists only
 * so user-management views (riders page, relationship-manager dashboard) can show orders as the original does.
 */
@Entity(name = "OrderRecord")
@Immutable
@Table(name = "Order")
public class OrderRecord {

    @Id
    private String id;

    private String userId;

    private String riderId;

    private String device;

    private int price;

    private String status;

    private String address;

    private Double locationLat;

    private Double locationLng;

    private String answers;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private int orderNumber;

    private String pincode;

    private Integer offeredPrice;

    private String riderAnswers;

    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] verificationImages;

    /** The partner the order is routed to (null for orders placed before routing existed). */
    private String partnerId;

    protected OrderRecord() {
    }

    public String getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getRiderId() {
        return riderId;
    }

    public String getDevice() {
        return device;
    }

    public int getPrice() {
        return price;
    }

    public String getStatus() {
        return status;
    }

    public String getAddress() {
        return address;
    }

    public Double getLocationLat() {
        return locationLat;
    }

    public Double getLocationLng() {
        return locationLng;
    }

    public String getAnswers() {
        return answers;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public int getOrderNumber() {
        return orderNumber;
    }

    public String getPincode() {
        return pincode;
    }

    public Integer getOfferedPrice() {
        return offeredPrice;
    }

    public String getRiderAnswers() {
        return riderAnswers;
    }

    public String[] getVerificationImages() {
        return verificationImages;
    }

    public String getPartnerId() {
        return partnerId;
    }
}
