package in.fonzkart.backend.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.auth.session.ExecutiveTokenCodec;
import in.fonzkart.backend.auth.session.SessionTokenCodec;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.support.PostgresTestBase;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
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
 * Regression tests for the security hardening, on db/03-staff-seed.sql: city/partner pincode access (including
 * stale role claims in a still-valid session cookie), the signed executive_id cookie, and rider password handling.
 * The website side is covered by scripts/security-tests; StaffScenarioParityTest shows both behave the same.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
@DirtiesContext
class SecurityHardeningIntegrationTest {

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

    // ------------------------------------------------------------------------- city / partner access

    @Test
    void cityChangesUseTheRoleStoredInTheDatabaseNotTheCookie() throws Exception {
        String before = territory();
        // Signed session whose role claim is ADMIN, but the database says USER (e.g. demoted last week).
        String demoted = session("u-user", "user@example.test", "ADMIN");
        for (HttpResponse<String> r : cityWrites(demoted)) {
            assertThat(r.statusCode()).isEqualTo(403);
            assertThat(json(r).get("error").asText()).isEqualTo("Forbidden: Admin access required");
        }
        // A super-admin claim for an account that no longer exists.
        for (HttpResponse<String> r : cityWrites(session("ghost", "admin@fonzkart.in", "SUPER_ADMIN"))) {
            assertThat(r.statusCode()).isEqualTo(401);
        }
        // No session, and an executive token used as a session.
        String executiveAsSession = "session=" + new ExecutiveTokenCodec(PostgresTestBase.AUTH_SECRET, mapper)
                .sign("r1", Instant.now().getEpochSecond());
        for (String cookie : new String[] {null, executiveAsSession}) {
            for (HttpResponse<String> r : cityWrites(cookie)) {
                assertThat(r.statusCode()).isEqualTo(401);
            }
        }
        assertThat(territory()).isEqualTo(before);
    }

    @Test
    void zonalHeadIsLimitedToTheirCitiesAndPartners() throws Exception {
        String zh1 = session("u-zh1", "zh1@example.test", "ZONAL_HEAD");
        assertThat(send("PUT", "/api/cities/c-madurai/pincodes", zh1, Map.of("pincodes", new String[] {"625001"})).statusCode())
                .isEqualTo(403);
        assertThat(send("PUT", "/api/cities/c-chennai/active", zh1, Map.of("isActive", false)).statusCode()).isEqualTo(403);
        assertThat(send("PUT", "/api/cities/partners/u-p2/pincodes", zh1, Map.of("pincodes", new String[] {})).statusCode())
                .isEqualTo(403);
        assertThat(send("PUT", "/api/cities/c-chennai/pincodes", zh1, Map.of("pincodes", new String[] {"600001", "600099"}))
                .statusCode()).isEqualTo(200);
        assertThat(send("PUT", "/api/cities/partners/u-p1/pincodes", zh1, Map.of("pincodes", new String[] {"600099"}))
                .statusCode()).isEqualTo(200);
        assertThat(jdbc.queryForObject("SELECT array_to_string(pincodes, ',') FROM \"User\" WHERE id = 'u-p1'", String.class))
                .isEqualTo("600099");
    }

    // ------------------------------------------------------------------------------- executive cookie

