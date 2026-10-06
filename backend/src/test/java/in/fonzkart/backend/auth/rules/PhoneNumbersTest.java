package in.fonzkart.backend.auth.rules;

import static org.assertj.core.api.Assertions.assertThat;

import in.fonzkart.backend.shared.text.JsText;
import org.junit.jupiter.api.Test;

class PhoneNumbersTest {

    @Test
    void signupAndProfileAddIndiaPrefixUnlessPresent() {
        assertThat(PhoneNumbers.withIndiaPrefix("9876543210")).isEqualTo("+919876543210");
        assertThat(PhoneNumbers.withIndiaPrefix("+919876543210")).isEqualTo("+919876543210");
        assertThat(PhoneNumbers.withIndiaPrefix("+449876543210")).isEqualTo("+91+449876543210"); // original behaviour
        assertThat(PhoneNumbers.withIndiaPrefix("")).isEqualTo("");
        assertThat(PhoneNumbers.withIndiaPrefix(null)).isNull();
    }

    @Test
    void signinPhoneCandidates() {
        assertThat(PhoneNumbers.signinPhoneCandidate("9876543210")).contains("+919876543210");
        assertThat(PhoneNumbers.signinPhoneCandidate(" 919876543210 ")).contains("+919876543210");
        assertThat(PhoneNumbers.signinPhoneCandidate("+919876543210")).contains("+919876543210");
        assertThat(PhoneNumbers.signinPhoneCandidate("98765 43210")).contains("98765 43210"); // 11 chars: as typed
        assertThat(PhoneNumbers.signinPhoneCandidate("98765")).isEmpty();
        assertThat(PhoneNumbers.signinPhoneCandidate("alice@example.com")).isEmpty();
    }

    @Test
    void encodeUriComponentMatchesJavaScript() {
        assertThat(JsText.encodeURIComponent("alice@example.test")).isEqualTo("alice%40example.test");
        assertThat(JsText.encodeURIComponent("a b+c/d?e=f&g")).isEqualTo("a%20b%2Bc%2Fd%3Fe%3Df%26g");
        assertThat(JsText.encodeURIComponent("-_.!~*'()")).isEqualTo("-_.!~*'()");
        assertThat(JsText.encodeURIComponent("é😀")).isEqualTo("%C3%A9%F0%9F%98%80");
    }
}
