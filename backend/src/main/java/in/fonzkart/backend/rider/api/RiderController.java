package in.fonzkart.backend.rider.api;

import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.rider.dto.RiderViews.RidersOverview;
import in.fonzkart.backend.rider.service.RiderAdminService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Field-executive (rider) administration: actions/admin.ts rider functions and app/admin/riders/page.tsx. */
@RestController
@RequestMapping("/api/riders")
public class RiderController {

    public record AddRiderRequest(String name, String phone, String email, String partnerId) {
    }

    public record PartnerRequest(String partnerId) {
    }

    public record EmailRequest(String email) {
    }

    private final RiderAdminService riders;
    private final SessionService sessions;

    public RiderController(RiderAdminService riders, SessionService sessions) {
        this.riders = riders;
        this.sessions = sessions;
    }

    /** app/admin/riders/page.tsx data */
    @GetMapping("/overview")
    public RidersOverview overview(HttpServletRequest request) {
        return riders.overview(sessions.getSession(request));
    }

    /** addRider(name, phone, email?, partnerId?) */
    @PostMapping
    public Map<String, Object> addRider(HttpServletRequest request, @RequestBody AddRiderRequest r) {
        return riders.addRider(sessions.getSession(request), r.name(), r.phone(), r.email(), r.partnerId());
    }

    /** deleteRider(id) — id of a Rider and/or a User */
    @DeleteMapping("/{id}")
    public Map<String, Object> deleteRider(HttpServletRequest request, @PathVariable String id) {
        return riders.deleteRider(sessions.getSession(request), id);
    }

    /** updateRiderPartner(riderId, partnerId) */
    @PutMapping("/{riderId}/partner")
    public Map<String, Object> updateRiderPartner(HttpServletRequest request, @PathVariable String riderId,
                                                  @RequestBody PartnerRequest r) {
        return riders.updateRiderPartner(sessions.getSession(request), riderId, r.partnerId());
    }

    /** addFieldExecutive(email) */
    @PostMapping("/field-executives")
    public Map<String, Object> addFieldExecutive(HttpServletRequest request, @RequestBody EmailRequest r) {
        return riders.addFieldExecutive(sessions.getSession(request), r.email());
    }
}
