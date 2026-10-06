package in.fonzkart.backend.rider.service;

import static in.fonzkart.backend.shared.text.JsText.lower;
import static in.fonzkart.backend.shared.text.JsText.trim;
import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.auth.rules.AccessRules;
import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.rules.StaffAccess.Staff;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.city.entity.City;
import in.fonzkart.backend.city.repository.CityRepository;
import in.fonzkart.backend.order.dto.OrderRecordDto;
import in.fonzkart.backend.order.entity.OrderRecord;
import in.fonzkart.backend.order.repository.OrderReadRepository;
import in.fonzkart.backend.rider.dto.RiderDto;
import in.fonzkart.backend.rider.dto.RiderViews.RiderWithPartnerAndOrders;
import in.fonzkart.backend.rider.dto.RiderViews.RidersOverview;
import in.fonzkart.backend.rider.dto.RiderViews.UserWithManagedCities;
import in.fonzkart.backend.city.dto.CityDto;
import in.fonzkart.backend.rider.entity.Rider;
import in.fonzkart.backend.rider.repository.RiderRepository;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.dto.UserDto;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Field-executive (rider) administration, ported from actions/admin.ts (addRider, deleteRider, updateRiderPartner,
 * addFieldExecutive) and app/admin/riders/page.tsx. Access ({@link StaffAccess}): administrators without limits;
 * zonal heads and partners only for their own team (the riders the page shows them), and they may only grant
 * FIELD_EXECUTIVE to an ordinary account; moving riders between partners is for administrators and zonal heads.
 */
@Service
public class RiderAdminService {

    /** app/admin/riders/page.tsx: roles allowed on the page (others are redirected to /admin). */
    static final List<String> RIDERS_PAGE_ROLES = List.of(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.ZONAL_HEAD, Roles.PARTNER);

    private static final Logger log = LoggerFactory.getLogger(RiderAdminService.class);

    private final RiderRepository riders;
    private final UserRepository users;
    private final CityRepository cities;
    private final OrderReadRepository orders;
    private final AccessRules access;
    private final StaffAccess staffAccess;

    public RiderAdminService(RiderRepository riders, UserRepository users, CityRepository cities,
                             OrderReadRepository orders, AccessRules access, StaffAccess staffAccess) {
        this.riders = riders;
        this.users = users;
        this.cities = cities;
        this.orders = orders;
        this.access = access;
        this.staffAccess = staffAccess;
    }

    /** app/admin/riders/page.tsx data, scoped by the viewer's role as stored in the database. */
    public RidersOverview overview(Optional<SessionPayload> session) {
        SessionUser sessionUser = access.requireStaffPanel(session); // admin layout
        if (!RIDERS_PAGE_ROLES.contains(sessionUser.role())) {
            throw ActionException.forbidden("Forbidden");
        }
        User current = users.findById(sessionUser.id()).orElseThrow(() -> ActionException.forbidden("Forbidden"));

        List<User> partners = List.of();
        List<Object> partnerViews = null;
        List<Rider> riderList = List.of();
        String role = current.getRole();
        if (Roles.SUPER_ADMIN.equals(role) || Roles.ADMIN.equals(role)) {
            partners = users.findByRole(Roles.PARTNER);
            riderList = riders.findAllByOrderByCreatedAtDesc();
        } else if (Roles.ZONAL_HEAD.equals(role)) {
            List<String> managedCityIds = cities.findByManagerId(current.getId()).stream().map(City::getId).toList();
            partners = managedCityIds.isEmpty()
                    ? users.findByManagerIdAndRole(current.getId(), Roles.PARTNER)
                    : users.findPartnersForZonalHeadUnordered(Roles.PARTNER, managedCityIds, current.getId());
            List<String> partnerIds = partners.stream().map(User::getId).toList();
            riderList = partnerIds.isEmpty() ? List.of() : riders.findByPartnerIdInOrderByCreatedAtDesc(partnerIds);
        } else if (Roles.PARTNER.equals(role)) {
            partners = List.of(current);
            partnerViews = List.of(new UserWithManagedCities(UserDto.from(current),
                    cities.findByManagerId(current.getId()).stream().map(CityDto::from).toList()));
            riderList = riders.findByPartnerIdOrderByCreatedAtDesc(current.getId());
        }

        if (partnerViews == null) {
            partnerViews = partners.stream().map(u -> (Object) UserDto.from(u)).toList();
        }
        return new RidersOverview(withPartnerAndOrders(riderList), partnerViews,
                role, current.getId());
    }

    /** addRider(name, phone, email?, partnerId?): admins any partner, zonal heads their partners or none, partners themselves. */
    public Map<String, Object> addRider(Optional<SessionPayload> session, String name, String phone, String email,
                                        String partnerId) {
        Staff staff = staffAccess.requireRole(session, StaffAccess.RIDER_MANAGERS);
        Optional<List<String>> team = staffAccess.riderTeamPartnerIds(staff);
        if (team.isPresent() && !(truthy(partnerId) ? team.get().contains(partnerId) : staff.isZonalHead())) {
            throw ActionException.forbidden(StaffAccess.FORBIDDEN_TEAM);
        }
        riders.saveAndFlush(Rider.newRider(UUID.randomUUID().toString(), name, phone, truthy(email) ? email : null,
                "available", null, truthy(partnerId) ? partnerId : null, JsDates.nowUtc()));
        return Map.of("success", true);
    }

