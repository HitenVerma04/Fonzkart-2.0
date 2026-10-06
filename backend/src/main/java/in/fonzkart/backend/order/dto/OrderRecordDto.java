package in.fonzkart.backend.order.dto;

import in.fonzkart.backend.order.entity.OrderRecord;
import in.fonzkart.backend.shared.time.JsDates;
import java.util.Arrays;
import java.util.List;

/** A raw "Order" row as Prisma returns it (e.g. riders include: { orders: true }); JSON columns stay strings. */
public record OrderRecordDto(String id, String userId, String riderId, String device, int price, String status,
                             String address, Double locationLat, Double locationLng, String answers, String createdAt,
                             String updatedAt, int orderNumber, String pincode, Integer offeredPrice,
                             String riderAnswers, List<String> verificationImages, String partnerId) {

    public static OrderRecordDto from(OrderRecord o) {
        return new OrderRecordDto(o.getId(), o.getUserId(), o.getRiderId(), o.getDevice(), o.getPrice(), o.getStatus(),
                o.getAddress(), o.getLocationLat(), o.getLocationLng(), o.getAnswers(),
                JsDates.toIsoString(o.getCreatedAt()), JsDates.toIsoString(o.getUpdatedAt()), o.getOrderNumber(),
                o.getPincode(), o.getOfferedPrice(), o.getRiderAnswers(),
                o.getVerificationImages() == null ? List.of() : Arrays.asList(o.getVerificationImages()), o.getPartnerId());
    }
}
