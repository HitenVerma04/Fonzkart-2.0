package in.fonzkart.backend.city.service;

import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.city.dto.CityDto;
import in.fonzkart.backend.city.dto.CityViews.CitiesOverview;
import in.fonzkart.backend.city.dto.CityViews.CityWithUsers;
import in.fonzkart.backend.city.entity.City;
import in.fonzkart.backend.city.repository.CityRepository;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.dto.UserDto;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * City management, ported from:
 * <ul>
 *   <li>app/admin/cities/page.tsx — data (including its default-city seeding on page load) and "Register Hub"</li>
 *   <li>app/admin/cities/actions.ts — updateCityPincodes, toggleCityActive, updatePartnerPincodes,
 *       removePartnerFromCity, with the access rules added by the security hardening ({@link CityAccess})</li>
 *   <li>actions/admin.ts — toggleFeaturedCity, updateCityDisplayOrder</li>
 *   <li>app/admin/homepage/page.tsx and app/page.tsx — city lists</li>
 *   <li>app/admin/zonal-heads/page.tsx — assigning / unassigning cities to a zonal head</li>
 *   <li>actions/orders.ts — checkPincodeAvailability (a pure city lookup)</li>
 * </ul>
 */
@Service
public class CityAdminService {

    /** Default cities seeded by the cities page, in the original order, with their master pincode ranges. */
    private static final Map<String, String[]> DEFAULT_CITIES = new LinkedHashMap<>();

    static {
        DEFAULT_CITIES.put("Madurai", range("625", 25));
        DEFAULT_CITIES.put("Chennai", range("600", 130));
        DEFAULT_CITIES.put("Coimbatore", range("641", 60));
        DEFAULT_CITIES.put("Bangalore", range("560", 110));
    }

    private final CityRepository cities;
    private final UserRepository users;
    private final CityAccess cityAccess;

    public CityAdminService(CityRepository cities, UserRepository users, CityAccess cityAccess) {
        this.cities = cities;
        this.users = users;
        this.cityAccess = cityAccess;
    }

    // ------------------------------------------------------------------------------- cities page

    /** Cities page data. Like the original page, non-zonal-head viewers first seed the default cities. */
    public CitiesOverview overview(Optional<SessionPayload> session) {
        cityAccess.requireRole(session, CityAccess.CITY_STAFF_ROLES); // sidebar: administrators and zonal heads
        SessionUser sessionUser = session.get().user();
        Optional<User> currentUser = users.findById(sessionUser.id());
        boolean isZonalHead = currentUser.map(u -> Roles.ZONAL_HEAD.equals(u.getRole())).orElse(false);

        if (!isZonalHead) {
            seedDefaultCities();
        }

        String ownCityId = currentUser.map(User::getCityId).orElse(null);
        List<City> list = isZonalHead && truthy(ownCityId)
                ? cities.findByIdOrderByNameAsc(ownCityId)
                : cities.findAllByOrderByNameAsc();

        Map<String, List<User>> usersByCity = new LinkedHashMap<>();
        if (!list.isEmpty()) {
            for (User u : users.findByCityIdIn(list.stream().map(City::getId).toList())) {
                usersByCity.computeIfAbsent(u.getCityId(), k -> new ArrayList<>()).add(u);
            }
        }
        List<CityWithUsers> result = list.stream().map(c -> {
            List<User> cityUsers = usersByCity.getOrDefault(c.getId(), List.of());
            return new CityWithUsers(CityDto.from(c), cityUsers.stream().map(UserDto::from).toList(),
                    cityUsers.stream().filter(u -> Roles.ZONAL_HEAD.equals(u.getRole())).map(UserDto::from).toList(),
                    cityUsers.stream().filter(u -> Roles.PARTNER.equals(u.getRole())).map(UserDto::from).toList());
        }).toList();
        return new CitiesOverview(result, isZonalHead);
    }

    /**
     * Cities page inline action "Register Hub": upsert by name ({ update: { isActive: true }, create: { name, isActive: true } }).
     * Only SUPER_ADMIN, ADMIN and ZONAL_HEAD — the roles the page is meant for — may call it.
     */
    public void registerHub(Optional<SessionPayload> session, String name) {
        cityAccess.requireRole(session, CityAccess.CITY_STAFF_ROLES);
        if (!truthy(name)) {
            return;
        }
        LocalDateTime now = JsDates.nowUtc();
        if (cities.activateByName(name, now) == 0) {
            cities.saveAndFlush(City.newCity(Cuid.next(), name, true, new String[0], now));
        }
    }

    private void seedDefaultCities() {
        for (Map.Entry<String, String[]> e : DEFAULT_CITIES.entrySet()) {
            Optional<City> existing = cities.findByName(e.getKey());
            LocalDateTime now = JsDates.nowUtc();
            if (existing.isEmpty()) {
                cities.saveAndFlush(City.newCity(Cuid.next(), e.getKey(), true, e.getValue(), now));
            } else if (existing.get().getPincodes() == null || existing.get().getPincodes().length == 0) {
                cities.updatePincodes(existing.get().getId(), e.getValue(), now);
            }
        }
    }

    // ------------------------------------------------------- app/admin/cities/actions.ts (CityAccess)

