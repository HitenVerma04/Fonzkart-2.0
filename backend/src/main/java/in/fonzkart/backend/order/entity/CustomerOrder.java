package in.fonzkart.backend.order.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.LocalDateTime;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

/**
 * Writable mapping of the Prisma table {@code "Order"} (prisma/schema.prisma → model Order), used by the order
 * workflow. {@link OrderRecord} stays the read-only view used by the user-management pages.
 * <p>
 * {@code orderNumber} is the database's autoincrement and is read back after insert. {@code answers} and
 * {@code riderAnswers} are JSON text, exactly as Prisma stores them; {@code updatedAt} is set on every write because
 * Prisma's {@code @updatedAt} is maintained by the client.
 */
@Entity(name = "CustomerOrder")
@DynamicUpdate
@Table(name = "Order")
public class CustomerOrder implements Persistable<String>, OrderColumns {

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

    @Generated(event = EventType.INSERT)
    @Column(insertable = false, updatable = false)
    private Integer orderNumber;

    private String pincode;

    private Integer offeredPrice;

    private String riderAnswers;

    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] verificationImages;

    private String partnerId;

    @Transient
    private boolean isNew;

    protected CustomerOrder() {
    }

    /** prisma.order.create({ data }) as db.addOrder() calls it: unspecified columns null, images empty. */
    public static CustomerOrder newOrder(String id, String userId, String device, int price, String status,
                                         String address, String pincode, Double lat, Double lng, String answers,
                                         String partnerId, LocalDateTime now) {
        CustomerOrder o = new CustomerOrder();
        o.id = id;
        o.userId = userId;
        o.device = device;
        o.price = price;
        o.status = status;
        o.address = address;
        o.pincode = pincode;
        o.locationLat = lat;
        o.locationLng = lng;
        o.answers = answers;
        o.partnerId = partnerId;
        o.createdAt = now;
        o.updatedAt = now;
        o.verificationImages = new String[0];
        o.isNew = true;
        return o;
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

    public void touch(LocalDateTime now) {
        this.updatedAt = now;
    }

    @Override
    public String getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getRiderId() {
        return riderId;
    }

    public void setRiderId(String riderId) {
        this.riderId = riderId;
    }

    public String getDevice() {
        return device;
    }

    public int getPrice() {
        return price;
    }

    public void setPrice(int price) {
        this.price = price;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

    public void setAnswers(String answers) {
        this.answers = answers;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public Integer getOrderNumber() {
        return orderNumber;
    }

    @Override
    public Integer orderNumberValue() {
        return orderNumber;
    }

    public String getPincode() {
        return pincode;
    }

    public Integer getOfferedPrice() {
        return offeredPrice;
    }

    public void setOfferedPrice(Integer offeredPrice) {
        this.offeredPrice = offeredPrice;
    }

    public String getRiderAnswers() {
        return riderAnswers;
    }

    public void setRiderAnswers(String riderAnswers) {
        this.riderAnswers = riderAnswers;
    }

    public String[] getVerificationImages() {
        return verificationImages;
    }

    public void setVerificationImages(String[] verificationImages) {
        this.verificationImages = verificationImages;
    }

    public String getPartnerId() {
        return partnerId;
    }

    public void setPartnerId(String partnerId) {
        this.partnerId = partnerId;
    }
}
