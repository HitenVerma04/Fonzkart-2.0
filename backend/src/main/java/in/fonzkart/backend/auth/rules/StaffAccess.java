package in.fonzkart.backend.auth.rules;

import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.city.entity.City;
import in.fonzkart.backend.city.repository.CityRepository;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Authorization for staff operations — the same rules as the website's lib/staff-access.ts. Being signed in, or being
 * allowed into the staff panel ({@link AccessRules#isAdmin}, true for every staff role), does not make someone an
 * administrator: every sensitive operation names the roles it allows. The role is read from the database on every
 * call (with the super-admin / forced-user email overrides) instead of being trusted from the 7-day session cookie.
 * <ul>
 *   <li>{@link #ADMINS}: grant/revoke ADMIN, ZONAL_HEAD, RELATIONSHIP_MANAGER; user directory; zonal heads; pricing
 *       rules; landing-page settings; everything below without limits.</li>
 *   <li>{@link #PARTNER_MANAGERS} (+ zonal heads, relationship managers): the Partners page — register partners,
 *       grant PARTNER to an ordinary account, reassign partners (zonal heads only inside their cities).</li>
 *   <li>{@link #RIDER_MANAGERS} (+ zonal heads, partners): the Field Executives page — add/remove riders and grant
 *       FIELD_EXECUTIVE to an ordinary account, limited to their own team.</li>
 *   <li>{@link #CITY_STAFF} (+ zonal heads): the Cities page, limited to their own cities ({@code CityAccess}).</li>
 * </ul>
 */
@Component
public class StaffAccess {

    public static final String FORBIDDEN_ROLE = "Forbidden: Admin access required";
    public static final String FORBIDDEN_SCOPE = "Forbidden: Outside your assigned cities";
    public static final String FORBIDDEN_TEAM = "Forbidden: Outside your team";
    public static final String FORBIDDEN_TARGET = "Forbidden: Cannot change this user's role";

    public static final List<String> ADMINS = List.of(Roles.SUPER_ADMIN, Roles.ADMIN);
    public static final List<String> CITY_STAFF = List.of(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.ZONAL_HEAD);
    public static final List<String> PARTNER_MANAGERS =
            List.of(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.ZONAL_HEAD, Roles.RELATIONSHIP_MANAGER);
    public static final List<String> RIDER_MANAGERS = List.of(Roles.SUPER_ADMIN, Roles.ADMIN, Roles.ZONAL_HEAD, Roles.PARTNER);

    /** The signed-in user as stored now, with their effective role. */
    public record Staff(User user, String role) {
        public String id() {
            return user.getId();
        }

        public boolean isAdmin() {
            return ADMINS.contains(role);
        }

        public boolean isZonalHead() {
            return Roles.ZONAL_HEAD.equals(role);
        }

        public boolean isPartner() {
            return Roles.PARTNER.equals(role);
        }
    }

    private final UserRepository users;
    private final CityRepository cities;
    private final AccessRules rules;

    public StaffAccess(UserRepository users, CityRepository cities, AccessRules rules) {
        this.users = users;
        this.cities = cities;
        this.rules = rules;
    }

    public Optional<Staff> current(Optional<SessionPayload> session) {
        String userId = session.map(SessionPayload::user).map(SessionUser::id).orElse(null);
        return userId == null ? Optional.empty() : users.findById(userId).map(u -> new Staff(u, effectiveRole(u)));
    }

    public boolean hasRole(Optional<SessionPayload> session, Collection<String> roles) {
        return current(session).map(s -> roles.contains(s.role())).orElse(false);
    }

    /** 401 without a session (or for a deleted account), 403 for any role not listed. */
    public Staff requireRole(Optional<SessionPayload> session, Collection<String> roles) {
        return requireRole(session, roles, FORBIDDEN_ROLE);
    }

    public Staff requireRole(Optional<SessionPayload> session, Collection<String> roles, String forbiddenMessage) {
        Staff staff = current(session).orElseThrow(ActionException::unauthorized);
        if (!roles.contains(staff.role())) {
            throw ActionException.forbidden(forbiddenMessage);
        }
        return staff;
    }

    /**
     * Admins may change anyone's role. Anyone else may only turn an ordinary account (USER, or UNVERIFIED) into
     * {@code grantedRole}, or re-grant a role it already has — never change another staff member's role.
     */
    public void requireAssignableTarget(Staff staff, User target, String grantedRole) {
        if (staff.isAdmin()) {
            return;
        }
        String role = effectiveRole(target);
        if (!(Roles.USER.equals(role) || Roles.UNVERIFIED.equals(role) || grantedRole.equals(role))) {
            throw ActionException.forbidden(FORBIDDEN_TARGET);
        }
    }

    /** Cities a zonal head manages ("City"."managerId"), as listed on the partners and riders pages. */
    public List<String> zonalHeadManagedCityIds(Staff staff) {
        return cities.findByManagerId(staff.id()).stream().map(City::getId).toList();
    }

    /**
     * The partners whose riders {@code staff} manages; empty for no limit (admins). A zonal head's partners are those in
     * a city they manage or with them as manager (riders page); a partner's team is their own.
     */
    public Optional<List<String>> riderTeamPartnerIds(Staff staff) {
        if (staff.isAdmin()) {
            return Optional.empty();
        }
        if (staff.isPartner()) {
            return Optional.of(List.of(staff.id()));
        }
        if (!staff.isZonalHead()) {
            return Optional.of(List.of());
        }
        List<String> managed = zonalHeadManagedCityIds(staff);
        List<User> partners = managed.isEmpty()
                ? users.findByManagerIdAndRole(staff.id(), Roles.PARTNER)
                : users.findPartnersForZonalHeadUnordered(Roles.PARTNER, managed, staff.id());
        return Optional.of(partners.stream().map(User::getId).toList());
    }

    private String effectiveRole(User user) {
        return rules.isSuperAdminEmail(user.getEmail()) ? Roles.SUPER_ADMIN
                : rules.isForcedUserEmail(user.getEmail()) ? Roles.USER
                : user.getRole();
    }
}
