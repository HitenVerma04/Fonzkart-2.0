package in.fonzkart.backend.city.service;

import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.rules.StaffAccess.Staff;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.repository.UserRepository;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Who may change cities and partner territories on the Cities page — the same rules as the website's
 * lib/staff-access.ts. Admins (SUPER_ADMIN, ADMIN) may act everywhere; a ZONAL_HEAD only on their own city, the
 * cities they manage, and the partners in those cities or managed by them; everyone else is rejected.
 * Roles come from {@link StaffAccess} (database role, not the session cookie).
 */
@Component
public class CityAccess {

    public static final String FORBIDDEN_ROLE = StaffAccess.FORBIDDEN_ROLE;
    public static final String FORBIDDEN_SCOPE = StaffAccess.FORBIDDEN_SCOPE;

    static final List<String> CITY_ADMIN_ROLES = StaffAccess.ADMINS;
    static final List<String> CITY_STAFF_ROLES = StaffAccess.CITY_STAFF;

    private final StaffAccess staffAccess;
    private final UserRepository users;

    public CityAccess(StaffAccess staffAccess, UserRepository users) {
        this.staffAccess = staffAccess;
        this.users = users;
    }

    Staff requireRole(Optional<SessionPayload> session, List<String> roles) {
        return staffAccess.requireRole(session, roles);
    }

    void requireCity(Optional<SessionPayload> session, String cityId) {
        Staff staff = requireRole(session, CITY_STAFF_ROLES);
        if (staff.isZonalHead() && !zonalHeadCityIds(staff).contains(cityId)) {
            throw ActionException.forbidden(FORBIDDEN_SCOPE);
        }
    }

    void requirePartner(Optional<SessionPayload> session, String partnerId) {
        Staff staff = requireRole(session, CITY_STAFF_ROLES);
        if (!staff.isZonalHead()) {
            return;
        }
        Set<String> cityIds = zonalHeadCityIds(staff);
        boolean inScope = users.findById(partnerId)
                .filter(p -> Roles.PARTNER.equals(p.getRole()))
                .filter(p -> (p.getCityId() != null && cityIds.contains(p.getCityId()))
                        || staff.id().equals(p.getManagerId()))
                .isPresent();
        if (!inScope) {
            throw ActionException.forbidden(FORBIDDEN_SCOPE);
        }
    }

    /** The zonal head's own city plus every city they manage. */
    private Set<String> zonalHeadCityIds(Staff staff) {
        Set<String> ids = new LinkedHashSet<>();
        if (truthy(staff.user().getCityId())) {
            ids.add(staff.user().getCityId());
        }
        ids.addAll(staffAccess.zonalHeadManagedCityIds(staff));
        return ids;
    }
}
