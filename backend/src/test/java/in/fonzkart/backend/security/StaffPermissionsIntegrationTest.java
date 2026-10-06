package in.fonzkart.backend.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.auth.session.SessionTokenCodec;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.support.PostgresTestBase;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
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
 * Staff permissions (StaffAccess), each role against each protected operation, on db/03-staff-seed.sql. Mirrors the
 * website's scripts/security-tests/permissions.test.ts; StaffScenarioParityTest shows both behave identically.
 * Roles are taken from the database: "stale" holds a valid cookie claiming ADMIN for an account that is USER.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
@DirtiesContext
class StaffPermissionsIntegrationTest {

    private static final String FORBIDDEN_ROLE = "Forbidden: Admin access required";
    private static final String FORBIDDEN_SCOPE = "Forbidden: Outside your assigned cities";
    private static final String FORBIDDEN_TEAM = "Forbidden: Outside your team";
    private static final String FORBIDDEN_TARGET = "Forbidden: Cannot change this user's role";
    private static final String FORBIDDEN_EXEC = "Forbidden: Insufficient privileges to grant executive access";

    private static final List<String> ADMINS = List.of("super", "admin");
    private static final List<String> NON_ADMIN_STAFF = List.of("zh1", "rm", "p1", "fe", "stale");

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
    private final Map<String, String> cookies = new LinkedHashMap<>();

    @BeforeEach
    void sessions() {
        account("perm-stale", "stale@example.test", "USER", null);
        Map<String, SessionUser> actors = Map.of(
                "super", new SessionUser("u-super", "admin@fonzkart.in", "Root", "SUPER_ADMIN"),
                "admin", new SessionUser("u-admin", "ops@example.test", "Ops", "ADMIN"),
                "zh1", new SessionUser("u-zh1", "zh1@example.test", "Zara", "ZONAL_HEAD"),
                "zh2", new SessionUser("u-zh2", "zh2@example.test", "Zubin", "ZONAL_HEAD"),
                "p1", new SessionUser("u-p1", "p1@example.test", "P1", "PARTNER"),
                "rm", new SessionUser("u-rm", "rm@example.test", "Rita", "RELATIONSHIP_MANAGER"),
                "fe", new SessionUser("u-fe", "fe@example.test", "Fe", "FIELD_EXECUTIVE"),
                "stale", new SessionUser("perm-stale", "stale@example.test", "Stale", "ADMIN"));
        SessionTokenCodec codec = new SessionTokenCodec(PostgresTestBase.AUTH_SECRET, mapper);
        actors.forEach((actor, user) -> cookies.put(actor,
                "session=" + codec.sign(user, "2099-01-01T00:00:00.000Z", Instant.now().getEpochSecond())));
    }

    // ------------------------------------------------------------------------------------------- roles

    @Test
    void onlyAdministratorsGrantOrRevokeAdminZonalHeadAndRelationshipManager() throws Exception {
        Map<String, String> grants = Map.of("/api/staff/admins", "ADMIN", "/api/staff/zonal-heads/grant", "ZONAL_HEAD",
                "/api/staff/relationship-managers/grant", "RELATIONSHIP_MANAGER");
        String target = account("perm-target", "grant-target@example.test", "USER", null);
        for (String path : grants.keySet()) {
            for (String actor : NON_ADMIN_STAFF) {
                expectError(actor, "POST", path, Map.of("email", target), 403, FORBIDDEN_ROLE);
            }
            expectError(null, "POST", path, Map.of("email", target), 401, "Unauthorized");
        }
        assertThat(role(target)).isEqualTo("USER");
        for (String actor : NON_ADMIN_STAFF) {
            expectError(actor, "POST", "/api/staff/roles/remove", Map.of("email", "ops@example.test"), 403, FORBIDDEN_ROLE);
            expectError(actor, "POST", "/api/staff/admins/remove", Map.of("email", "ops@example.test"), 403, FORBIDDEN_ROLE);
            expectError(actor, "GET", "/api/staff/admins", null, 403, FORBIDDEN_ROLE);
        }
        assertThat(role("ops@example.test")).isEqualTo("ADMIN");

        for (String actor : ADMINS) {
            for (Map.Entry<String, String> g : grants.entrySet()) {
                assertThat(ok(actor, "POST", g.getKey(), Map.of("email", target)).get("success").asBoolean()).isTrue();
                assertThat(role(target)).isEqualTo(g.getValue());
                assertThat(ok(actor, "POST", "/api/staff/roles/remove", Map.of("email", target)).get("success").asBoolean()).isTrue();
                assertThat(role(target)).isEqualTo("USER");
            }
            assertThat(ok(actor, "GET", "/api/staff/admins", null).isArray()).isTrue();
        }
    }

