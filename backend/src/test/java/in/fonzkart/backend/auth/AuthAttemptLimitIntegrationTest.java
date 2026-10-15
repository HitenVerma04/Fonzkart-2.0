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
    void executivePasswordsAreLimitedToo() throws Exception {
        for (int i = 0; i < AttemptLimiter.MAX_SIGNIN_FAILURES; i++) {
            assertThat(post("/api/executive/login", Map.of("phone", "+917000000001", "password", "guess" + i)).get("error").asText())
                    .isEqualTo("Invalid password");
        }
        assertThat(post("/api/executive/login", Map.of("phone", "+917000000001", "password", "riderpw")).get("error").asText())
                .isEqualTo(AttemptLimiter.TOO_MANY_SIGNINS);
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
