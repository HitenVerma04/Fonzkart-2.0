package in.fonzkart.backend.user.service;

import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.auth.password.PasswordHasher;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.city.dto.CityDto;
import in.fonzkart.backend.user.dto.UserDto;
import in.fonzkart.backend.user.dto.UserViews.UserWithCity;
import in.fonzkart.backend.user.dto.UserViews.ZonalHeadWithTerritory;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.city.repository.CityRepository;
import in.fonzkart.backend.user.repository.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Port of the user parts of app/admin/zonal-heads/page.tsx: listing zonal heads with their territory and the
 * inline "Register Zonal Head" action. (Assigning cities to a zonal head writes "City" and belongs to the city
 * management migration.) Access: administrators only (StaffAccess.ADMINS).
 */
@Service
public class ZonalHeadAdminService {

    private final UserRepository users;
    private final CityRepository cities;
    private final StaffAccess access;
    private final PasswordHasher passwords;

    public ZonalHeadAdminService(UserRepository users, CityRepository cities, StaffAccess access,
                                 PasswordHasher passwords) {
        this.users = users;
        this.cities = cities;
        this.access = access;
        this.passwords = passwords;
    }

    /** prisma.user.findMany({ where: { role: 'ZONAL_HEAD' }, include: { managedCities, managedUsers(PARTNER, city) } }) */
    public List<ZonalHeadWithTerritory> list(Optional<SessionPayload> session) {
        access.requireRole(session, StaffAccess.ADMINS); // zonal heads are managed by administrators
        return users.findByRoleOrderByCreatedAtDesc(Roles.ZONAL_HEAD).stream()
                .map(zh -> new ZonalHeadWithTerritory(UserDto.from(zh),
                        cities.findByManagerId(zh.getId()).stream().map(CityDto::from).toList(),
                        users.findByManagerIdAndRole(zh.getId(), Roles.PARTNER).stream()
                                .map(p -> new UserWithCity(UserDto.from(p), p.getCityId() == null ? null
                                        : cities.findById(p.getCityId()).map(CityDto::from).orElse(null)))
                                .toList()))
                .toList();
    }

    /** Inline action: creates a ZONAL_HEAD user when name, email and password are given (otherwise no-op). */
    public Map<String, Object> create(Optional<SessionPayload> session, String name, String email, String phone,
                                      String password) {
        access.requireRole(session, StaffAccess.ADMINS); // zonal heads are managed by administrators
        if (!(truthy(name) && truthy(email) && truthy(password))) {
            return Map.of("created", false);
        }
        User zonalHead = User.newUser(Cuid.next(), name, email, phone, passwords.hash(password), Roles.ZONAL_HEAD,
                JsDates.nowUtc());
        users.saveAndFlush(zonalHead);
        return Map.of("created", true);
    }
}
