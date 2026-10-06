package in.fonzkart.backend.rider.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import in.fonzkart.backend.order.dto.OrderRecordDto;
import in.fonzkart.backend.user.dto.UserDto;
import java.util.List;

/** Response shapes for rider views. */
public final class RiderViews {

    private RiderViews() {
    }

    /** prisma.rider.findMany({ include: { partner: true, orders: true } }) */
    public record RiderWithPartnerAndOrders(@JsonUnwrapped RiderDto rider, UserDto partner, List<OrderRecordDto> orders) {
    }

    /**
     * A partner as listed for a PARTNER viewer: the page passes its own user record, which it loaded with
     * {@code include: { managedCities: true } }.
     */
    public record UserWithManagedCities(@JsonUnwrapped UserDto user,
                                        List<in.fonzkart.backend.city.dto.CityDto> managedCities) {
    }

    /**
     * app/admin/riders/page.tsx data (props of RiderManager). {@code partners} holds {@link UserDto}s, or a single
     * {@link UserWithManagedCities} when the viewer is a PARTNER.
     */
    public record RidersOverview(List<RiderWithPartnerAndOrders> riders, List<Object> partners, String currentUserRole,
                                 String currentUserId) {
    }
}
