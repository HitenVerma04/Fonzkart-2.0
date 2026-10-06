package in.fonzkart.backend.shared.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import org.springframework.http.HttpHeaders;

/**
 * The phone apps (Customer, Partner, Admin) use the same session and executive tokens as the website, carried in
 * headers instead of cookies: they send {@code X-Client: mobile} when signing in and receive the token in
 * {@code X-Auth-Token} (no Set-Cookie), then send {@code Authorization: Bearer <token>} with every request.
 * Response bodies are identical for both clients.
 */
public final class MobileClients {

    public static final String CLIENT_HEADER = "X-Client";
    public static final String MOBILE = "mobile";
    public static final String TOKEN_HEADER = "X-Auth-Token";

    private static final String BEARER_PREFIX = "Bearer ";

    private MobileClients() {
    }

    /** True when the request comes from one of the phone apps ({@code X-Client: mobile}, any case). */
    public static boolean isMobile(HttpServletRequest request) {
        String client = request.getHeader(CLIENT_HEADER);
        return client != null && MOBILE.equalsIgnoreCase(client.trim());
    }

    /**
     * The token of an {@code Authorization: Bearer <token>} header (scheme in any case), or empty when there is no
     * such header. Other schemes (e.g. Basic, added by a proxy) are ignored, so the cookie still applies to them.
     */
    public static Optional<String> bearerToken(HttpServletRequest request) {
        String value = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (value == null) {
            return Optional.empty();
        }
        value = value.trim();
        if (value.length() <= BEARER_PREFIX.length()
                || !value.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            return Optional.empty();
        }
        String token = value.substring(BEARER_PREFIX.length()).trim();
        return token.isEmpty() ? Optional.empty() : Optional.of(token);
    }
}
