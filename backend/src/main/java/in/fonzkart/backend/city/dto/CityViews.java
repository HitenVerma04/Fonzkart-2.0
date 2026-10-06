package in.fonzkart.backend.city.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import in.fonzkart.backend.user.dto.UserDto;
import java.util.List;

/** Response shapes for city views. */
public final class CityViews {

    private CityViews() {
    }

    /**
     * app/admin/cities/page.tsx: each city with {@code include: { users: true }} plus the zonal heads and partners the
     * page derives from those users for CityCard.
     */
    public record CityWithUsers(@JsonUnwrapped CityDto city, List<UserDto> users, List<UserDto> zonalHeads,
                                List<UserDto> partners) {
    }

    /** app/admin/cities/page.tsx data */
    public record CitiesOverview(List<CityWithUsers> cities, boolean isZonalHead) {
    }
}
