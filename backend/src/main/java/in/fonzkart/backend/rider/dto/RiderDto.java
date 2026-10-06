package in.fonzkart.backend.rider.dto;

import in.fonzkart.backend.rider.entity.Rider;
import in.fonzkart.backend.shared.time.JsDates;

/**
 * A "Rider" row as the Next.js app returns it, EXCEPT the plain-text {@code password}, which is never returned
 * (the original sends it to the browser with every rider list).
 */
public record RiderDto(String id, String name, String phone, String email, String status, String createdAt,
                       String updatedAt, String partnerId) {

    public static RiderDto from(Rider r) {
        return r == null ? null : new RiderDto(r.getId(), r.getName(), r.getPhone(), r.getEmail(), r.getStatus(),
                JsDates.toIsoString(r.getCreatedAt()), JsDates.toIsoString(r.getUpdatedAt()), r.getPartnerId());
    }
}
