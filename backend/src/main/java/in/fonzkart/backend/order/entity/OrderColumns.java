package in.fonzkart.backend.order.entity;

import java.time.LocalDateTime;

/** The "Order" columns shared by the read-only {@link OrderRecord} and the writable {@link CustomerOrder}. */
public interface OrderColumns {

    String getId();

    String getUserId();

    String getRiderId();

    String getDevice();

    int getPrice();

    String getStatus();

    String getAddress();

    Double getLocationLat();

    Double getLocationLng();

    String getAnswers();

    LocalDateTime getCreatedAt();

    /** The autoincrement order number (null only before an insert is read back). */
    Integer orderNumberValue();

    String getPincode();

    Integer getOfferedPrice();

    String getRiderAnswers();

    String[] getVerificationImages();

    String getPartnerId();
}
