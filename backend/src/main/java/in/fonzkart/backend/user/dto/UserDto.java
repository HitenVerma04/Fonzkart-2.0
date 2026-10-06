package in.fonzkart.backend.user.dto;

import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.user.entity.User;
import java.util.Arrays;
import java.util.List;

/**
 * A "User" row as the Next.js app returns it (Prisma field order, dates as ISO strings) EXCEPT that
 * {@code passwordHash}, {@code resetToken} and {@code resetTokenExpiry} are never included.
 * (Several original server actions, e.g. getAdmins(), send these to the browser; that is not reproduced.)
 */
public record UserDto(String id, String name, String email, String createdAt, String updatedAt, String role,
                      String phone, String cityId, List<String> pincodes, String managerId,
                      String relationshipManagerId) {

    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getName(), u.getEmail(), JsDates.toIsoString(u.getCreatedAt()),
                JsDates.toIsoString(u.getUpdatedAt()), u.getRole(), u.getPhone(), u.getCityId(),
                u.getPincodes() == null ? List.of() : Arrays.asList(u.getPincodes()), u.getManagerId(),
                u.getRelationshipManagerId());
    }
}
