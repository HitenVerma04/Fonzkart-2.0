package in.fonzkart.backend.user.api;

import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.user.dto.UserDto;
import in.fonzkart.backend.user.dto.UserViews.PartnersOverview;
import in.fonzkart.backend.user.dto.UserViews.StaffDirectory;
import in.fonzkart.backend.user.dto.UserViews.UserWithCity;
import in.fonzkart.backend.user.dto.UserViews.ZonalHeadWithTerritory;
import in.fonzkart.backend.city.service.CityAdminService;
import in.fonzkart.backend.user.service.PartnerAdminService;
import in.fonzkart.backend.user.service.RelationshipManagerDashboardService;
import in.fonzkart.backend.user.service.StaffDirectoryService;
import in.fonzkart.backend.user.service.StaffRoleService;
import in.fonzkart.backend.user.service.ZonalHeadAdminService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Staff and role management: actions/admin.ts (role functions) and the user operations of the admin pages
 * (admins, partners, zonal-heads). Access checks follow the explicit staff permissions ({@code StaffAccess});
 * 401/403 where the website throws 'Unauthorized' / 'Forbidden: ...' or a page redirects away.
 */
@RestController
@RequestMapping("/api/staff")
public class StaffController {

    public record EmailRequest(String email) {
    }

    public record PartnerGrantRequest(String email, String cityId, String managerId) {
    }

    public record ManagerRequest(String managerId) {
    }

    public record CreateStaffRequest(String name, String email, String phone, String password, String cityId,
                                     String managerId) {
    }

    /** Partners page "Register Partner" form; relationshipManagerId is ignored for RMs (their partners are their own). */
    public record PartnerCreateRequest(String name, String email, String phone, String password, String cityId,
                                       String managerId, String relationshipManagerId) {
    }

    public record CityRequest(String cityId) {
    }

    public record AssignmentRequest(String cityId, String managerId, String relationshipManagerId) {
    }

    private final StaffRoleService roles;
    private final StaffDirectoryService directory;
    private final PartnerAdminService partners;
    private final ZonalHeadAdminService zonalHeads;
    private final SessionService sessions;
    private final RelationshipManagerDashboardService rmDashboard;
    private final CityAdminService cityAdmin;

    public StaffController(StaffRoleService roles, StaffDirectoryService directory, PartnerAdminService partners,
                           ZonalHeadAdminService zonalHeads, SessionService sessions,
                           RelationshipManagerDashboardService rmDashboard, CityAdminService cityAdmin) {
        this.rmDashboard = rmDashboard;
        this.cityAdmin = cityAdmin;
        this.roles = roles;
        this.directory = directory;
        this.partners = partners;
        this.zonalHeads = zonalHeads;
        this.sessions = sessions;
    }

    // ---- actions/admin.ts

    /** getAdmins() */
    @GetMapping("/admins")
    public List<UserDto> getAdmins(HttpServletRequest request) {
        return roles.getAdmins(sessions.getSession(request));
    }

    /** addAdmin(email) */
    @PostMapping("/admins")
    public Map<String, Object> addAdmin(HttpServletRequest request, @RequestBody EmailRequest r) {
        return roles.grantRole(sessions.getSession(request), r.email(), Roles.ADMIN);
    }

    /** removeAdmin(email) */
    @PostMapping("/admins/remove")
    public Map<String, Object> removeAdmin(HttpServletRequest request, @RequestBody EmailRequest r) {
        return roles.removeAdmin(sessions.getSession(request), r.email());
    }

    /** addZonalHead(email) */
    @PostMapping("/zonal-heads/grant")
    public Map<String, Object> addZonalHead(HttpServletRequest request, @RequestBody EmailRequest r) {
        return roles.grantRole(sessions.getSession(request), r.email(), Roles.ZONAL_HEAD);
    }

    /** addRelationshipManager(email) */
    @PostMapping("/relationship-managers/grant")
    public Map<String, Object> addRelationshipManager(HttpServletRequest request, @RequestBody EmailRequest r) {
        return roles.grantRole(sessions.getSession(request), r.email(), Roles.RELATIONSHIP_MANAGER);
    }