    @Test
    void partnerGrantsAreLimitedToOrdinaryAccountsAndTheZonalHeadsCities() throws Exception {
        for (String actor : List.of("p1", "fe", "stale")) {
            expectError(actor, "POST", "/api/staff/partners/grant",
                    Map.of("email", account("perm-pp1", "pp-1@example.test", "USER", null)), 403, FORBIDDEN_ROLE);
        }
        expectError("zh1", "POST", "/api/staff/partners/grant", Map.of("email", "ops@example.test"), 403, FORBIDDEN_TARGET);
        expectError("rm", "POST", "/api/staff/partners/grant", Map.of("email", "zh2@example.test"), 403, FORBIDDEN_TARGET);
        String pp2 = account("perm-pp2", "pp-2@example.test", "USER", null);
        expectError("zh1", "POST", "/api/staff/partners/grant", Map.of("email", pp2, "cityId", "c-madurai"), 403, FORBIDDEN_SCOPE);
        expectError("zh1", "POST", "/api/staff/partners/grant",
                Map.of("email", pp2, "cityId", "c-chennai", "managerId", "u-zh2"), 403, FORBIDDEN_SCOPE);
        assertThat(List.of(role("ops@example.test"), role(pp2))).containsExactly("ADMIN", "USER");

        ok("zh1", "POST", "/api/staff/partners/grant",
                Map.of("email", account("perm-pp3", "pp-3@example.test", "USER", null), "cityId", "c-chennai"));
        ok("rm", "POST", "/api/staff/partners/grant",
                Map.of("email", account("perm-pp4", "pp-4@example.test", "USER", null), "cityId", "c-madurai", "managerId", "u-zh2"));
        assertThat(List.of(role("pp-3@example.test"), role("pp-4@example.test"))).containsExactly("PARTNER", "PARTNER");
    }

    @Test
    void fieldExecutiveGrantsAreLimitedToOrdinaryAccounts() throws Exception {
        String fe1 = account("perm-fe1", "fe-1@example.test", "USER", null);
        for (String actor : List.of("rm", "fe", "stale")) {
            expectError(actor, "POST", "/api/riders/field-executives", Map.of("email", fe1), 403, FORBIDDEN_EXEC);
        }
        expectError("p1", "POST", "/api/riders/field-executives", Map.of("email", "ops@example.test"), 403, FORBIDDEN_TARGET);
        expectError("p1", "POST", "/api/riders/field-executives", Map.of("email", "zh2@example.test"), 403, FORBIDDEN_TARGET);
        expectError("zh1", "POST", "/api/riders/field-executives", Map.of("email", "rm@example.test"), 403, FORBIDDEN_TARGET);
        assertThat(List.of(role("ops@example.test"), role("zh2@example.test"), role("rm@example.test")))
                .containsExactly("ADMIN", "ZONAL_HEAD", "RELATIONSHIP_MANAGER");

        String fe2 = account("perm-fe2", "fe-2@example.test", "USER", "+917400000001");
        ok("p1", "POST", "/api/riders/field-executives", Map.of("email", fe2));
        assertThat(role(fe2)).isEqualTo("FIELD_EXECUTIVE");
        assertThat(jdbc.queryForObject("SELECT \"partnerId\" FROM \"Rider\" WHERE phone = '+917400000001'", String.class))
                .isEqualTo("u-p1");
        ok("zh1", "POST", "/api/riders/field-executives", Map.of("email", account("perm-fe3", "fe-3@example.test", "UNVERIFIED", null)));
    }

    @Test
    void partnerManagerChangesAndPartnerLists() throws Exception {
        for (String actor : NON_ADMIN_STAFF) {
            expectError(actor, "PUT", "/api/staff/partners/u-p3/manager", nullManager(), 403, FORBIDDEN_ROLE);
        }
        ok("admin", "PUT", "/api/staff/partners/u-p3/manager", Map.of("managerId", "u-zh1"));

        expectError(null, "GET", "/api/staff/partners/managed-by/u-zh1", null, 401, "Unauthorized");
        for (String actor : List.of("p1", "rm", "fe")) {
            expectError(actor, "GET", "/api/staff/partners/managed-by/u-zh1", null, 403, FORBIDDEN_ROLE);
        }
        expectError("zh1", "GET", "/api/staff/partners/managed-by/u-zh2", null, 403, FORBIDDEN_SCOPE);
        assertThat(ok("zh1", "GET", "/api/staff/partners/managed-by/u-zh1", null).toString()).contains("u-p3");
        ok("super", "GET", "/api/staff/partners/managed-by/u-zh2", null);
    }

    // ------------------------------------------------------------------------- pricing, landing page

