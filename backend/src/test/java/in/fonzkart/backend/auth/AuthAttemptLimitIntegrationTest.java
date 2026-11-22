package in.fonzkart.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.auth.rules.AttemptLimiter;
import in.fonzkart.backend.support.PostgresTestBase;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Guessing limits (AttemptLimiter): passwords for one account, executive passwords, and the 6-digit email codes.
 * The same limits apply on the website (lib/attempt-limits.ts) while it signs people in itself.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class AuthAttemptLimitIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.prismaDatabaseWith("db/03-staff-seed.sql");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    @LocalServerPort
    private int port;
    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void tenWrongPasswordsLockTheAccountForSignInAndQuickLogin() throws Exception {
        for (int i = 0; i < AttemptLimiter.MAX_SIGNIN_FAILURES; i++) {
            assertThat(post("/api/auth/signin", Map.of("email", "user4@example.test", "password", "guess" + i)).get("error").asText())
                    .isEqualTo("Invalid email/phone or password");
        }
        // Now even the right password is refused, through both sign-in forms; other accounts are not affected.
        assertThat(post("/api/auth/signin", Map.of("email", "user4@example.test", "password", "pw")).get("error").asText())
                .isEqualTo(AttemptLimiter.TOO_MANY_SIGNINS);
        assertThat(post("/api/auth/quick-login", Map.of("email", "user4@example.test", "password", "pw")).get("error").asText())
                .isEqualTo(AttemptLimiter.TOO_MANY_SIGNINS);
        assertThat(post("/api/auth/signin", Map.of("email", "cust@example.test", "password", "pw")).get("redirectTo").asText())
                .isEqualTo("/");
    }

    @Test
    void theFifthWrongCodeCancelsThePasswordResetCode() throws Exception {
        jdbc.update("UPDATE \"User\" SET \"resetToken\" = '123456', \"resetTokenExpiry\" = now() + interval '15 minutes' "
                + "WHERE email = 'user3@example.test'");
        for (int i = 1; i < AttemptLimiter.MAX_CODE_FAILURES; i++) {
            assertThat(reset("00000" + i).get("error").asText()).isEqualTo("Invalid OTP provided.");
        }
        assertThat(reset("999999").get("error").asText()).isEqualTo(AttemptLimiter.TOO_MANY_CODES);
        assertThat(jdbc.queryForObject("SELECT \"resetToken\" FROM \"User\" WHERE email = 'user3@example.test'", String.class)).isNull();
        // The right code no longer works: a new one must be requested.
        assertThat(reset("123456").get("error").asText()).isEqualTo("Invalid OTP provided.");
        assertThat(post("/api/auth/signin", Map.of("email", "user3@example.test", "password", "pw")).has("redirectTo")).isTrue();
    }

    @Test
    void otherSpellingsOfTheAddressShareTheCountAndPatternsFindNoAccount() throws Exception {
        jdbc.update("UPDATE \"User\" SET \"resetToken\" = '654321', \"resetTokenExpiry\" = now() + interval '15 minutes' "
                + "WHERE email = 'user@example.test'");
        // A wildcard pattern no longer stands in for the address.
        for (String pattern : new String[] {"user@example.tes_", "user@%", "%"}) {
            assertThat(post("/api/auth/password-reset/confirm", Map.of("email", pattern, "otp", "000000", "password", "x"))
                    .get("error").asText()).as(pattern).isEqualTo("Invalid user.");
        }
        // Capitalised spellings are the same account: they share the guesses, and the fifth cancels the code.
        String[] spellings = {"User@example.test", "USER@EXAMPLE.TEST", "user@Example.test", "uSer@example.test"};
        for (String spelling : spellings) {
            assertThat(post("/api/auth/password-reset/confirm", Map.of("email", spelling, "otp", "111111", "password", "x"))
                    .get("error").asText()).as(spelling).isEqualTo("Invalid OTP provided.");
        }
        assertThat(post("/api/auth/password-reset/confirm", Map.of("email", "USER@example.TEST", "otp", "222222", "password", "x"))
                .get("error").asText()).isEqualTo(AttemptLimiter.TOO_MANY_CODES);
        assertThat(jdbc.queryForObject("SELECT \"resetToken\" FROM \"User\" WHERE email = 'user@example.test'", String.class)).isNull();
        // (Not trying the old code again here: that would count against the account for the other tests.)
    }

    @Test
    void anAddressWithAnUnderscoreStillSignsIn() throws Exception {
        jdbc.update("UPDATE \"User\" SET email = 'u_ser@example.test' WHERE email = 'user@example.test'");
        try {
            assertThat(post("/api/auth/signin", Map.of("email", "U_ser@Example.test", "password", "pw")).has("redirectTo")).isTrue();
            assertThat(post("/api/auth/signin", Map.of("email", "uxser@example.test", "password", "pw")).get("error").asText())
                    .isEqualTo("Invalid email/phone or password");
        } finally {
            jdbc.update("UPDATE \"User\" SET email = 'user@example.test' WHERE email = 'u_ser@example.test'");
        }
    }

    @Test
    void executivePasswordsAreLimitedToo() throws Exception {
        for (int i = 0; i < AttemptLimiter.MAX_SIGNIN_FAILURES; i++) {
            assertThat(post("/api/executive/login", Map.of("phone", "+917000000001", "password", "guess" + i)).get("error").asText())
                    .isEqualTo("Invalid password");
        }
        assertThat(post("/api/executive/login", Map.of("phone", "+917000000001", "password", "riderpw")).get("error").asText())
                .isEqualTo(AttemptLimiter.TOO_MANY_SIGNINS);
    }

    @Test
    void anExecutiveIsFoundHoweverTheNumberWasSavedOrTyped() throws Exception {
        // Saved as "+917000000003": typed with or without +91, with spaces.
        for (String typed : new String[] {"+917000000003", "7000000003", "+91 70000 00003", "917000000003"}) {
            JsonNode body = post("/api/executive/login", Map.of("phone", typed));
            assertThat(body.path("needsOnboarding").asBoolean()).as(typed).isTrue();
            assertThat(body.get("id").asText()).as(typed).isEqualTo("r3");
        }
        // Saved as 10 digits (the website's form), typed as the Partner app sends it.
        jdbc.update("UPDATE \"Rider\" SET phone = '7000000003' WHERE id = 'r3'");
        try {
            assertThat(post("/api/executive/login", Map.of("phone", "+917000000003")).get("id").asText()).isEqualTo("r3");
        } finally {
            jdbc.update("UPDATE \"Rider\" SET phone = '+917000000003' WHERE id = 'r3'");
        }
        // A number nobody added, or too short, is still refused.
        for (String typed : new String[] {"+919999999999", "70000"}) {
            assertThat(post("/api/executive/login", Map.of("phone", typed)).get("error").asText()).as(typed)
                    .isEqualTo(in.fonzkart.backend.rider.service.ExecutiveAuthService.NOT_AN_EXECUTIVE);
        }
    }

    private JsonNode reset(String otp) throws Exception {
        return post("/api/auth/password-reset/confirm", Map.of("email", "user3@example.test", "otp", otp, "password", "new-pw"));
    }

    private JsonNode post(String path, Map<String, Object> body) throws Exception {
        HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(res.statusCode()).as(path).isEqualTo(200);
        return mapper.readTree(res.body());
    }
}
