package in.fonzkart.backend.order.service;

import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.rules.StaffAccess.Staff;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.city.entity.City;
import in.fonzkart.backend.city.repository.CityRepository;
import in.fonzkart.backend.order.entity.CustomerOrder;
import in.fonzkart.backend.order.repository.CustomerOrderRepository;
import in.fonzkart.backend.order.repository.OrderPeopleRepository;
import in.fonzkart.backend.rider.entity.Rider;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Port of lib/order-access.ts: which orders each staff member may see and act on, and which partners and executives
 * they may assign. Every order endpoint goes through here, so what a screen shows and what the server accepts agree.
 * <pre>
 *   SUPER_ADMIN, ADMIN     every order, partner and executive
 *   ZONAL_HEAD             orders routed to a partner of their team, plus every order in their territory (pincodes of
 *                          their cities' partners, or an address naming one of their cities)
 *   RELATIONSHIP_MANAGER   orders routed to their partners plus orders not routed to any partner yet
 *   PARTNER                orders routed to them, plus unrouted orders in their pincodes; cannot re-route
 *   FIELD_EXECUTIVE        only through the executive endpoints: orders assigned to them
 * </pre>
 */
@Service
public class OrderAccess {

    public static final List<String> ADMINS = StaffAccess.ADMINS;
    public static final List<String> ORDER_STAFF =
            List.of(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.ZONAL_HEAD, Roles.RELATIONSHIP_MANAGER, Roles.PARTNER);
    public static final List<String> PARTNER_ROUTERS =
            List.of(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.ZONAL_HEAD, Roles.RELATIONSHIP_MANAGER);
    public static final List<String> PRICE_APPROVERS = ORDER_STAFF;
    public static final List<String> BULK_ORDER_STAFF = PARTNER_ROUTERS;
    public static final List<String> ORDER_DELETERS = List.of(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.ZONAL_HEAD);

    public static final String FORBIDDEN_ORDER = "Forbidden: Outside your orders";
    public static final String FORBIDDEN_ASSIGNEE = "Forbidden: Outside your partners and executives";
    public static final String ORDER_NOT_FOUND = "Order not found";
    public static final String INVALID_ORDER_STATE = "Invalid: Not possible in the order's current status";

    /** The staff member, the order and their scope, as requireOrderAccess() returns them. */
    public record OrderContext(Staff staff, CustomerOrder order, OrderScope scope) {
    }

    /**
     * @param partnerIds         partners whose orders, executives and routing this staff member handles
     * @param allUnrouted        RMs: every order not yet routed to a partner
     * @param unroutedPincodes   partners: unrouted orders in these pincodes
     * @param territoryPincodes  zonal heads: any order in these pincodes ...
     * @param territoryCityNames ... or naming one of these cities (lower case) in its address
     */
    public record OrderScope(Staff staff, boolean all, List<String> partnerIds, boolean allUnrouted,
                             List<String> unroutedPincodes, List<String> territoryPincodes,
                             List<String> territoryCityNames) {
    }

    private final StaffAccess staffAccess;
    private final OrderPeopleRepository people;
    private final UserRepository users;
    private final CityRepository cities;
    private final CustomerOrderRepository orders;

    public OrderAccess(StaffAccess staffAccess, OrderPeopleRepository people, UserRepository users,
                       CityRepository cities, CustomerOrderRepository orders) {
        this.staffAccess = staffAccess;
        this.people = people;
        this.users = users;
        this.cities = cities;
        this.orders = orders;
    }

    public OrderScope scopeFor(Staff staff) {
        OrderScope none = new OrderScope(staff, false, List.of(), false, List.of(), List.of(), List.of());
        if (staff.isAdmin()) {
            return new OrderScope(staff, true, List.of(), false, List.of(), List.of(), List.of());
        }
        if (staff.isZonalHead()) {
            List<String> cityIds = staffAccess.zonalHeadManagedCityIds(staff);
            List<String> team = staffAccess.riderTeamPartnerIds(staff).orElse(List.of());
            List<String> territoryPincodes = new ArrayList<>();
            List<String> cityNames = new ArrayList<>();
            if (!cityIds.isEmpty()) {
                for (User p : people.findPartnersInCities(cityIds)) {
                    if (p.getPincodes() != null) {
                        territoryPincodes.addAll(Arrays.asList(p.getPincodes()));
                    }
                }
                for (City c : cities.findAllById(cityIds)) {
                    cityNames.add(JsText.lower(c.getName()));
                }
            }
            return new OrderScope(staff, false, team, false, List.of(), territoryPincodes, cityNames);
        }
        if (Roles.RELATIONSHIP_MANAGER.equals(staff.role())) {
            List<String> partners = people.findPartnersOfRelationshipManager(staff.id()).stream().map(User::getId).toList();
            return new OrderScope(staff, false, partners, true, List.of(), List.of(), List.of());
        }
        if (staff.isPartner()) {
            String[] pincodes = users.findById(staff.id()).map(User::getPincodes).orElse(null);
            return new OrderScope(staff, false, List.of(staff.id()), false,
                    pincodes == null ? List.of() : Arrays.asList(pincodes), List.of(), List.of());
        }
        return none;
    }

    public static boolean inScope(OrderScope scope, String partnerId, String pincode, String address) {
        if (scope.all()) {
            return true;
        }
        if (JsText.truthy(partnerId) && scope.partnerIds().contains(partnerId)) {
            return true;
        }
        if (!JsText.truthy(partnerId)
                && (scope.allUnrouted() || (JsText.truthy(pincode) && scope.unroutedPincodes().contains(pincode)))) {
            return true;
        }
        if (JsText.truthy(pincode) && scope.territoryPincodes().contains(pincode)) {
            return true;
        }
        String lower = address == null ? null : JsText.lower(address);
        return JsText.truthy(lower) && scope.territoryCityNames().stream().anyMatch(lower::contains);
    }

    public static boolean inScope(OrderScope scope, CustomerOrder order) {
        return inScope(scope, order.getPartnerId(), order.getPincode(), order.getAddress());
    }

    /** May route orders to this partner (assign or re-assign). Partners never re-route. */
    public static boolean canRouteTo(OrderScope scope, String partnerId) {
        if (scope.staff().isPartner()) {
            return false;
        }
        return scope.all() || scope.partnerIds().contains(partnerId);
    }

    /** May give orders to this executive: admins any; others only executives of their partners. */
    public static boolean canAssignRider(OrderScope scope, Rider rider) {
        return scope.all() || (JsText.truthy(rider.getPartnerId()) && scope.partnerIds().contains(rider.getPartnerId()));
    }

    /** The signed-in staff member (one of {@code roles}), the order, and their scope; refused unless it is theirs. */
    public OrderContext requireOrderAccess(Optional<SessionPayload> session, String orderId, List<String> roles) {
        Staff staff = staffAccess.requireRole(session, roles);
        if (!JsText.truthy(orderId)) {
            throw notFound();
        }
        CustomerOrder order = orders.findById(orderId).orElseThrow(OrderAccess::notFound);
        OrderScope scope = scopeFor(staff);
        if (!inScope(scope, order)) {
            throw ActionException.forbidden(FORBIDDEN_ORDER);
        }
        return new OrderContext(staff, order, scope);
    }

    public static ActionException notFound() {
        return new ActionException(HttpStatus.NOT_FOUND, ORDER_NOT_FOUND);
    }

    /** "Invalid: ..." errors: HTTP 400, as httpStatusFor() maps them. */
    public static ActionException invalid(String message) {
        return new ActionException(HttpStatus.BAD_REQUEST, message);
    }

    public static void requireStatus(boolean ok) {
        if (!ok) {
            throw invalid(INVALID_ORDER_STATE);
        }
    }
}
