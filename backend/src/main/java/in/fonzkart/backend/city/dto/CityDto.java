package in.fonzkart.backend.city.dto;

import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.city.entity.City;
import java.util.Arrays;
import java.util.List;

/** A "City" row as Prisma returns it (used where the original includes a user's city). */
public record CityDto(String id, String name, boolean isActive, List<String> pincodes, int displayOrder,
                      boolean isFeatured, String createdAt, String updatedAt, String managerId) {

    public static CityDto from(City c) {
        return c == null ? null : new CityDto(c.getId(), c.getName(), c.isActive(),
                c.getPincodes() == null ? List.of() : Arrays.asList(c.getPincodes()), c.getDisplayOrder(),
                c.isFeatured(), JsDates.toIsoString(c.getCreatedAt()), JsDates.toIsoString(c.getUpdatedAt()),
                c.getManagerId());
    }
}