    /** addPartner(email, cityId?, managerId?) */
    @PostMapping("/partners/grant")
    public Map<String, Object> addPartner(HttpServletRequest request, @RequestBody PartnerGrantRequest r) {
        return roles.addPartner(sessions.getSession(request), r.email(), r.cityId(), r.managerId());
    }

    /** removeUserRole(email) */
    @PostMapping("/roles/remove")
    public Map<String, Object> removeUserRole(HttpServletRequest request, @RequestBody EmailRequest r) {
        return roles.removeUserRole(sessions.getSession(request), r.email());
    }

    /** updatePartnerManager(partnerId, managerId) */
    @PutMapping("/partners/{partnerId}/manager")
    public Map<String, Object> updatePartnerManager(HttpServletRequest request, @PathVariable String partnerId,
                                                    @RequestBody ManagerRequest r) {
        return roles.updatePartnerManager(sessions.getSession(request), partnerId, r.managerId());
    }

    /** getPartnersManagedBy(managerId) — administrators, or a zonal head for their own id. */
    @GetMapping("/partners/managed-by/{managerId}")
    public List<UserWithCity> getPartnersManagedBy(HttpServletRequest request, @PathVariable String managerId) {
        return roles.getPartnersManagedBy(sessions.getSession(request), managerId);
    }

    // ---- app/admin/admins/page.tsx

    @GetMapping("/directory")
    public StaffDirectory directory(HttpServletRequest request) {
        return directory.directory(sessions.getSession(request));
    }

    // ---- app/admin/partners/page.tsx

    @GetMapping("/partners/overview")
    public PartnersOverview partnersOverview(HttpServletRequest request) {
        return partners.overview(sessions.getSession(request));
    }

    @PostMapping("/partners")
    public Map<String, Object> createPartner(HttpServletRequest request, @RequestBody PartnerCreateRequest r) {
        return partners.createPartner(sessions.getSession(request), r.name(), r.email(), r.phone(), r.password(),
                r.cityId(), r.managerId(), r.relationshipManagerId());
    }

    @PutMapping("/partners/{partnerId}/assignment")
    public Map<String, Object> updateAssignment(HttpServletRequest request, @PathVariable String partnerId,
                                                @RequestBody AssignmentRequest r) {
        return partners.updateAssignment(sessions.getSession(request), partnerId, r.cityId(), r.managerId(),
                r.relationshipManagerId());
    }

    // ---- app/admin/rm-dashboard/page.tsx

    @GetMapping("/rm-dashboard")
    public RelationshipManagerDashboardService.RmDashboard rmDashboard(HttpServletRequest request) {
        return rmDashboard.dashboard(sessions.getSession(request));
    }

    // ---- app/admin/zonal-heads/page.tsx

    /** "Assign" city form */
    @PostMapping("/zonal-heads/{zonalHeadId}/cities")
    public ResponseEntity<Void> assignCity(HttpServletRequest request, @PathVariable String zonalHeadId,
                                           @RequestBody CityRequest r) {
        cityAdmin.assignCityToZonalHead(sessions.getSession(request), zonalHeadId, r.cityId());
        return ResponseEntity.ok().build();
    }

    /** "x" on an assigned city */
    @DeleteMapping("/zonal-heads/{zonalHeadId}/cities/{cityId}")
    public ResponseEntity<Void> unassignCity(HttpServletRequest request, @PathVariable String zonalHeadId,
                                             @PathVariable String cityId) {
        cityAdmin.unassignCityFromZonalHead(sessions.getSession(request), zonalHeadId, cityId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/zonal-heads")
    public List<ZonalHeadWithTerritory> listZonalHeads(HttpServletRequest request) {
        return zonalHeads.list(sessions.getSession(request));
    }

    @PostMapping("/zonal-heads")
    public Map<String, Object> createZonalHead(HttpServletRequest request, @RequestBody CreateStaffRequest r) {
        return zonalHeads.create(sessions.getSession(request), r.name(), r.email(), r.phone(), r.password());
    }
}
