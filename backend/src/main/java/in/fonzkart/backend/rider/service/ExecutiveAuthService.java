package in.fonzkart.backend.rider.service;

import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.session.ExecutiveSessions;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.rider.entity.Rider;
import in.fonzkart.backend.rider.repository.RiderRepository;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionResponse;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Field-executive phone login, ported from actions/executive.ts (loginExecutive, onboardExecutive,
 * logoutExecutive, getExecutiveSession) including its security hardening:
 * <ul>
 *   <li>passwords are stored as bcrypt hashes; a legacy plain-text password still verifies once and is then
 *       replaced by a hash ({@link RiderPasswords});</li>
 *   <li>the {@code executive_id} cookie is a signed token ({@link ExecutiveSessions}), so it cannot be forged;</li>
 *   <li>onboarding only sets a first password: an executive who already has one cannot be taken over.</li>
 * </ul>
 */
@Service
public class ExecutiveAuthService {

    private final RiderRepository riders;
    private final UserRepository users;
    private final SessionService sessions;
    private final ExecutiveSessions executiveSessions;
    private final RiderPasswords passwords;

    public ExecutiveAuthService(RiderRepository riders, UserRepository users, SessionService sessions,
                                ExecutiveSessions executiveSessions, RiderPasswords passwords) {
        this.riders = riders;
        this.users = users;
        this.sessions = sessions;
        this.executiveSessions = executiveSessions;
        this.passwords = passwords;
    }

    /** loginExecutive(phone, password?) */
    public ActionResponse login(String phone, String password) {
        Optional<Rider> found = phone == null ? Optional.empty() : riders.findFirstByPhone(phone);
        if (found.isEmpty()) {
            return ActionResponse.returned(failure("Phone number not found. Access denied."));
        }
        Rider executive = found.get();
        // Check if onboarding is needed
        if (!truthy(executive.getPassword())) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("success", true);
            m.put("needsOnboarding", true);
            m.put("id", executive.getId());
            return ActionResponse.returned(m);
        }
        if (!truthy(password)) {
            return ActionResponse.returned(failure("Password required"));
        }
        RiderPasswords.Check check = passwords.verify(executive.getPassword(), password);
        if (!check.ok()) {
            return ActionResponse.returned(failure("Invalid password"));
        }
        // A legacy plain-text password was correct: store it as a hash from now on.
        if (check.needsRehash()) {
            riders.updatePassword(executive.getId(), passwords.hash(password), JsDates.nowUtc());
        }
        return ActionResponse.redirect("/admin/orders", executiveSessions.start(executive.getId()));
    }

    /** onboardExecutive(id, password) — sets a FIRST password (as a hash) and signs the executive in. */
    public ActionResponse onboard(String id, String password) {
        Optional<Rider> found = id == null ? Optional.empty() : riders.findById(id);
        if (found.isEmpty()) {
            return ActionResponse.returned(failure("Executive not found"));
        }
        Rider executive = found.get();
        if (truthy(executive.getPassword())) {
            return ActionResponse.returned(failure("Executive already onboarded"));
        }
        if (!truthy(password)) {
            return ActionResponse.returned(failure("Password required"));
        }
        riders.updatePassword(executive.getId(), passwords.hash(password), JsDates.nowUtc());
        return ActionResponse.redirect("/admin/orders", executiveSessions.start(executive.getId()));
    }

    /** logoutExecutive() */
    public ActionResponse logout() {
        return ActionResponse.redirect("/login", executiveSessions.end());
    }

    /**
     * getExecutiveSession(): the rider named by a valid executive_id token (no fallback when that rider does not
     * exist); otherwise — including for a missing, forged, expired or legacy cookie — for a FIELD_EXECUTIVE main
     * session the rider with the user's phone, else the rider whose id equals the user id.
     */
    public Optional<Rider> currentExecutive(HttpServletRequest request) {
        Optional<String> executiveId = executiveSessions.riderId(request);
        if (executiveId.isPresent()) {
            return riders.findById(executiveId.get());
        }
        Optional<SessionPayload> session = sessions.getSession(request);
        if (session.isPresent() && session.get().user() != null
                && Roles.FIELD_EXECUTIVE.equals(session.get().user().role())) {
            String userId = session.get().user().id();
            Optional<User> user = userId == null ? Optional.empty() : users.findById(userId);
            if (user.isPresent() && truthy(user.get().getPhone())) {
                Optional<Rider> byPhone = riders.findFirstByPhone(user.get().getPhone());
                if (byPhone.isPresent()) {
                    return byPhone;
                }
            }
            return userId == null ? Optional.empty() : riders.findById(userId);
        }
        return Optional.empty();
    }

    private static Map<String, Object> failure(String error) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", false);
        m.put("error", error);
        return m;
    }
}
