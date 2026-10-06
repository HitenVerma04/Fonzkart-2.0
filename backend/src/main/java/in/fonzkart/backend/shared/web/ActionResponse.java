package in.fonzkart.backend.shared.web;

import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;

/**
 * Outcome of a migrated server action: either a returned value or a redirect, optionally with a cookie to set or
 * clear (what the original does through Next.js cookies()).
 *
 * @param body       the value the original action returned (null for none)
 * @param redirectTo the URL passed to redirect(), or null
 * @param cookie     Set-Cookie to send, or null
 */
public record ActionResponse(Object body, String redirectTo, ResponseCookie cookie) {

    public static ActionResponse returned(Object body) {
        return new ActionResponse(body, null, null);
    }

    public static ActionResponse returned(Object body, ResponseCookie cookie) {
        return new ActionResponse(body, null, cookie);
    }

    public static ActionResponse redirect(String url) {
        return new ActionResponse(null, url, null);
    }

    public static ActionResponse redirect(String url, ResponseCookie cookie) {
        return new ActionResponse(null, url, cookie);
    }

    /** HTTP 200 with the returned value, or {@code {"redirectTo": url}}; Set-Cookie when a cookie changed. */
    public ResponseEntity<Object> toResponseEntity() {
        return toResponseEntity(false);
    }

    /**
     * As {@link #toResponseEntity()}; for the phone apps ({@link MobileClients}) a new token is sent in
     * {@code X-Auth-Token} instead of Set-Cookie and a cleared cookie is not sent. The body is the same.
     */
    public ResponseEntity<Object> toResponseEntity(boolean mobileClient) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
        if (cookie != null) {
            if (!mobileClient) {
                builder.header(HttpHeaders.SET_COOKIE, cookie.toString());
            } else if (!cookie.getValue().isEmpty()) {
                builder.header(MobileClients.TOKEN_HEADER, cookie.getValue());
            }
        }
        if (redirectTo != null) {
            return builder.body(Map.of("redirectTo", redirectTo));
        }
        return body == null ? builder.build() : builder.body(body);
    }
}
