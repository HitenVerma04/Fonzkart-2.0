package in.fonzkart.backend.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;

/** Header conventions of the phone apps: X-Client: mobile and Authorization: Bearer. */
class MobileClientsTest {

    @ParameterizedTest
    @ValueSource(strings = {"mobile", "Mobile", "MOBILE", " mobile "})
    void recognisesThePhoneApps(String value) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(MobileClients.CLIENT_HEADER, value);
        assertThat(MobileClients.isMobile(request)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "web", "mobile-web", "android"})
    void otherClientsAreNotMobile(String value) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(MobileClients.CLIENT_HEADER, value);
        assertThat(MobileClients.isMobile(request)).isFalse();
        assertThat(MobileClients.isMobile(new MockHttpServletRequest())).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Bearer abc.def.ghi", "bearer abc.def.ghi", "BEARER abc.def.ghi", "  Bearer   abc.def.ghi  "})
    void readsBearerTokens(String header) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", header);
        assertThat(MobileClients.bearerToken(request)).contains("abc.def.ghi");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "Bearer", "Bearer ", "Bearer    ", "Basic dXNlcjpwYXNz", "Bearerabc", "Token abc"})
    void ignoresAnythingElse(String header) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", header);
        assertThat(MobileClients.bearerToken(request)).isEmpty();
    }

    @Test
    void noHeaderNoToken() {
        assertThat(MobileClients.bearerToken(new MockHttpServletRequest())).isEmpty();
    }
}
