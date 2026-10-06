package in.fonzkart.backend.user.service;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import in.fonzkart.backend.auth.rules.AccessRules;
import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.city.dto.CityDto;
import in.fonzkart.backend.city.repository.CityRepository;
import in.fonzkart.backend.order.dto.AppOrderDto;
import in.fonzkart.backend.order.entity.OrderRecord;
import in.fonzkart.backend.order.repository.OrderReadRepository;
import in.fonzkart.backend.order.service.AppOrderMapper;
import in.fonzkart.backend.rider.dto.RiderDto;
import in.fonzkart.backend.rider.entity.Rider;
import in.fonzkart.backend.rider.repository.RiderRepository;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.dto.UserDto;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Port of app/admin/rm-dashboard/page.tsx: the viewing RM's partners ("User"."relationshipManagerId", by name) with
 * riders, manager and city, the orders that belong to them (the orders routed to them; an order without a partner,
 * from before routing existed, by pincode or by one of their riders), and the unassigned / assigned / delayed (> 5 minutes)
 * subsets. Orders are read through the read-only order projection, mapped exactly like db.getAllOrders().
 * <p>
 * PRESERVED BEHAVIOUR: "unassigned" excludes status 'Completed'/'Cancelled' with capital letters, while stored
 * statuses are lower-case ('completed'), so completed unassigned orders still count — as in the original.
 * Only role RELATIONSHIP_MANAGER may view it (other roles are redirected to /login by the original).
 */
@Service
public class RelationshipManagerDashboardService {

    public record RmPartner(@JsonUnwrapped UserDto partner, List<RiderDto> riders, UserDto manager, CityDto city,
                            List<AppOrderDto> orders, List<AppOrderDto> unassignedOrders,
                            List<AppOrderDto> assignedOrders, List<AppOrderDto> delayedOrders) {
    }

    public record RmDashboard(List<RmPartner> partners, int totalDelayed) {
    }

    private final UserRepository users;
    private final RiderRepository riders;
    private final CityRepository cities;
    private final OrderReadRepository orders;
    private final AppOrderMapper orderMapper;
    private final AccessRules access;
    private final Clock clock;

    public RelationshipManagerDashboardService(UserRepository users, RiderRepository riders, CityRepository cities,
                                               OrderReadRepository orders, AppOrderMapper orderMapper,
                                               AccessRules access, Clock clock) {
        this.users = users;
        this.riders = riders;
        this.cities = cities;
        this.orders = orders;
        this.orderMapper = orderMapper;
        this.access = access;
        this.clock = clock;
    }

    public RmDashboard dashboard(Optional<SessionPayload> session) {
        SessionUser viewer = access.requireStaffPanel(session); // admin layout
        if (!Roles.RELATIONSHIP_MANAGER.equals(viewer.role())) {
            throw ActionException.forbidden("Forbidden");
        }

        List<User> partners = users.findByRoleAndRelationshipManagerIdOrderByNameAsc(Roles.PARTNER, viewer.id());

        // db.getAllOrders(): all orders, newest first, with their user
        List<OrderRecord> records = orders.findAllByOrderByCreatedAtDesc();
        Map<String, User> orderUsers = users.findAllById(records.stream().map(OrderRecord::getUserId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        List<AppOrderDto> allOrders = records.stream()
                .map(o -> orderMapper.toAppOrder(o, orderUsers.get(o.getUserId()))).toList();
        Instant now = clock.instant();

        List<RmPartner> result = partners.stream().map(partner -> {
            List<Rider> partnerRiders = riders.findByPartnerId(partner.getId());
            List<String> pincodes = partner.getPincodes() == null ? List.of() : Arrays.asList(partner.getPincodes());
            List<AppOrderDto> partnerOrders = allOrders.stream().filter(o -> isTruthy(o.partnerId())
                    ? o.partnerId().equals(partner.getId())
                    : (isTruthy(o.pincode()) && pincodes.contains(o.pincode()))
                            || (isTruthy(o.riderId()) && partnerRiders.stream().anyMatch(r -> r.getId().equals(o.riderId()))))
                    .toList();
            List<AppOrderDto> unassigned = partnerOrders.stream().filter(o -> !isTruthy(o.riderId())
                    && !"Completed".equals(o.status()) && !"Cancelled".equals(o.status())).toList();
            List<AppOrderDto> assigned = partnerOrders.stream().filter(o -> isTruthy(o.riderId())).toList();
            List<AppOrderDto> delayed = unassigned.stream()
                    .filter(o -> Duration.between(Instant.parse(o.date()), now).toMillis() / 1000.0 / 60 >= 5).toList();
            return new RmPartner(UserDto.from(partner), partnerRiders.stream().map(RiderDto::from).toList(),
                    partner.getManagerId() == null ? null : users.findById(partner.getManagerId()).map(UserDto::from).orElse(null),
                    partner.getCityId() == null ? null : cities.findById(partner.getCityId()).map(CityDto::from).orElse(null),
                    partnerOrders, unassigned, assigned, delayed);
        }).toList();

        int totalDelayed = result.stream().mapToInt(p -> p.delayedOrders().size()).sum();
        return new RmDashboard(result, totalDelayed);
    }

    private static boolean isTruthy(String s) {
        return s != null && !s.isEmpty();
    }
}
