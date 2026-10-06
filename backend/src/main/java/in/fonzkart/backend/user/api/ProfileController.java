package in.fonzkart.backend.user.api;

import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.user.dto.UserViews.Profile;
import in.fonzkart.backend.user.service.ProfileService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in user's profile (app/profile/page.tsx, actions/profile.ts). */
@RestController
@RequestMapping("/api/users/me")
public class ProfileController {

    public record UpdateProfileRequest(String name, String phone) {
    }

    private final ProfileService profiles;
    private final SessionService sessions;

    public ProfileController(ProfileService profiles, SessionService sessions) {
        this.profiles = profiles;
        this.sessions = sessions;
    }

    /** Profile page data; 401 where the page redirects to /login. */
    @GetMapping
    public Profile get(HttpServletRequest request) {
        return profiles.getProfile(sessions.getSession(request));
    }

    /** actions/profile.ts → updateProfile (returns {success:true} or {error}). */
    @PutMapping
    public Map<String, Object> update(HttpServletRequest request, @RequestBody(required = false) UpdateProfileRequest r) {
        r = r == null ? new UpdateProfileRequest(null, null) : r;
        return profiles.updateProfile(sessions.getSession(request), r.name(), r.phone());
    }
}
