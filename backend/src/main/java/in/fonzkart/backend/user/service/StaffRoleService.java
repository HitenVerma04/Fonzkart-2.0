package in.fonzkart.backend.user.service;

import static in.fonzkart.backend.shared.text.JsText.lower;
import static in.fonzkart.backend.shared.text.JsText.trim;
import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.auth.rules.AccessRules;
import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.rules.StaffAccess.Staff;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.city.dto.CityDto;
import in.fonzkart.backend.user.dto.UserDto;
import in.fonzkart.backend.user.dto.UserViews.UserWithCity;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.city.repository.CityRepository;
import in.fonzkart.backend.user.repository.UserRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Port of the staff/role management functions in actions/admin.ts, with the explicit permissions of
 * {@link StaffAccess}: granting or revoking ADMIN, ZONAL_HEAD and RELATIONSHIP_MANAGER is for administrators only;
 * PARTNER may also be granted by zonal heads and relationship managers (Partners page), but only to ordinary
 * accounts. Results are the original return values. Next.js cache revalidation is a frontend concern.
 */
@Service
public class StaffRoleService {

    static final String USER_NOT_FOUND = "User not found. They must register first.";

    private final UserRepository users;
    private final CityRepository cities;
    private final AccessRules access;
    private final StaffAccess staffAccess;

    public StaffRoleService(UserRepository users, CityRepository cities, AccessRules access, StaffAccess staffAccess) {
        this.users = users;
        this.cities = cities;
        this.access = access;
        this.staffAccess = staffAccess;
    }

    /** getAdmins(): administrators only; users with role ADMIN. */
    public List<UserDto> getAdmins(Optional<SessionPayload> session) {
        staffAccess.requireRole(session, StaffAccess.ADMINS);
        return users.findByRole(Roles.ADMIN).stream().map(UserDto::from).toList();
    }

    /** addAdmin(email) / addZonalHead(email) / addRelationshipManager(email): administrators only. */
    public Map<String, Object> grantRole(Optional<SessionPayload> session, String email, String role) {
        staffAccess.requireRole(session, StaffAccess.ADMINS);
        Optional<User> user = users.findUserByEmail(lower(trim(email)));
        if (user.isEmpty()) {
            return failure(USER_NOT_FOUND);
        }
        users.updateRoleById(user.get().getId(), role, JsDates.nowUtc());
        return success();
    }

    /**
     * addPartner(email, cityId?, managerId?): administrators, zonal heads and relationship managers (Partners page).
     * Non-administrators may only upgrade an ordinary account; a zonal head only into their own cities and under
     * themselves.
     */
    public Map<String, Object> addPartner(Optional<SessionPayload> session, String email, String cityId,
                                          String managerId) {
        Staff staff = staffAccess.requireRole(session, StaffAccess.PARTNER_MANAGERS);
        String cleanEmail = lower(trim(email));
        Optional<User> user = users.findUserByEmail(cleanEmail);
        if (user.isEmpty()) {
            return failure("User \"" + cleanEmail + "\" not found. They must register first.");
        }
        staffAccess.requireAssignableTarget(staff, user.get(), Roles.PARTNER);
        if (staff.isZonalHead()
                && ((truthy(cityId) && !staffAccess.zonalHeadManagedCityIds(staff).contains(cityId))
                || (truthy(managerId) && !managerId.equals(staff.id())))) {
            throw ActionException.forbidden(StaffAccess.FORBIDDEN_SCOPE);
        }
        String manager = truthy(managerId) ? managerId : null;
        if (truthy(cityId)) {
            users.updateRoleManagerAndCityById(user.get().getId(), Roles.PARTNER, manager, cityId, JsDates.nowUtc());
        } else {
            users.updateRoleAndManagerById(user.get().getId(), Roles.PARTNER, manager, JsDates.nowUtc());
        }
        // A partner brought in by a relationship manager is that RM's partner (orders, executives, routing).
        if (Roles.RELATIONSHIP_MANAGER.equals(staff.role())) {
            users.updateRelationshipManagerById(user.get().getId(), staff.id(), JsDates.nowUtc());
        }
        return success();
    }

    /** updatePartnerManager(partnerId, managerId): administrators only (no page uses it). */
    public Map<String, Object> updatePartnerManager(Optional<SessionPayload> session, String partnerId,
                                                    String managerId) {
        staffAccess.requireRole(session, StaffAccess.ADMINS);
        if (users.updateManagerById(partnerId, managerId, JsDates.nowUtc()) == 0) {
            throw ActionException.recordNotFound();
        }
        return success();
    }

    /** removeAdmin(email) */
    public Map<String, Object> removeAdmin(Optional<SessionPayload> session, String email) {
        return demoteToUser(session, email, "Cannot remove yourself from admins");
    }

    /** removeUserRole(email) */
    public Map<String, Object> removeUserRole(Optional<SessionPayload> session, String email) {
        return demoteToUser(session, email, "Cannot remove your own role");
    }

    /**
     * getPartnersManagedBy(managerId): no page uses it. Administrators may list anyone's partners; a zonal head only
     * their own.
     */
    public List<UserWithCity> getPartnersManagedBy(Optional<SessionPayload> session, String managerId) {
        Staff staff = staffAccess.requireRole(session, List.of(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.ZONAL_HEAD));
        if (staff.isZonalHead() && !staff.id().equals(managerId)) {
            throw ActionException.forbidden(StaffAccess.FORBIDDEN_SCOPE);
        }
        return users.findByManagerIdAndRole(managerId, Roles.PARTNER).stream()
                .map(u -> new UserWithCity(UserDto.from(u),
                        u.getCityId() == null ? null : cities.findById(u.getCityId()).map(CityDto::from).orElse(null)))
                .toList();
    }

    private Map<String, Object> demoteToUser(Optional<SessionPayload> session, String email, String selfMessage) {
        staffAccess.requireRole(session, StaffAccess.ADMINS);
        SessionUser current = session.get().user();
        if (current.email() != null && current.email().equals(email)) {
            return failure(selfMessage);
        }
        if (access.isProtectedSuperAdmin(email)) {
            return failure("Cannot revoke access from protected Super Admin");
        }
        // db.updateUserRole(email, 'USER'): update keyed by the exact email as given.
        if (users.updateRoleByEmail(email, Roles.USER, JsDates.nowUtc()) == 0) {
            throw ActionException.recordNotFound();
        }
        return success();
    }

    static Map<String, Object> success() {
        return Map.of("success", true);
    }

    static Map<String, Object> failure(String error) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", false);
        m.put("error", error);
        return m;
    }
}