    @Test
    void onlyValidSignedExecutiveCookiesIdentifyARider() throws Exception {
        ExecutiveTokenCodec codec = new ExecutiveTokenCodec(PostgresTestBase.AUTH_SECRET, mapper);
        long now = Instant.now().getEpochSecond();
        String valid = codec.sign("r2", now);
        assertThat(executive("executive_id=" + valid).get("name").asText()).isEqualTo("Suresh");

        String[] p = valid.split("\\.");
        String forgedPayload = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                ("{\"typ\":\"executive\",\"sub\":\"r1\",\"iat\":" + now + ",\"exp\":" + (now + 600) + "}").getBytes());
        for (String cookie : new String[] {
                "executive_id=r2",                                                      // legacy raw id
                "executive_id=" + p[0] + "." + forgedPayload + "." + p[2],              // tampered
                "executive_id=" + codec.sign("r2", now - ExecutiveTokenCodec.LIFETIME_SECONDS - 5), // expired
                "executive_id=" + new ExecutiveTokenCodec("other", mapper).sign("r2", now),        // other secret
                "executive_id=" + session("u-user", "user@example.test", "FIELD_EXECUTIVE").substring(8)}) { // a session
            assertThat(executive(cookie).isNull()).as(cookie).isTrue();
        }
        // A field executive who forges the cookie still only gets their own rider (by phone): r4, not r1.
        String fe = session("u-fe", "fe@example.test", "FIELD_EXECUTIVE");
        assertThat(executive(fe + "; executive_id=r1").get("id").asText()).isEqualTo("r4");
    }

    // ------------------------------------------------------------------------------ rider passwords

    @Test
    void onboardingCannotTakeOverAnExecutiveAndPasswordsAreHashed() throws Exception {
        HttpResponse<String> hijack = send("POST", "/api/executive/onboard", null, Map.of("id", "r1", "password", "hijack"));
        assertThat(json(hijack).get("error").asText()).isEqualTo("Executive already onboarded");
        assertThat(hijack.headers().firstValue("Set-Cookie")).isEmpty();
        assertThat(riderPassword("r1")).isEqualTo("riderpw");

        HttpResponse<String> empty = send("POST", "/api/executive/onboard", null, Map.of("id", "r5", "password", ""));
        assertThat(json(empty).get("error").asText()).isEqualTo("Password required");
        assertThat(riderPassword("r5")).isNull();

        // Legacy plain text works once, then only the hash is stored.
        HttpResponse<String> login = send("POST", "/api/executive/login", null, Map.of("phone", "+917000000001", "password", "riderpw"));
        assertThat(json(login).get("redirectTo").asText()).isEqualTo("/admin/orders");
        assertThat(riderPassword("r1")).startsWith("$2b$10$").doesNotContain("riderpw");
        assertThat(json(send("POST", "/api/executive/login", null, Map.of("phone", "+917000000001", "password", "riderpw")))
                .get("redirectTo").asText()).isEqualTo("/admin/orders");
        assertThat(json(send("POST", "/api/executive/login", null, Map.of("phone", "+917000000001", "password", "hijack")))
                .get("error").asText()).isEqualTo("Invalid password");

        // First-time onboarding stores a hash, never the password itself.
        HttpResponse<String> onboard = send("POST", "/api/executive/onboard", null, Map.of("id", "r4", "password", "newpw"));
        assertThat(json(onboard).get("redirectTo").asText()).isEqualTo("/admin/orders");
        assertThat(riderPassword("r4")).startsWith("$2b$10$").isNotEqualTo("newpw");
        assertThat(onboard.headers().firstValue("Set-Cookie").orElseThrow()).startsWith("executive_id=eyJ");
    }

    // ------------------------------------------------------------------------------------- helpers

    private HttpResponse<String>[] cityWrites(String cookie) throws Exception {
        @SuppressWarnings("unchecked")
        HttpResponse<String>[] out = new HttpResponse[] {
                send("PUT", "/api/cities/c-chennai/pincodes", cookie, Map.of("pincodes", new String[] {})),
                send("PUT", "/api/cities/c-chennai/active", cookie, Map.of("isActive", false)),
                send("PUT", "/api/cities/partners/u-p1/pincodes", cookie, Map.of("pincodes", new String[] {})),
                send("POST", "/api/cities/partners/u-p1/remove", cookie, Map.of()),
                send("POST", "/api/cities/hubs", cookie, Map.of("cityName", "Erode"))};
        return out;
    }

    private String territory() {
        return jdbc.queryForList("SELECT name, \"isActive\", array_to_string(pincodes, ',') AS p FROM \"City\" ORDER BY name").toString()
                + jdbc.queryForList("SELECT email, \"cityId\", array_to_string(pincodes, ',') AS p FROM \"User\" ORDER BY email");
    }

    private String riderPassword(String id) {
        return jdbc.queryForObject("SELECT password FROM \"Rider\" WHERE id = ?", String.class, id);
    }

    private String session(String id, String email, String role) {
        return "session=" + new SessionTokenCodec(PostgresTestBase.AUTH_SECRET, mapper)
                .sign(new SessionUser(id, email, "Test", role), "2099-01-01T00:00:00.000Z", Instant.now().getEpochSecond());
    }

    private JsonNode executive(String cookie) throws Exception {
        return json(send("GET", "/api/executive/session", cookie, null)).get("executive");
    }

    private HttpResponse<String> send(String method, String path, String cookie, Object body) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
        if (cookie != null) {
            b.header("Cookie", cookie);
        }
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode json(HttpResponse<String> r) throws Exception {
        return mapper.readTree(r.body());
    }
}
