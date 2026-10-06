package in.fonzkart.backend.city.api;

import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.city.dto.CityDto;
import in.fonzkart.backend.city.dto.CityViews.CitiesOverview;
import in.fonzkart.backend.city.service.CityAdminService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * City management. Same response contract as the other migrated actions: 200 = completed (empty body where the
 * original returns nothing), 401/403/404/409/500 = the original threw or the page redirected away.
 */
@RestController
@RequestMapping("/api/cities")
public class CityController {

    public record HubRequest(String cityName) {
    }

    public record PincodesRequest(List<String> pincodes) {
    }

    public record ActiveRequest(boolean isActive) {
    }

    public record FeaturedRequest(boolean isFeatured) {
    }

    public record DisplayOrderRequest(Object order) {
    }

    private final CityAdminService cities;
    private final SessionService sessions;

    public CityController(CityAdminService cities, SessionService sessions) {
        this.cities = cities;
        this.sessions = sessions;
    }

    // ---- app/admin/cities/page.tsx

    @GetMapping("/overview")
    public CitiesOverview overview(HttpServletRequest request) {
        return cities.overview(sessions.getSession(request));
    }

    /** "Register Hub" inline action */
    @PostMapping("/hubs")
    public ResponseEntity<Void> registerHub(HttpServletRequest request, @RequestBody HubRequest r) {
        cities.registerHub(sessions.getSession(request), r.cityName());
        return ResponseEntity.ok().build();
    }

    // ---- app/admin/cities/actions.ts: admins everywhere, zonal heads only in their own cities (CityAccess)

    @PutMapping("/{cityId}/pincodes")
    public ResponseEntity<Void> updateCityPincodes(HttpServletRequest request, @PathVariable String cityId,
                                                   @RequestBody PincodesRequest r) {
        cities.updateCityPincodes(sessions.getSession(request), cityId, r.pincodes());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{cityId}/active")
    public ResponseEntity<Void> toggleCityActive(HttpServletRequest request, @PathVariable String cityId,
                                                 @RequestBody ActiveRequest r) {
        cities.toggleCityActive(sessions.getSession(request), cityId, r.isActive());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/partners/{partnerId}/pincodes")
    public ResponseEntity<Void> updatePartnerPincodes(HttpServletRequest request, @PathVariable String partnerId,
                                                      @RequestBody PincodesRequest r) {
        cities.updatePartnerPincodes(sessions.getSession(request), partnerId, r.pincodes());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/partners/{partnerId}/remove")
    public ResponseEntity<Void> removePartnerFromCity(HttpServletRequest request, @PathVariable String partnerId) {
        cities.removePartnerFromCity(sessions.getSession(request), partnerId);
        return ResponseEntity.ok().build();
    }

    // ---- actions/admin.ts + app/admin/homepage/page.tsx + app/page.tsx

    @PutMapping("/{cityId}/featured")
    public Map<String, Object> toggleFeaturedCity(HttpServletRequest request, @PathVariable String cityId,
                                                  @RequestBody FeaturedRequest r) {
        return cities.toggleFeaturedCity(sessions.getSession(request), cityId, r.isFeatured());
    }

    @PutMapping("/{cityId}/display-order")
    public Map<String, Object> updateCityDisplayOrder(HttpServletRequest request, @PathVariable String cityId,
                                                      @RequestBody DisplayOrderRequest r) {
        return cities.updateCityDisplayOrder(sessions.getSession(request), cityId, r.order());
    }

    /** Admin homepage settings: active cities, featured first */
    @GetMapping("/homepage")
    public List<CityDto> homepageCities(HttpServletRequest request) {
        return cities.homepageCities(sessions.getSession(request));
    }

    /** Public home page: names of active cities, featured first */
    @GetMapping("/active-names")
    public List<String> activeCityNames() {
        return cities.activeCityNames();
    }

    /** Zonal-heads page: active cities by name */
    @GetMapping("/active")
    public List<CityDto> activeCities(HttpServletRequest request) {
        return cities.activeCities(sessions.getSession(request));
    }

    /** actions/orders.ts → checkPincodeAvailability(pincode) (public): true / false */
    @GetMapping("/pincode-availability")
    public boolean checkPincodeAvailability(@RequestParam String pincode) {
        return cities.isPincodeServiceable(pincode);
    }
}