    /**
     * deleteRider(id): the id may belong to a User (role reset to USER) and/or a Rider (deleted; its orders keep
     * existing with riderId = NULL). Succeeds if either happened. Zonal heads and partners: only a rider of their own
     * team, and only if an account with the same id is an ordinary or field-executive account.
     */
    public Map<String, Object> deleteRider(Optional<SessionPayload> session, String id) {
        Staff staff = staffAccess.requireRole(session, StaffAccess.RIDER_MANAGERS);
        Optional<List<String>> team = staffAccess.riderTeamPartnerIds(staff);
        if (team.isPresent()) {
            String partnerId = riders.findById(id).map(Rider::getPartnerId).orElse(null);
            if (partnerId == null || !team.get().contains(partnerId)) {
                throw ActionException.forbidden(StaffAccess.FORBIDDEN_TEAM);
            }
            users.findById(id).ifPresent(account -> staffAccess.requireAssignableTarget(staff, account, Roles.FIELD_EXECUTIVE));
        }
        boolean userReset = false;
        boolean riderDeleted = false;
        try {
            if (users.findById(id).isPresent()) {
                users.updateRoleById(id, Roles.USER, JsDates.nowUtc());
                userReset = true;
            }
            try {
                riderDeleted = riders.deleteRiderById(id) > 0;
            } catch (RuntimeException riderError) {
                log.warn("[RoleMgmt] Could not delete Rider record {}, but role was reset if User existed.", id);
            }
            if (!riderDeleted) {
                log.warn("[RoleMgmt] Could not delete Rider record {} (not found).", id);
            }
            if (userReset || riderDeleted) {
                return Map.of("success", true);
            }
            return failure("Record not found in Users or Riders");
        } catch (RuntimeException e) {
            log.error("deleteRider failure:", e);
            return failure(String.valueOf(e.getMessage()));
        }
    }

    /** updateRiderPartner(riderId, partnerId): admins any rider; zonal heads a rider of their team, to their partner or none. */
    public Map<String, Object> updateRiderPartner(Optional<SessionPayload> session, String riderId, String partnerId) {
        Staff staff = staffAccess.requireRole(session, List.of(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.ZONAL_HEAD));
        Optional<List<String>> team = staffAccess.riderTeamPartnerIds(staff);
        if (team.isPresent()) {
            String current = riders.findById(riderId).map(Rider::getPartnerId).orElse(null);
            if (current == null || !team.get().contains(current) || (truthy(partnerId) && !team.get().contains(partnerId))) {
                throw ActionException.forbidden(StaffAccess.FORBIDDEN_TEAM);
            }
        }
        if (riders.updatePartner(riderId, partnerId, JsDates.nowUtc()) == 0) {
            throw ActionException.recordNotFound();
        }
        return Map.of("success", true);
    }

    /**
     * addFieldExecutive(email): grants FIELD_EXECUTIVE and keeps a matching Rider record (by phone) in sync; a
     * PARTNER granting it becomes the rider's partner. Administrators, zonal heads and partners (Users and Field
     * Executives pages); non-administrators only for an ordinary account.
     */
    public Map<String, Object> addFieldExecutive(Optional<SessionPayload> session, String email) {
        Staff staff = staffAccess.requireRole(session, StaffAccess.RIDER_MANAGERS,
                "Forbidden: Insufficient privileges to grant executive access");
        Optional<User> found = users.findUserByEmail(lower(trim(email)));
        if (found.isEmpty()) {
            return failure("User not found. They must register first.");
        }
        User user = found.get();
        staffAccess.requireAssignableTarget(staff, user, Roles.FIELD_EXECUTIVE);
        users.updateRoleById(user.getId(), Roles.FIELD_EXECUTIVE, JsDates.nowUtc());

        if (truthy(user.getPhone())) {
            Optional<Rider> existing = riders.findFirstByPhone(user.getPhone());
            boolean grantedByPartner = staff.isPartner();
            if (existing.isEmpty()) {
                log.info("[RoleMgmt] Synchronizing: Creating Rider record for {} ({})", user.getName(), user.getPhone());
                riders.saveAndFlush(Rider.newRider(Cuid.next(), user.getName(), user.getPhone(), user.getEmail(),
                        "available", null, grantedByPartner ? staff.id() : null, JsDates.nowUtc()));
            } else if (grantedByPartner && existing.get().getPartnerId() == null) {
                riders.updatePartner(existing.get().getId(), staff.id(), JsDates.nowUtc());
            }
        }
        return Map.of("success", true);
    }

    /** All riders, newest first (app/admin/admins/page.tsx). */
    public List<RiderDto> allRiders() {
        return riders.findAllByOrderByCreatedAtDesc().stream().map(RiderDto::from).toList();
    }

    private List<RiderWithPartnerAndOrders> withPartnerAndOrders(List<Rider> riderList) {
        if (riderList.isEmpty()) {
            return List.of();
        }
        Map<String, User> partnersById = users.findAllById(riderList.stream().map(Rider::getPartnerId)
                        .filter(p -> p != null).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        Map<String, List<OrderRecordDto>> ordersByRider = new HashMap<>();
        for (OrderRecord o : orders.findByRiderIdIn(riderList.stream().map(Rider::getId).toList())) {
            ordersByRider.computeIfAbsent(o.getRiderId(), k -> new ArrayList<>()).add(OrderRecordDto.from(o));
        }
        return riderList.stream().map(r -> new RiderWithPartnerAndOrders(RiderDto.from(r),
                        r.getPartnerId() == null ? null : UserDto.from(partnersById.get(r.getPartnerId())),
                        ordersByRider.getOrDefault(r.getId(), List.of())))
                .toList();
    }

    private static Map<String, Object> failure(String error) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", false);
        m.put("error", error);
        return m;
    }
}
