package in.fonzkart.backend.user.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import in.fonzkart.backend.city.dto.CityDto;
import java.util.List;

/** Response shapes for user queries that include relations (Prisma {@code include}). */
public final class UserViews {

    private UserViews() {
    }

    /** prisma.user.findMany({ include: { city: true } }) */
    public record UserWithCity(@JsonUnwrapped UserDto user, CityDto city) {
    }

    /** app/admin/partners/page.tsx: partners with { city: true, manager: true } */
    public record PartnerWithCityAndManager(@JsonUnwrapped UserDto user, CityDto city, UserDto manager,
                                            UserDto relationshipManager) {
    }

    /** app/admin/zonal-heads/page.tsx: zonal heads with managedCities and managed partners (with city) */
    public record ZonalHeadWithTerritory(@JsonUnwrapped UserDto user, List<CityDto> managedCities,
                                         List<UserWithCity> managedUsers) {
    }

    /** app/admin/admins/page.tsx: FIELD_EXECUTIVE users shown alongside riders */
    public record FieldExecutiveUser(String id, String name, String phone, String status, String partnerId) {
    }

    /**
     * app/admin/admins/page.tsx: role directory. The page shows {@code [...riders, ...fieldExecutiveUsers]} as its
     * executives list ("Rider" rows newest first, then FIELD_EXECUTIVE users).
     */
    public record StaffDirectory(List<UserDto> superAdmins, List<UserDto> admins, List<UserDto> zonalHeads,
                                 List<UserDto> relationshipManagers, List<UserDto> partners,
                                 List<in.fonzkart.backend.rider.dto.RiderDto> riders,
                                 List<FieldExecutiveUser> fieldExecutiveUsers) {
    }

    /** app/admin/partners/page.tsx: data loaded by the page */
    public record PartnersOverview(List<PartnerWithCityAndManager> partners, List<UserDto> zonalHeads,
                                   List<CityDto> availableCities, List<UserDto> relationshipManagers) {
    }

    /** app/profile/page.tsx: {@code { ...session.user, phone: dbUser.phone }} */
    public record Profile(String id, String email, String name, String role, String phone) {
    }
}