    public void updateCityPincodes(Optional<SessionPayload> session, String cityId, List<String> pincodes) {
        cityAccess.requireCity(session, cityId);
        requireUpdated(cities.updatePincodes(cityId, array(pincodes), JsDates.nowUtc()));
    }

    /** The page hides this control from zonal heads ("Safety Lock"): admins only. */
    public void toggleCityActive(Optional<SessionPayload> session, String cityId, boolean isActive) {
        cityAccess.requireRole(session, CityAccess.CITY_ADMIN_ROLES);
        requireUpdated(cities.updateActive(cityId, isActive, JsDates.nowUtc()));
    }

    public void updatePartnerPincodes(Optional<SessionPayload> session, String partnerId, List<String> pincodes) {
        cityAccess.requirePartner(session, partnerId);
        requireUpdated(users.updatePincodesById(partnerId, array(pincodes), JsDates.nowUtc()));
    }

    public void removePartnerFromCity(Optional<SessionPayload> session, String partnerId) {
        cityAccess.requirePartner(session, partnerId);
        requireUpdated(users.clearCityAndPincodesById(partnerId, new String[0], JsDates.nowUtc()));
    }

    // -------------------------------------------------------------------- actions/admin.ts (homepage)

    public Map<String, Object> toggleFeaturedCity(Optional<SessionPayload> session, String id, boolean isFeatured) {
        cityAccess.requireRole(session, CityAccess.CITY_ADMIN_ROLES);
        requireUpdated(cities.updateFeatured(id, isFeatured, JsDates.nowUtc()));
        return Map.of("success", true);
    }

    /** updateCityDisplayOrder(id, order): parseInt(order.toString()); NaN makes the original's update fail. */
    public Map<String, Object> updateCityDisplayOrder(Optional<SessionPayload> session, String id, Object order) {
        cityAccess.requireRole(session, CityAccess.CITY_ADMIN_ROLES);
        Integer displayOrder = JsText.parseInt(order);
        if (displayOrder == null) {
            throw new ActionException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "Invalid value for displayOrder");
        }
        requireUpdated(cities.updateDisplayOrder(id, displayOrder, JsDates.nowUtc()));
        return Map.of("success", true);
    }

    /** app/admin/homepage/page.tsx: active cities ordered featured first, then display order, then name. */
    public List<CityDto> homepageCities(Optional<SessionPayload> session) {
        cityAccess.requireRole(session, CityAccess.CITY_ADMIN_ROLES);
        return cities.findByIsActiveTrueOrderByIsFeaturedDescDisplayOrderAscNameAsc().stream().map(CityDto::from).toList();
    }

    /** app/page.tsx: names of active cities in the same order (public). */
    public List<String> activeCityNames() {
        return cities.findByIsActiveTrueOrderByIsFeaturedDescDisplayOrderAscNameAsc().stream().map(City::getName).toList();
    }

    /** app/admin/zonal-heads/page.tsx: all active cities by name (choices for assignment). */
    public List<CityDto> activeCities(Optional<SessionPayload> session) {
        cityAccess.requireRole(session, CityAccess.CITY_ADMIN_ROLES);
        return cities.findByIsActiveTrueOrderByNameAsc().stream().map(CityDto::from).toList();
    }

    /** actions/orders.ts → checkPincodeAvailability(pincode): an active city lists the pincode (public). */
    public boolean isPincodeServiceable(String pincode) {
        return pincode != null && cities.existsActiveWithPincode(pincode);
    }

    // ----------------------------------------------------- app/admin/zonal-heads/page.tsx inline actions

    /** "Assign" form: if a city was chosen, it becomes managed by the zonal head. */
    public void assignCityToZonalHead(Optional<SessionPayload> session, String zonalHeadId, String cityId) {
        cityAccess.requireRole(session, CityAccess.CITY_ADMIN_ROLES);
        requireZonalHead(zonalHeadId);
        if (!truthy(cityId)) {
            return;
        }
        requireUpdated(cities.updateManager(cityId, zonalHeadId, JsDates.nowUtc()));
    }

    /** The "x" on one of the zonal head's cities: the city no longer has a manager. */
    public void unassignCityFromZonalHead(Optional<SessionPayload> session, String zonalHeadId, String cityId) {
        cityAccess.requireRole(session, CityAccess.CITY_ADMIN_ROLES);
        requireZonalHead(zonalHeadId);
        // The original's button exists only for cities the zonal head currently manages.
        City city = cities.findById(cityId).filter(c -> zonalHeadId.equals(c.getManagerId()))
                .orElseThrow(ActionException::notFound);
        cities.updateManager(city.getId(), null, JsDates.nowUtc());
    }

    private void requireZonalHead(String zonalHeadId) {
        users.findById(zonalHeadId).filter(u -> Roles.ZONAL_HEAD.equals(u.getRole()))
                .orElseThrow(ActionException::notFound);
    }

    private static void requireUpdated(int rows) {
        if (rows == 0) {
            throw ActionException.recordNotFound();
        }
    }

    private static String[] array(List<String> values) {
        return values == null ? new String[0] : values.toArray(new String[0]);
    }

    /** Array.from({ length }, (_, i) => `${prefix}${String(i + 1).padStart(3, '0')}`) */
    private static String[] range(String prefix, int length) {
        String[] out = new String[length];
        for (int i = 0; i < length; i++) {
            out[i] = prefix + String.format("%03d", i + 1);
        }
        return out;
    }
}
