package in.fonzkart.backend.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;

/** The website gets Set-Cookie; the phone apps get the same token in X-Auth-Token, with an identical body. */
class ActionResponseTest {

    private static final ResponseCookie LOGIN = ResponseCookie.from("session", "tok.en.value").path("/").httpOnly(true)
            .build();
    private static final ResponseCookie CLEARED = ResponseCookie.from("session", "").path("/").maxAge(0).build();

    @Test
    void websiteGetsTheCookieAsBefore() {
        ResponseEntity<Object> response = ActionResponse.redirect("/admin", LOGIN).toResponseEntity();
        assertThat(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE)).isEqualTo(LOGIN.toString());
        assertThat(response.getHeaders().containsKey(MobileClients.TOKEN_HEADER)).isFalse();
        assertThat(response.getBody()).isEqualTo(Map.of("redirectTo", "/admin"));
        assertThat(ActionResponse.redirect("/admin", LOGIN).toResponseEntity(false).getHeaders())
                .isEqualTo(response.getHeaders());
    }

    @Test
    void phoneAppsGetTheTokenInsteadOfTheCookie() {
        ResponseEntity<Object> response = ActionResponse.redirect("/admin", LOGIN).toResponseEntity(true);
        assertThat(response.getHeaders().getFirst(MobileClients.TOKEN_HEADER)).isEqualTo("tok.en.value");
        assertThat(response.getHeaders().containsKey(HttpHeaders.SET_COOKIE)).isFalse();
        assertThat(response.getBody()).isEqualTo(Map.of("redirectTo", "/admin"));
    }

    @Test
    void clearingTheCookieSendsNothingToPhoneApps() {
        ResponseEntity<Object> response = ActionResponse.redirect("/login", CLEARED).toResponseEntity(true);
        assertThat(response.getHeaders().containsKey(MobileClients.TOKEN_HEADER)).isFalse();
        assertThat(response.getHeaders().containsKey(HttpHeaders.SET_COOKIE)).isFalse();
        ResponseEntity<Object> web = ActionResponse.redirect("/login", CLEARED).toResponseEntity();
        assertThat(web.getHeaders().getFirst(HttpHeaders.SET_COOKIE)).isEqualTo(CLEARED.toString());
    }

    @Test
    void responsesWithoutACookieAreTheSameForBoth() {
        Map<String, String> error = Map.of("error", "Invalid email/phone or password");
        ResponseEntity<Object> web = ActionResponse.returned(error).toResponseEntity(false);
        ResponseEntity<Object> mobile = ActionResponse.returned(error).toResponseEntity(true);
        assertThat(mobile.getHeaders()).isEqualTo(web.getHeaders());
        assertThat(mobile.getBody()).isEqualTo(web.getBody()).isEqualTo(error);
        assertThat(mobile.getStatusCode().value()).isEqualTo(200);
    }
}
