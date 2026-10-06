package in.fonzkart.backend.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.support.PostgresTestBase;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Nothing the authentication flows log may contain a password, password hash, reset/verification code, session or
 * executive token, or the session secret — including when a database error is logged: PostgreSQL's error detail
 * ("Failing row contains (...)") would carry a user's password hash and reset code, so the JDBC driver is configured
 * with {@code logServerErrorDetail=false} (application.yml).
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
@ExtendWith(OutputCaptureExtension.class)
@DirtiesContext
class SensitiveLoggingIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.emptyPrismaDatabase();

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
    private final List<String> cookies = new ArrayList<>();

    @Test
    void aFailedRegistrationIsLoggedWithoutTheUsersRow(CapturedOutput output) throws Exception {
        // Make the INSERT of this one user fail with an error whose detail lists the whole row (test database only).
        jdbc.execute("ALTER TABLE \"User\" ADD CONSTRAINT log_test_reject CHECK (name <> 'Reject Me')");
        try {
            HttpResponse<String> r = post("/api/auth/signup",
                    Map.of("name", "Reject Me", "email", "reject@example.test", "phone", "9000000077", "password", "reject-pass-1"));
            assertThat(mapper.readTree(r.body()).get("error").asText()).isEqualTo("An error occurred during registration");
        } finally {
            jdbc.execute("ALTER TABLE \"User\" DROP CONSTRAINT log_test_reject");
        }
        assertThat(output.getAll())
                .contains("User registration failed", "violates check constraint")  // still diagnosable
                .doesNotContain("Failing row contains", "reject-pass-1")
                .doesNotContainPattern("\\$2[aby]\\$\\d\\d\\$");
    }

    @Test
    void authenticationFlowsLogNoSecrets(CapturedOutput output) throws Exception {
        Set<String> secrets = new LinkedHashSet<>(List.of(PostgresTestBase.AUTH_SECRET, "log-pass-1", "log-pass-2",
                "log-quick-pw", "log-rider-pw", "wrong-password"));

        post("/api/auth/signup", Map.of("name", "Log New", "email", "log@example.test", "phone", "9123456780", "password", "log-pass-1"));
        secrets.add(resetCode("log@example.test"));
        post("/api/auth/signin", Map.of("email", "log@example.test", "password", "log-pass-1")); // unverified: new code
        String code = resetCode("log@example.test");
        secrets.add(code);
        post("/api/auth/verify-email", Map.of("email", "log@example.test", "otp", code));
        post("/api/auth/signin", Map.of("email", "log@example.test", "password", "wrong-password"));
        post("/api/auth/signin", Map.of("email", "log@example.test", "password", "log-pass-1"));
        post("/api/auth/password-reset/request", Map.of("email", "log@example.test"));
        String resetCode = resetCode("log@example.test");
        secrets.add(resetCode);
        post("/api/auth/password-reset/confirm", Map.of("email", "log@example.test", "otp", resetCode, "password", "log-pass-2"));
        post("/api/auth/quick-register", Map.of("name", "Quick", "email", "quick@example.test", "password", "log-quick-pw"));
        post("/api/auth/quick-login", Map.of("email", "quick@example.test", "password", "log-quick-pw"));

        jdbc.update("INSERT INTO \"Rider\" (id, name, phone, status, password, \"createdAt\", \"updatedAt\") "
                + "VALUES ('log-rider', 'Log Rider', '+917800000001', 'available', 'log-rider-pw', now(), now())");
        post("/api/executive/login", Map.of("phone", "+917800000001", "password", "log-rider-pw"));

        secrets.addAll(jdbc.queryForList("SELECT \"passwordHash\" FROM \"User\"", String.class));
        secrets.addAll(jdbc.queryForList("SELECT password FROM \"Rider\" WHERE password IS NOT NULL", String.class));
        secrets.addAll(cookies);

        String all = output.getAll();
        assertThat(all).contains("[MAIL SERVER] OTP successfully sent to log@example.test"); // the flows did run
        for (String secret : secrets) {
            assertThat(all).as("a secret was logged").doesNotContain(secret);
        }
        assertThat(all).doesNotContainPattern("\\$2[aby]\\$\\d\\d\\$");
    }

    private String resetCode(String email) {
        return jdbc.queryForObject("SELECT \"resetToken\" FROM \"User\" WHERE email = ?", String.class, email);
    }

    private HttpResponse<String> post(String path, Object body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        response.headers().allValues("Set-Cookie").stream()
                .map(c -> c.split(";", 2)[0].split("=", 2))
                .filter(nv -> nv.length == 2 && !nv[1].isEmpty())
                .forEach(nv -> cookies.add(nv[1]));
        return response;
    }
}
