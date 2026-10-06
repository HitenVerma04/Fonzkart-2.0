package in.fonzkart.backend.order.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

/**
 * lib/store.ts → Order (the app-level order shape produced by mapPrismaOrderToAppOrder()).
 * {@code answers}, {@code riderAnswers} and the hub fields are arbitrary JSON parsed from text columns.
 */
public record AppOrderDto(String id, Integer orderNumber, String userId, UserSummary user, String device, int price,
                          String date, String status, String address, String pincode, Location location,
                          String riderId, String partnerId, JsonNode answers, JsonNode riderAnswers, List<String> verificationImages,
                          Integer offeredPrice, JsonNode hubStatus, JsonNode hubHandoverAt, JsonNode hubReceivedBy) {

    public record UserSummary(String id, String name, String email, String phone) {
    }

    public record Location(double lat, double lng) {
    }
}
