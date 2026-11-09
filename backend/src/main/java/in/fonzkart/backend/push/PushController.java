package in.fonzkart.backend.push;

import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.rider.entity.Rider;
import in.fonzkart.backend.rider.service.ExecutiveAuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The phone apps register their Expo push token after sign-in ({@code POST}) and forget it at sign-out
 * ({@code DELETE}). The owner comes from the session: a signed-in account, or a field executive (rider mode in the
 * Partner app, or a FIELD_EXECUTIVE account), whose notifications are addressed by rider id.
 */
@RestController
@RequestMapping("/api/push-tokens")
public class PushController {

    public record TokenRequest(String token, String platform, String app) {
    }

    private final PushService push;
    private final SessionService sessions;
    private final ExecutiveAuthService executives;

    public PushController(PushService push, SessionService sessions, ExecutiveAuthService executives) {
        this.push = push;
        this.sessions = sessions;
        this.executives = executives;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> register(HttpServletRequest request, @RequestBody(required = false) TokenRequest r) {
        if (r == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false));
        }
        Optional<SessionPayload> session = sessions.getSession(request);
        String userId = null;
        String riderId = null;
        if (session.isPresent() && !Roles.FIELD_EXECUTIVE.equals(session.get().user().role())) {
            userId = session.get().user().id();
        } else {
            Optional<Rider> executive = executives.currentExecutive(request);
            if (executive.isPresent()) {
                riderId = executive.get().getId();
            } else if (session.isPresent()) {
                userId = session.get().user().id();
            }
        }
        if (userId == null && riderId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success", false));
        }
        boolean ok = push.register(r.token(), r.platform(), r.app(), userId, riderId);
        return ok ? ResponseEntity.ok(Map.of("success", true)) : ResponseEntity.badRequest().body(Map.of("success", false));
    }

    @DeleteMapping
    public Map<String, Object> unregister(@RequestBody(required = false) TokenRequest r) {
        if (r != null) {
            push.unregister(r.token());
        }
        return Map.of("success", true);
    }
}
