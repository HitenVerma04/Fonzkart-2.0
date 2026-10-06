package in.fonzkart.backend.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Expected strings are what JavaScript's String(n) / JSON.stringify(n) produce. */
class JsNumberJacksonConfigTest {

    @ParameterizedTest
    @CsvSource({
            "77.0, 77",
            "12.9716, 12.9716",
            "-0.5, -0.5",
            "0.1, 0.1",
            "100000.0, 100000",
            "1.0E-6, 0.000001",
            "1.0E-7, 1e-7",
            "1.5E-8, 1.5e-8",
            "1.0E21, 1e+21",
            "1.2345E22, 1.2345e+22",
            "123456789012345680000, 123456789012345680000",
            "0.0, 0",
    })
    void formatsLikeJavaScript(double value, String expected) {
        assertThat(JsNumberJacksonConfig.toJavaScriptString(value)).isEqualTo(expected);
    }
}
