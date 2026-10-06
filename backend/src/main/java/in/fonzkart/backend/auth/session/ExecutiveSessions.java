package in.fonzkart.backend.auth.session;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.auth.config.AuthProperties;
import in.fonzkart.backend.shared.web.MobileClients;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.util.Optional;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * The {@code executive_id} cookie of the field-executive phone login: a signed {@link ExecutiveTokenCodec} token,
 * so it can no longer be forged by writing a rider id into it. Same secret (and development fallback) as
 * {@link SessionService}, same cookie as the website, so either backend accepts the other's cookie.
 */
@Component
public class ExecutiveSessions {

    public static final String COOKIE_NAME = "executive_id";

    private final ExecutiveTokenCodec codec;
    private final Clock clock;

    public ExecutiveSessions(AuthProperties properties, ObjectMapper objectMapper, Clock clock) {
        String secret = properties.secret();
        this.codec = new ExecutiveTokenCodec(secret == null || secret.isEmpty() ? SessionService.DEV_FALLBACK_SECRET : secret,
                objectMapper);
        this.clock = clock;
    }

    /** Browser-session cookie (no Max-Age, as before), httpOnly, SameSite=Lax. */
    public ResponseCookie start(String riderId) {
        String token = codec.sign(riderId, clock.instant().getEpochSecond());
        return ResponseCookie.from(COOKIE_NAME, token).httpOnly(true).sameSite("Lax").path("/").build();
    }

    public ResponseCookie end() {
        return ResponseCookie.from(COOKIE_NAME, "").path("/").maxAge(0).build();
    }

    /**
     * The rider id from a valid token; empty when it is missing, forged, expired or a legacy raw id. A bearer token
     * (Partner app, {@link MobileClients}) takes precedence over the cookie; a user session token sent that way is
     * not an executive token and yields empty.
     */
    public Optional<String> riderId(HttpServletRequest request) {
        Optional<String> bearer = MobileClients.bearerToken(request);
        if (bearer.isPresent()) {
            return bearer.flatMap(token -> codec.verify(token, clock.instant()));
        }
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if (COOKIE_NAME.equals(c.getName())) {
                    return codec.verify(c.getValue(), clock.instant());
                }
            }
        }
        return Optional.empty();
    }
}
