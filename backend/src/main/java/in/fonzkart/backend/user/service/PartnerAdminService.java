package in.fonzkart.backend.user.service;

import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.auth.password.PasswordHasher;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.city.dto.CityDto;
import in.fonzkart.backend.user.dto.UserDto;
import in.fonzkart.backend.user.dto.UserViews.PartnerWithCityAndManager;
import in.fonzkart.backend.user.dto.UserViews.PartnersOverview;
import in.fonzkart.backend.city.entity.City;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.city.repository.CityRepository;
import in.fonzkart.backend.user.repository.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Port of app/admin/partners/page.tsx: page data and its two inline server actions (create partner,
 * reassign a partner's city/manager/relationship manager), including the zonal-head scoping rules.
 * Relationship managers: a partner an RM registers is theirs, and RMs cannot move partners between RMs;
 * administrators and zonal heads choose each partner's RM (only users with role RELATIONSHIP_MANAGER).
 * Access: administrators, zonal heads and relationship managers (StaffAccess.PARTNER_MANAGERS, the roles the sidebar
 * offers this page to), by database role.
 */
@Service
public class PartnerAdminService {

    private final UserRepository users;
    private final CityRepository cities;
    private final StaffAccess access;
    private final PasswordHasher passwords;

    public PartnerAdminService(UserRepository users, CityRepository cities, StaffAccess access,
                               PasswordHasher passwords) {
        this.users = users;
        this.cities = cities;
        this.access = access;
        this.passwords = passwords;
    }

    /** The page's queries: visible partners (with city, manager and RM), zonal heads, cities, relationship managers. */
    public PartnersOverview overview(Optional<SessionPayload> session) {
        Viewer viewer = viewer(session);
        List<PartnerWithCityAndManager> partners = visiblePartners(viewer).stream()
                .map(p -> new PartnerWithCityAndManager(UserDto.from(p),
                        p.getCityId() == null ? null : cities.findById(p.getCityId()).map(CityDto::from).orElse(null),
                        p.getManagerId() == null ? null : users.findById(p.getManagerId()).map(UserDto::from).orElse(null),
                        p.getRelationshipManagerId() == null ? null
                                : users.findById(p.getRelationshipManagerId()).map(UserDto::from).orElse(null)))
                .toList();
        List<UserDto> zonalHeads = users.findByRoleOrderByNameAsc(Roles.ZONAL_HEAD).stream().map(UserDto::from).toList();
        List<City> available = viewer.isZonalHead()
                ? cities.findByIsActiveTrueAndIdInOrderByNameAsc(viewer.managedCityIds())
                : cities.findByIsActiveTrueOrderByNameAsc();
        List<UserDto> relationshipManagers = users.findByRoleOrderByNameAsc(Roles.RELATIONSHIP_MANAGER).stream()
                .map(UserDto::from).toList();
        return new PartnersOverview(partners, zonalHeads, available.stream().map(CityDto::from).toList(),
                relationshipManagers);
    }

    /** Inline action "create partner". Returns {created:false} where the original silently does nothing. */
    public Map<String, Object> createPartner(Optional<SessionPayload> session, String name, String email,
                                             String phone, String password, String cityId, String managerId,
                                             String relationshipManagerId) {
        Viewer viewer = viewer(session);
        if (!(truthy(name) && truthy(email) && truthy(password))) {
            return Map.of("created", false);
        }
        String passwordHash = passwords.hash(password);
        String finalCityId = viewer.isZonalHead()
                ? (viewer.managedCityIds().contains(cityId) ? cityId : null)
                : (truthy(cityId) ? cityId : null);
        if (viewer.isZonalHead() && finalCityId == null) {
            return Map.of("created", false);
        }
        // If a zonal head creates, they are the manager. If an admin creates, they can pick.
        String finalManagerId = viewer.isZonalHead() ? viewer.user().getId() : ("none".equals(managerId) ? null : managerId);

        User partner = User.newUser(Cuid.next(), name, email, phone, passwordHash, Roles.PARTNER, JsDates.nowUtc());
        partner.setCityId(finalCityId);
        partner.setManagerId(finalManagerId);
        partner.setRelationshipManagerId(viewer.isRelationshipManager()
                ? viewer.user().getId()
                : (isRelationshipManagerId(relationshipManagerId) ? relationshipManagerId : null));
        users.saveAndFlush(partner);
        return Map.of("created", true);
    }

    /** Inline action "update assignment" for a partner shown on the page. */
    public Map<String, Object> updateAssignment(Optional<SessionPayload> session, String partnerId, String newCityId,
                                                String managerId, String relationshipManagerId) {
        Viewer viewer = viewer(session);
        // The inline action only exists for partners the page shows to this viewer.
        User p = visiblePartners(viewer).stream().filter(u -> u.getId().equals(partnerId)).findFirst()
                .orElseThrow(ActionException::notFound);

        String finalCityId = viewer.isZonalHead()
                ? (viewer.managedCityIds().contains(newCityId) ? newCityId : p.getCityId())
                : ("none".equals(newCityId) ? null : newCityId);
        String finalManagerId = viewer.isZonalHead()
                ? p.getManagerId() // Zonal heads cannot reassign managers
                : ("none".equals(managerId) ? null : managerId);

        String finalRmId = viewer.isRelationshipManager()
                ? p.getRelationshipManagerId() // RMs cannot move partners between RMs
                : "none".equals(relationshipManagerId) ? null
                : isRelationshipManagerId(relationshipManagerId) ? relationshipManagerId : p.getRelationshipManagerId();

        users.updateCityAndManagerById(p.getId(), finalCityId, finalManagerId, JsDates.nowUtc());
        users.updateRelationshipManagerById(p.getId(), finalRmId, JsDates.nowUtc());
        return Map.of("updated", true);
    }

    /** role PARTNER, and for zonal heads: cityId in managed cities OR managerId = the zonal head. */
    private List<User> visiblePartners(Viewer viewer) {
        if (!viewer.isZonalHead()) {
            return users.findByRoleOrderByNameAsc(Roles.PARTNER);
        }
        return viewer.managedCityIds().isEmpty()
                ? users.findByManagerIdAndRoleOrderByNameAsc(viewer.user().getId(), Roles.PARTNER)
                : users.findPartnersForZonalHead(Roles.PARTNER, viewer.managedCityIds(), viewer.user().getId());
    }

    private boolean isRelationshipManagerId(String id) {
        return truthy(id) && users.findById(id).map(u -> Roles.RELATIONSHIP_MANAGER.equals(u.getRole())).orElse(false);
    }

    private Viewer viewer(Optional<SessionPayload> session) {
        User current = access.requireRole(session, StaffAccess.PARTNER_MANAGERS).user();
        List<String> managed = cities.findByManagerId(current.getId()).stream().map(City::getId).toList();
        return new Viewer(current, Roles.ZONAL_HEAD.equals(current.getRole()), managed);
    }

    private record Viewer(User user, boolean isZonalHead, List<String> managedCityIds) {
        Viewer {
            managedCityIds = isZonalHead ? managedCityIds : List.of();
        }

        boolean isRelationshipManager() {
            return Roles.RELATIONSHIP_MANAGER.equals(user.getRole());
        }
    }
}
