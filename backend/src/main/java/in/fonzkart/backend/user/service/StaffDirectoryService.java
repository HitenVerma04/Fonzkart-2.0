package in.fonzkart.backend.user.service;

import static in.fonzkart.backend.shared.text.JsText.lower;

import in.fonzkart.backend.auth.config.AuthProperties;
import in.fonzkart.backend.auth.rules.AccessRules;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.rider.dto.RiderDto;
import in.fonzkart.backend.rider.repository.RiderRepository;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.user.dto.UserDto;
import in.fonzkart.backend.user.dto.UserViews.FieldExecutiveUser;
import in.fonzkart.backend.user.dto.UserViews.StaffDirectory;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Port of the data loading in app/admin/admins/page.tsx ("Role Management Directory").
 * Access: administrators only (StaffAccess.ADMINS). Includes the page's side effect of demoting forced-USER
 * accounts that are still ADMIN/SUPER_ADMIN in the database.
 */
@Service
public class StaffDirectoryService {

    private static final Logger log = LoggerFactory.getLogger(StaffDirectoryService.class);

    private final UserRepository users;
    private final AccessRules access;
    private final AuthProperties authProperties;
    private final StaffAccess staffAccess;
    private final RiderRepository riders;

    public StaffDirectoryService(UserRepository users, AccessRules access, StaffAccess staffAccess,
                                 AuthProperties authProperties,
                                 RiderRepository riders) {
        this.riders = riders;
        this.users = users;
        this.access = access;
        this.authProperties = authProperties;
        this.staffAccess = staffAccess;
    }

    public StaffDirectory directory(Optional<SessionPayload> session) {
        staffAccess.requireRole(session, StaffAccess.ADMINS); // the user directory is for administrators

        List<UserDto> all = new ArrayList<>();
        for (User u : users.findAllByOrderByCreatedAtDesc()) {
            UserDto dto = UserDto.from(u);
            if (access.isForcedUserEmail(u.getEmail())
                    && (Roles.SUPER_ADMIN.equals(u.getRole()) || Roles.ADMIN.equals(u.getRole()))) {
                try {
                    users.updateRoleById(u.getId(), Roles.USER, JsDates.nowUtc());
                    dto = withRole(dto, Roles.USER);
                } catch (RuntimeException e) {
                    log.error("Failed to demote forced-user account in DB:", e);
                }
            }
            all.add(dto);
        }

        List<UserDto> superAdmins = new ArrayList<>(all.stream()
                .filter(u -> !access.isForcedUserEmail(u.email())
                        && (Roles.SUPER_ADMIN.equals(u.role()) || access.isSuperAdminEmail(u.email())))
                .toList());
        // Ensure all configured super admins appear even if not yet in the database
        for (String email : authProperties.superAdminEmails()) {
            if (superAdmins.stream().noneMatch(u -> lower(u.email()).equals(lower(email)))) {
                String now = JsDates.toIsoString(JsDates.nowUtc());
                String name = authProperties.superAdminDisplayNames().getOrDefault(email, email.split("@")[0]);
                superAdmins.add(new UserDto("superadmin-" + email.replaceAll("[^a-zA-Z0-9]", "_"), name, email,
                        now, now, Roles.SUPER_ADMIN, null, null, List.of(), null, null));
            }
        }

        List<UserDto> admins = all.stream()
                .filter(u -> !access.isForcedUserEmail(u.email()) && Roles.ADMIN.equals(u.role())
                        && !access.isSuperAdminEmail(u.email()))
                .toList();
        List<FieldExecutiveUser> fieldExecutives = all.stream()
                .filter(u -> Roles.FIELD_EXECUTIVE.equals(u.role()))
                .map(u -> new FieldExecutiveUser(u.id(), u.name(), u.phone() != null && !u.phone().isEmpty()
                        ? u.phone() : u.email(), "available", null))
                .toList();

        return new StaffDirectory(superAdmins, admins, byRoleExcludingSuperAdmins(all, Roles.ZONAL_HEAD),
                byRoleExcludingSuperAdmins(all, Roles.RELATIONSHIP_MANAGER), byRoleExcludingSuperAdmins(all, Roles.PARTNER),
                riders.findAllByOrderByCreatedAtDesc().stream().map(RiderDto::from).toList(),
                fieldExecutives);
    }

    private List<UserDto> byRoleExcludingSuperAdmins(List<UserDto> all, String role) {
        return all.stream().filter(u -> role.equals(u.role()) && !access.isSuperAdminEmail(u.email())).toList();
    }

    private static UserDto withRole(UserDto u, String role) {
        return new UserDto(u.id(), u.name(), u.email(), u.createdAt(), u.updatedAt(), role, u.phone(), u.cityId(),
                u.pincodes(), u.managerId(), u.relationshipManagerId());
    }
}
