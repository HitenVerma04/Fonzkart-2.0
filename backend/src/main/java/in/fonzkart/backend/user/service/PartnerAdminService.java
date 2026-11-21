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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
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
    private final PartnerCities partnerCities;

    public PartnerAdminService(UserRepository users, CityRepository cities, StaffAccess access,
                               PasswordHasher passwords, PartnerCities partnerCities) {
        this.users = users;
        this.cities = cities;
        this.access = access;
        this.passwords = passwords;
        this.partnerCities = partnerCities;
    }

    /**
     * The page's queries: visible partners (with city, every city they serve, manager and RM), zonal heads, cities,
     * relationship managers.
     */
    public PartnersOverview overview(Optional<SessionPayload> session) {
        Viewer viewer = viewer(session);
        List<User> visible = visiblePartners(viewer);
        Map<String, City> allCities = cities.findAll().stream().collect(Collectors.toMap(City::getId, Function.identity()));
        Map<String, List<String>> extras = partnerCities.extraCityIds(visible.stream().map(User::getId).toList());
        List<PartnerWithCityAndManager> partners = visible.stream()
                .map(p -> new PartnerWithCityAndManager(UserDto.from(p),
                        p.getCityId() == null ? null : Optional.ofNullable(allCities.get(p.getCityId())).map(CityDto::from).orElse(null),
                        p.getManagerId() == null ? null : users.findById(p.getManagerId()).map(UserDto::from).orElse(null),
                        p.getRelationshipManagerId() == null ? null
                                : users.findById(p.getRelationshipManagerId()).map(UserDto::from).orElse(null),
                        PartnerCities.merge(p.getCityId(), extras.getOrDefault(p.getId(), List.of())).stream()
                                .map(allCities::get).filter(c -> c != null).map(CityDto::from).toList()))
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

    /**
     * Inline action "create partner". Where the original silently does nothing it returns {created:false}, now with
     * an {error} saying why (missing field, account already exists, city outside a zonal head's territory).
     */
    public Map<String, Object> createPartner(Optional<SessionPayload> session, String name, String email,
                                             String phone, String password, String cityId, String managerId,
                                             String relationshipManagerId, List<String> cityIds) {
        Viewer viewer = viewer(session);
        Optional<String> problem = NewAccounts.problem(users, name, email, phone, password);
        if (problem.isPresent()) {
            return Map.of("created", false, "error", problem.get());
        }
        phone = NewAccounts.phoneOrNull(phone);
        String passwordHash = passwords.hash(password);
        // Several cities: the first is the main one (cityId when it is missing).
        List<String> chosen = cityIds == null ? List.of() : cityIds.stream().filter(id -> truthy(id)).distinct()
                .filter(id -> !viewer.isZonalHead() || viewer.managedCityIds().contains(id))
                .filter(id -> cities.existsById(id)).toList();
        if (!truthy(cityId) && !chosen.isEmpty()) {
            cityId = chosen.get(0);
        }
        String finalCityId = viewer.isZonalHead()
                ? (viewer.managedCityIds().contains(cityId) ? cityId : null)
                : (truthy(cityId) ? cityId : null);
        if (viewer.isZonalHead() && finalCityId == null) {
            return Map.of("created", false, "error", "Choose one of your own cities for this partner.");
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
        if (chosen.size() > 1 || (chosen.size() == 1 && !chosen.get(0).equals(finalCityId))) {
            partnerCities.setExtras(partner.getId(), finalCityId, chosen);
        }
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
        partnerCities.dropExtra(p.getId(), finalCityId); // the new main city is no longer an extra one
        return Map.of("updated", true);
    }

    /**
     * Sets every city a partner is responsible for. {@code mainCityId} (one of them) becomes the partner's main city;
     * without it the current main city stays when it is still chosen, otherwise the first one. A zonal head adds or
     * removes only cities they manage; the partner's other cities stay as they are. Pincodes the partner served only
     * because of a removed city are taken off their service areas, so no new orders arrive from a city they left.
     */
    public Map<String, Object> updateCities(Optional<SessionPayload> session, String partnerId, List<String> cityIds,
                                            String mainCityId) {
        Viewer viewer = viewer(session);
        User p = visiblePartners(viewer).stream().filter(u -> u.getId().equals(partnerId)).findFirst()
                .orElseThrow(ActionException::notFound);
        Map<String, City> known = cities.findAll().stream().collect(Collectors.toMap(City::getId, Function.identity()));
        List<String> requested = (cityIds == null ? List.<String>of() : cityIds).stream()
                .filter(known::containsKey).distinct().toList();
        List<String> current = partnerCities.cityIds(p);

        List<String> next = new ArrayList<>();
        if (viewer.isZonalHead()) {
            Set<String> mine = new HashSet<>(viewer.managedCityIds());
            current.stream().filter(id -> !mine.contains(id)).forEach(next::add);
            requested.stream().filter(mine::contains).filter(id -> !next.contains(id)).forEach(next::add);
            if (truthy(mainCityId) && !mine.contains(mainCityId)) {
                mainCityId = null;
            }
        } else {
            next.addAll(requested);
        }
        String main = truthy(mainCityId) && next.contains(mainCityId) ? mainCityId
                : next.contains(p.getCityId()) ? p.getCityId()
                : next.isEmpty() ? null : next.get(0);
        // A zonal head never moves a partner's main city out of another zonal head's territory.
        if (viewer.isZonalHead() && truthy(p.getCityId()) && next.contains(p.getCityId())
                && !viewer.managedCityIds().contains(p.getCityId())) {
            main = p.getCityId();
        }

        java.time.LocalDateTime now = JsDates.nowUtc();
        users.updateCityAndManagerById(p.getId(), main, p.getManagerId(), now);
        partnerCities.setExtras(p.getId(), main, next);

        int removedPincodes = 0;
        Set<String> removed = new LinkedHashSet<>(current);
        removed.removeAll(next);
        if (!removed.isEmpty() && p.getPincodes() != null && p.getPincodes().length > 0) {
            Set<String> leftBehind = pincodesOf(removed, known);
            leftBehind.removeAll(pincodesOf(next, known));
            List<String> kept = Arrays.stream(p.getPincodes()).filter(pin -> !leftBehind.contains(pin)).toList();
            removedPincodes = p.getPincodes().length - kept.size();
            if (removedPincodes > 0) {
                users.updatePincodesById(p.getId(), kept.toArray(String[]::new), now);
            }
        }
        Map<String, Object> out = new HashMap<>();
        out.put("updated", true);
        out.put("cityIds", PartnerCities.merge(main, next));
        out.put("removedPincodes", removedPincodes);
        return out;
    }

    private static Set<String> pincodesOf(Iterable<String> cityIds, Map<String, City> known) {
        Set<String> out = new HashSet<>();
        for (String id : cityIds) {
            City c = known.get(id);
            if (c != null && c.getPincodes() != null) {
                out.addAll(Arrays.asList(c.getPincodes()));
            }
        }
        return out;
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
