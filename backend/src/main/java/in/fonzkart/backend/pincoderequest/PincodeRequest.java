package in.fonzkart.backend.pincoderequest;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Maps the Prisma table {@code "PincodeRequest"}: a partner asking to serve more pincodes. A reviewer (an admin, or
 * the zonal head of the partner's city) approves all or some of them, which adds them to the partner's pincodes, or
 * rejects the request; the partner may cancel it while it is pending.
 */
@Entity
@Table(name = "PincodeRequest")
public class PincodeRequest {

    public static final String PENDING = "PENDING";
    public static final String APPROVED = "APPROVED";
    public static final String REJECTED = "REJECTED";
    public static final String CANCELLED = "CANCELLED";

    @Id
    private String id;

    private String partnerId;

    private String cityId;

    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] pincodes;

    private String note;

    private String status;

    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] approved;

    private String reviewNote;

    private String reviewedById;

    private LocalDateTime reviewedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected PincodeRequest() {
    }

    public static PincodeRequest create(String id, String partnerId, String cityId, String[] pincodes, String note,
                                        LocalDateTime now) {
        PincodeRequest r = new PincodeRequest();
        r.id = id;
        r.partnerId = partnerId;
        r.cityId = cityId;
        r.pincodes = pincodes;
        r.note = note;
        r.status = PENDING;
        r.approved = new String[0];
        r.createdAt = now;
        r.updatedAt = now;
        return r;
    }

    /** Closes the request: APPROVED (with the pincodes added), REJECTED or CANCELLED. */
    public void close(String status, String[] approved, String reviewNote, String reviewedById, LocalDateTime now) {
        this.status = status;
        this.approved = approved;
        this.reviewNote = reviewNote;
        this.reviewedById = reviewedById;
        this.reviewedAt = now;
        this.updatedAt = now;
    }

    public String getId() {
        return id;
    }

    public String getPartnerId() {
        return partnerId;
    }

    public String getCityId() {
        return cityId;
    }

    public String[] getPincodes() {
        return pincodes == null ? new String[0] : pincodes;
    }

    public String getNote() {
        return note;
    }

    public String getStatus() {
        return status;
    }

    public String[] getApproved() {
        return approved == null ? new String[0] : approved;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
