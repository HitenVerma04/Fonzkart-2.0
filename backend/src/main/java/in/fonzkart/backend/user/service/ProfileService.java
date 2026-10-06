package in.fonzkart.backend.user.service;

import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.auth.rules.PhoneNumbers;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.dto.UserViews.Profile;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/** Port of app/profile/page.tsx (profile data) and actions/profile.ts → updateProfile(). */
@Service
public class ProfileService {

    private final UserRepository users;

    public ProfileService(UserRepository users) {
        this.users = users;
    }

    /** Profile page: requires a session and a matching user (otherwise the page redirects to /login). */
    public Profile getProfile(Optional<SessionPayload> session) {
        SessionUser user = session.map(SessionPayload::user).orElseThrow(ActionException::unauthorized);
        User dbUser = users.findUserByEmail(user.email()).orElseThrow(ActionException::unauthorized);
        return new Profile(user.id(), user.email(), user.name(), user.role(), dbUser.getPhone());
    }

    /**
     * updateProfile(prevState, formData). A missing phone field sets phone to NULL and an empty one to '',
     * exactly as the original passes formData.get('phone') to Prisma.
     */
    public Map<String, Object> updateProfile(Optional<SessionPayload> session, String name, String phone) {
        if (session.isEmpty() || session.get().user() == null) {
            return Map.of("error", "Unauthorized");
        }
        if (!truthy(name)) {
            return Map.of("error", "Name cannot be empty");
        }
        try {
            int updated = users.updateProfileByEmail(session.get().user().email(), name,
                    PhoneNumbers.withIndiaPrefix(phone), JsDates.nowUtc());
            if (updated == 0) {
                return Map.of("error", "Failed to update profile");
            }
            return Map.of("success", true);
        } catch (RuntimeException e) {
            return Map.of("error", "Failed to update profile");
        }
    }
}
