package in.fonzkart.backend.auth.session;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.auth.config.AuthProperties;
import in.fonzkart.backend.auth.rules.AccessRules;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

/**
 * The phone apps send the session / executive token as {@code Authorization: Bearer}: it is accepted exactly like
 * the cookie, wins over a cookie when both are sent, and the two token types are never accepted as each other.
 */
class BearerSessionTest {

    private static final AuthProperties PROPERTIES = new AuthProperties("bearer-test-secret", List.of(), Map.of(),
            List.of(), "https://www.fonzkart.in");
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final SessionService sessions = new SessionService(PROPERTIES, new AccessRules(PROPERTIES), MAPPER,
            Clock.systemUTC());
    private final ExecutiveSessions executives = new ExecutiveSessions(PROPERTIES, MAPPER, Clock.systemUTC());

    private final String alice = sessions.login(new SessionUser("u1", "alice@example.test", "Alice", "USER")).getValue();
    private final String bob = sessions.login(new SessionUser("u2", "bob@example.test", "Bob", "PARTNER")).getValue();
    private final String rider = executives.start("r1").getValue();

    @Test
    void bearerTokenIsTheSameSessionAsTheCookie() {
        SessionPayload viaCookie = sessions.getSession(withCookie(SessionService.COOKIE_NAME, alice)).orElseThrow();
        SessionPayload viaBearer = sessions.getSession(withBearer(alice)).orElseThrow();
        assertThat(viaBearer).isEqualTo(viaCookie);
        assertThat(viaBearer.user().email()).isEqualTo("alice@example.test");
    }

    @Test
    void bearerWinsOverTheCookie() {
        MockHttpServletRequest request = withBearer(alice);
        request.setCookies(new Cookie(SessionService.COOKIE_NAME, bob));
        assertThat(sessions.getSession(request).orElseThrow().user().id()).isEqualTo("u1");
    }

    @Test
    void anInvalidBearerDoesNotFallBackToTheCookie() {
        MockHttpServletRequest request = withBearer(alice + "x");
        request.setCookies(new Cookie(SessionService.COOKIE_NAME, bob));
        assertThat(sessions.getSession(request)).isEmpty();
    }

    @Test
    void otherAuthorizationSchemesLeaveTheCookieInCharge() {
        MockHttpServletRequest request = withCookie(SessionService.COOKIE_NAME, bob);
        request.addHeader("Authorization", "Basic dXNlcjpwYXNz");
        assertThat(sessions.getSession(request).orElseThrow().user().id()).isEqualTo("u2");
    }

    @Test
    void executiveBearerTokenIdentifiesTheRider() {
        assertThat(executives.riderId(withBearer(rider))).contains("r1");
        assertThat(executives.riderId(withCookie(ExecutiveSessions.COOKIE_NAME, rider))).contains("r1");
    }

    @Test
    void executiveBearerWinsOverTheExecutiveCookie() {
        MockHttpServletRequest request = withBearer(executives.start("r2").getValue());
        request.setCookies(new Cookie(ExecutiveSessions.COOKIE_NAME, rider));
        assertThat(executives.riderId(request)).contains("r2");
    }

    @Test
    void tokenTypesAreNeverAcceptedAsEachOther() {
        assertThat(sessions.getSession(withBearer(rider))).isEmpty();
        assertThat(executives.riderId(withBearer(alice))).isEmpty();
    }

    @Test
    void websiteRequestsAreUnchanged() {
        assertThat(sessions.getSession(new MockHttpServletRequest())).isEmpty();
        assertThat(executives.riderId(new MockHttpServletRequest())).isEmpty();
        assertThat(sessions.getSession(withCookie(SessionService.COOKIE_NAME, "")).isEmpty()).isTrue();
    }

    private static MockHttpServletRequest withBearer(String token) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        return request;
    }

    private static MockHttpServletRequest withCookie(String name, String value) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(name, value));
        return request;
    }
}