    @Test
    void pricingRulesAndLandingPageSettingsAreForAdministrators() throws Exception {
        Map<String, Object> rule = Map.of("category", "perm-test", "questionKey", "q", "answerKey", "a", "label", "L",
                "deductionAmount", 1, "deductionPercent", 0);
        for (String actor : NON_ADMIN_STAFF) {
            expectError(actor, "PUT", "/api/pricing/rules", rule, 403, FORBIDDEN_ROLE);
            expectError(actor, "PUT", "/api/cities/c-chennai/featured", Map.of("isFeatured", true), 403, FORBIDDEN_ROLE);
            expectError(actor, "PUT", "/api/cities/c-chennai/display-order", Map.of("order", 9), 403, FORBIDDEN_ROLE);
            expectError(actor, "GET", "/api/cities/homepage", null, 403, FORBIDDEN_ROLE);
        }
        expectError(null, "PUT", "/api/pricing/rules", rule, 401, "Unauthorized");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"EvaluationRule\" WHERE category = 'perm-test'", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT \"displayOrder\" FROM \"City\" WHERE id = 'c-chennai'", Integer.class)).isEqualTo(2);
        for (String actor : ADMINS) {
            ok(actor, "PUT", "/api/pricing/rules", rule);
            ok(actor, "GET", "/api/cities/homepage", null);
        }
        ok("admin", "PUT", "/api/cities/c-chennai/display-order", Map.of("order", 9));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"EvaluationRule\" WHERE category = 'perm-test'", Integer.class)).isOne();
    }

    // ----------------------------------------------------------------------------- pages and forms

    @Test
    void pagesAndTheirFormsOpenOnlyForTheRolesTheSidebarOffersThemTo() throws Exception {
        Map<String, List<String>> pages = new LinkedHashMap<>();
        pages.put("/api/staff/directory", ADMINS);
        pages.put("/api/staff/zonal-heads", ADMINS);
        pages.put("/api/cities/active", ADMINS);
        pages.put("/api/cities/homepage", ADMINS);
        pages.put("/api/staff/partners/overview", List.of("super", "admin", "zh1", "rm"));
        pages.put("/api/cities/overview", List.of("super", "admin", "zh1"));
        pages.put("/api/riders/overview", List.of("super", "admin", "zh1", "p1"));
        for (Map.Entry<String, List<String>> page : pages.entrySet()) {
            for (String actor : List.of("super", "admin", "zh1", "rm", "p1", "fe")) {
                int status = send(actor, "GET", page.getKey(), null).statusCode();
                assertThat(status).as("%s for %s", page.getKey(), actor).isEqualTo(page.getValue().contains(actor) ? 200 : 403);
            }
        }

        Map<String, Object> zonalHead = Map.of("name", "ZH", "email", "zh-new@example.test", "phone", "+917600000001", "password", "pw");
        for (String actor : NON_ADMIN_STAFF) {
            expectError(actor, "POST", "/api/staff/zonal-heads", zonalHead, 403, FORBIDDEN_ROLE);
            expectError(actor, "POST", "/api/staff/zonal-heads/u-zh2/cities", Map.of("cityId", "c-salem"), 403, FORBIDDEN_ROLE);
            expectError(actor, "DELETE", "/api/staff/zonal-heads/u-zh1/cities/c-chennai", null, 403, FORBIDDEN_ROLE);
        }
        assertThat(jdbc.queryForObject("SELECT \"managerId\" FROM \"City\" WHERE id = 'c-chennai'", String.class)).isEqualTo("u-zh1");
        ok("admin", "POST", "/api/staff/zonal-heads", zonalHead);
        assertThat(role("zh-new@example.test")).isEqualTo("ZONAL_HEAD");

        Map<String, Object> partner = Map.of("name", "P", "email", "p-new@example.test", "phone", "+917600000002",
                "password", "pw", "cityId", "c-chennai", "managerId", "none");
        for (String actor : List.of("p1", "fe", "stale")) {
            expectError(actor, "POST", "/api/staff/partners", partner, 403, FORBIDDEN_ROLE);
            expectError(actor, "PUT", "/api/staff/partners/u-p2/assignment", Map.of("cityId", "none", "managerId", "none"), 403, FORBIDDEN_ROLE);
        }
        assertThat(jdbc.queryForObject("SELECT \"cityId\" FROM \"User\" WHERE id = 'u-p2'", String.class)).isEqualTo("c-madurai");
        ok("rm", "POST", "/api/staff/partners", partner);
        assertThat(role("p-new@example.test")).isEqualTo("PARTNER");
    }

    // ------------------------------------------------------------------------------------------ riders

    @Test
    void ridersCanOnlyBeManagedWithinTheCallersTeam() throws Exception {
        rider("perm-r-p1", "+917500000001", "u-p1");
        rider("perm-r-p2", "+917500000002", "u-p2");
        rider("perm-r-loose", "+917500000003", null);
        rider("u-admin", "+917500000004", "u-p1"); // a rider id that is also an ADMIN account's id

        expectError("p1", "POST", "/api/riders", Map.of("name", "X", "phone", "+917500000010", "partnerId", "u-p2"), 403, FORBIDDEN_TEAM);
        expectError("p1", "POST", "/api/riders", Map.of("name", "X", "phone", "+917500000010"), 403, FORBIDDEN_TEAM);
        expectError("zh1", "POST", "/api/riders", Map.of("name", "X", "phone", "+917500000010", "partnerId", "u-p2"), 403, FORBIDDEN_TEAM);
        for (String actor : List.of("rm", "fe", "stale")) {
            expectError(actor, "POST", "/api/riders", Map.of("name", "X", "phone", "+917500000010", "partnerId", "u-p1"), 403, FORBIDDEN_ROLE);
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"Rider\" WHERE phone = '+917500000010'", Integer.class)).isZero();
        ok("p1", "POST", "/api/riders", Map.of("name", "Mine", "phone", "+917500000011", "partnerId", "u-p1"));
        ok("zh1", "POST", "/api/riders", Map.of("name", "Loose", "phone", "+917500000013"));

        expectError("p1", "PUT", "/api/riders/perm-r-p1/partner", nullPartner(), 403, FORBIDDEN_ROLE);
        expectError("zh1", "PUT", "/api/riders/perm-r-p1/partner", Map.of("partnerId", "u-p2"), 403, FORBIDDEN_TEAM);
        expectError("zh1", "PUT", "/api/riders/perm-r-p2/partner", Map.of("partnerId", "u-p1"), 403, FORBIDDEN_TEAM);
        expectError("zh1", "PUT", "/api/riders/perm-r-loose/partner", Map.of("partnerId", "u-p1"), 403, FORBIDDEN_TEAM);
        ok("zh1", "PUT", "/api/riders/perm-r-p1/partner", Map.of("partnerId", "u-p3"));

        expectError("p1", "DELETE", "/api/riders/perm-r-p2", null, 403, FORBIDDEN_TEAM);
        expectError("p1", "DELETE", "/api/riders/u-zh1", null, 403, FORBIDDEN_TEAM);
        expectError("p1", "DELETE", "/api/riders/u-admin", null, 403, FORBIDDEN_TARGET);
        expectError("rm", "DELETE", "/api/riders/perm-r-p1", null, 403, FORBIDDEN_ROLE);
        assertThat(role("ops@example.test")).isEqualTo("ADMIN");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"Rider\" WHERE id IN ('perm-r-p2', 'u-admin')", Integer.class)).isEqualTo(2);

        String mine = jdbc.queryForObject("SELECT id FROM \"Rider\" WHERE phone = '+917500000011'", String.class);
        ok("p1", "DELETE", "/api/riders/" + mine, null);
        ok("zh1", "DELETE", "/api/riders/perm-r-p1", null);
        ok("admin", "DELETE", "/api/riders/perm-r-p2", null);
    }

    // ------------------------------------------------------------------------------------------ helpers

    private String account(String id, String email, String role, String phone) {
        jdbc.update("INSERT INTO \"User\" (id, name, email, \"passwordHash\", \"createdAt\", \"updatedAt\", role, phone) "
                + "VALUES (?, ?, ?, 'x', now(), now(), ?, ?) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role",
                id, email, email, role, phone);
        return email;
    }

    private void rider(String id, String phone, String partnerId) {
        jdbc.update("INSERT INTO \"Rider\" (id, name, phone, status, \"createdAt\", \"updatedAt\", \"partnerId\") "
                + "VALUES (?, ?, ?, 'available', now(), now(), ?) ON CONFLICT (id) DO NOTHING", id, id, phone, partnerId);
    }

    private String role(String email) {
        return jdbc.queryForObject("SELECT role FROM \"User\" WHERE email = ?", String.class, email);
    }

    private static Map<String, Object> nullManager() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("managerId", null);
        return m;
    }

    private static Map<String, Object> nullPartner() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("partnerId", null);
        return m;
    }

    private void expectError(String actor, String method, String path, Object body, int status, String message) throws Exception {
        HttpResponse<String> r = send(actor, method, path, body);
        assertThat(r.statusCode()).as("%s %s %s: %s", actor, method, path, r.body()).isEqualTo(status);
        assertThat(mapper.readTree(r.body()).get("error").asText()).as("%s %s %s", actor, method, path).isEqualTo(message);
    }

    private JsonNode ok(String actor, String method, String path, Object body) throws Exception {
        HttpResponse<String> r = send(actor, method, path, body);
        assertThat(r.statusCode()).as("%s %s %s: %s", actor, method, path, r.body()).isEqualTo(200);
        return r.body() == null || r.body().isEmpty() ? mapper.nullNode() : mapper.readTree(r.body());
    }

    private HttpResponse<String> send(String actor, String method, String path, Object body) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
        if (actor != null) {
            b.header("Cookie", cookies.get(actor));
        }
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }
}
