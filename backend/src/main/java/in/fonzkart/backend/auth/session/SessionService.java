package in.fonzkart.backend.auth.session;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.auth.config.AuthProperties;
import in.fonzkart.backend.auth.rules.AccessRules;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.MobileClients;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

/**
 * Port of lib/session.ts: login(), getSession(), logout(). Uses the same cookie ("session"), JWT format,
 * secret and lifetime, so a session created by either backend is accepted by the other.
 */
@Service
public class SessionService {

    public static final String COOKIE_NAME = "session";

    /** lib/session.ts fallback when AUTH_SECRET is not set — kept so existing cookies stay valid in that case. */
    static final String DEV_FALLBACK_SECRET = "temporary_dev_key_change_me_in_production";

    private static final Logger log = LoggerFactory.getLogger(SessionService.class);
    private static final Duration LIFETIME = Duration.ofDays(7);

    private final SessionTokenCodec codec;
    private final AccessRules accessRules;
    private final Clock clock;

    public SessionService(AuthProperties properties, AccessRules accessRules, ObjectMapper objectMapper, Clock clock) {
        String secret = properties.secret();
        if (secret == null || secret.isEmpty()) {
            log.warn("⚠️ AUTH_SECRET is not set. Session features will not work correctly.");
            secret = DEV_FALLBACK_SECRET;
        }
        this.codec = new SessionTokenCodec(secret, objectMapper);
        this.accessRules = accessRules;
        this.clock = clock;
    }

    /**
     * login(userData): applies identity overrides, signs { user, expires } and returns the Set-Cookie value
     * (expires in 1 week, httpOnly, sameSite=lax, path=/).
     */
    public ResponseCookie login(SessionUser user) {
        SessionUser effective = accessRules.applyIdentityOverrides(user);
        Instant now = clock.instant();
        Instant expires = now.plus(LIFETIME);
        String token = codec.sign(effective, JsDates.toIsoString(expires), now.getEpochSecond());
        return ResponseCookie.from(COOKIE_NAME, token)
                .path("/")
                .maxAge(LIFETIME)
                .httpOnly(true)
                .sameSite("Lax")
                .build();
    }

    /**
     * getSession(): the verified payload with identity overrides applied, or empty. A bearer token (phone apps,
     * {@link MobileClients}) takes precedence over the cookie: when one is sent, the cookie is not consulted.
     */
    public Optional<SessionPayload> getSession(HttpServletRequest request) {
        return MobileClients.bearerToken(request).or(() -> readCookie(request)).flatMap(this::decode);
    }

    public Optional<SessionPayload> decode(String token) {
        return codec.verify(token, clock.instant())
                .map(p -> p.user() == null ? p : p.withUser(accessRules.applyIdentityOverrides(p.user())));
    }

    /** logout(): cookies().set('session', '', { expires: new Date(0) }) */
    public ResponseCookie logout() {
        return ResponseCookie.from(COOKIE_NAME, "").path("/").maxAge(0).build();
    }

    private static Optional<String> readCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        for (Cookie c : cookies) {
            if (COOKIE_NAME.equals(c.getName()) && c.getValue() != null && !c.getValue().isEmpty()) {
                return Optional.of(c.getValue());
            }
        }
        return Optional.empty();
    }
}
