package in.fonzkart.backend.user;

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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
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
 * User management behaviour not covered by the scenario parity test: session cookie format and interchange with
 * Next.js, profile, the role directory (app/admin/admins/page.tsx), partner and zonal-head administration
 * (app/admin/partners/page.tsx, app/admin/zonal-heads/page.tsx) including zonal-head scoping, and access control.
 * Expected values follow the original page code.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class StaffAdminIntegrationTest {

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

    @BeforeEach
    void cleanDatabase() {
        jdbc.update("DELETE FROM \"Rider\"");
        jdbc.update("DELETE FROM \"City\"");
        jdbc.update("DELETE FROM \"User\"");
    }

    // ---------------------------------------------------------------------------------- sessions

    @Test
    void loginAndLogoutCookiesMatchNextJs() throws Exception {
        HttpResponse<String> login = post("/api/auth/signup", null,
                Map.of("name", "Root", "email", "admin@fonzkart.in", "phone", "9000000000", "password", "pw"));
        assertThat(json(login).get("redirectTo").asText()).isEqualTo("/admin");
        String setCookie = login.headers().firstValue("Set-Cookie").orElseThrow();
        assertThat(setCookie).startsWith("session=").contains("Path=/", "Max-Age=604800", "HttpOnly", "SameSite=Lax");

        HttpResponse<String> logout = post("/api/auth/logout", cookie(setCookie), Map.of());
        assertThat(logout.headers().firstValue("Set-Cookie").orElseThrow()).startsWith("session=;").contains("Max-Age=0");
    }

    @Test
    void acceptsSessionCookiesIssuedByNextJsAndRejectsTamperedOnes() throws Exception {
        // Byte-identical to lib/session.ts encrypt() output for the same secret and input (see SessionTokenCodecTest).
        long iat = Instant.now().getEpochSecond();
        String nextJsToken = new SessionTokenCodec(PostgresTestBase.AUTH_SECRET, mapper).sign(
                new SessionUser("u-1", "Admin@Fonzkart.com", "Owner", "USER"), "2030-01-01T00:00:00.000Z", iat);

        JsonNode session = json(get("/api/auth/session", "session=" + nextJsToken)).get("session");
        assertThat(session.get("user").get("role").asText()).isEqualTo("SUPER_ADMIN"); // getSession() override
        assertThat(session.get("exp").asLong()).isEqualTo(iat + 604800);

        String tampered = nextJsToken.substring(0, nextJsToken.length() - 3) + "abc";
        assertThat(json(get("/api/auth/session", "session=" + tampered)).get("session").isNull()).isTrue();
        assertThat(json(get("/api/auth/session", null)).get("session").isNull()).isTrue();
    }

    @Test
    void executiveCookieMatchesNextJs() throws Exception {
        jdbc.update("INSERT INTO \"Rider\" (id, name, phone, status, password, \"createdAt\", \"updatedAt\") "
                + "VALUES ('r-x', 'Exec', '+917777777777', 'available', 'secret', now(), now())");
        HttpResponse<String> login = post("/api/executive/login", null, Map.of("phone", "+917777777777", "password", "secret"));
        assertThat(json(login).get("redirectTo").asText()).isEqualTo("/admin/orders");
        // lib/executive-session.ts: a signed token in a browser-session cookie (httpOnly, SameSite=Lax, path /)
        String setCookie = login.headers().firstValue("Set-Cookie").orElseThrow();
        assertThat(setCookie).startsWith("executive_id=eyJ").doesNotStartWith("executive_id=r-x;")
                .contains("Path=/", "HttpOnly", "SameSite=Lax").doesNotContain("Max-Age", "Expires");
        assertThat(json(get("/api/executive/session", cookie(setCookie))).get("executive").get("name").asText())
                .isEqualTo("Exec");
        assertThat(json(get("/api/executive/session", cookie(setCookie))).toString()).doesNotContain("secret", "password");
        // The raw rider id that the cookie used to hold is no longer accepted.
        assertThat(json(get("/api/executive/session", "executive_id=r-x")).get("executive").isNull()).isTrue();
        // The legacy plain-text password was replaced by a bcrypt hash on this successful login.
        assertThat(jdbc.queryForObject("SELECT password FROM \"Rider\" WHERE id = 'r-x'", String.class)).startsWith("$2b$10$");

        HttpResponse<String> logout = post("/api/executive/logout", null, Map.of());
        assertThat(json(logout).get("redirectTo").asText()).isEqualTo("/login");
        assertThat(logout.headers().firstValue("Set-Cookie").orElseThrow()).startsWith("executive_id=;").contains("Max-Age=0");
    }

    // ----------------------------------------------------------------------------------- profile

    @Test
    void profileRequiresSessionAndReturnsDatabasePhone() throws Exception {
        assertThat(get("/api/users/me", null).statusCode()).isEqualTo(401);
        String cookie = quickRegister("Pat", "pat@example.test", "+919999999999");
        JsonNode profile = json(get("/api/users/me", cookie));
        assertThat(profile.get("email").asText()).isEqualTo("pat@example.test");
        assertThat(profile.get("phone").asText()).isEqualTo("+919999999999");
        assertThat(profile.get("role").asText()).isEqualTo("USER");
    }

    // ------------------------------------------------------------------------- role directory page

    @Test
    void directoryGroupsUsersAndDemotesForcedUserAccounts() throws Exception {
        String admin = superAdmin();
        quickRegister("MS", "mobilesouls.in@gmail.com", null);
        jdbc.update("UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'mobilesouls.in@gmail.com'");
        quickRegister("Ann", "ann@example.test", null);
        jdbc.update("UPDATE \"User\" SET role = 'FIELD_EXECUTIVE' WHERE email = 'ann@example.test'");

        assertThat(get("/api/staff/directory", null).statusCode()).isEqualTo(401);
        assertThat(get("/api/staff/directory", quickRegister("U", "u@example.test", null)).statusCode()).isEqualTo(403);

        JsonNode dir = json(get("/api/staff/directory", admin));
        // Configured super admins are always listed (placeholders for those not in the database)
        assertThat(emails(dir.get("superAdmins")))
                .containsExactly("admin@fonzkart.in", "admin@fonzkart.com", "noumaanraihaan@gmail.com");
        assertThat(dir.get("superAdmins").get(2).get("name").asText()).isEqualTo("Noumaan Raihaan");
        assertThat(dir.get("superAdmins").get(1).get("id").asText()).isEqualTo("superadmin-admin_fonzkart_com");
        assertThat(emails(dir.get("admins"))).isEmpty(); // forced-user account is not an admin
        assertThat(dir.get("fieldExecutiveUsers").get(0).get("phone").asText()).isEqualTo("ann@example.test");
        assertThat(dir.toString()).doesNotContain("passwordHash", "resetToken");
        // Side effect of the original page: the forced-user account is demoted in the database
        assertThat(role("mobilesouls.in@gmail.com")).isEqualTo("USER");
    }

    // ---------------------------------------------------------------------------- zonal heads page

    @Test
    void zonalHeadCreationAndListing() throws Exception {
        String admin = superAdmin();
        assertThat(json(post("/api/staff/zonal-heads", admin, Map.of("name", "Z", "email", "z@example.test")))
                .get("created").asBoolean()).isFalse(); // no password: the original form action does nothing
        assertThat(json(post("/api/staff/zonal-heads", admin,
                Map.of("name", "Zed", "email", "zed@example.test", "phone", "9123456789", "password", "zpw")))
                .get("created").asBoolean()).isTrue();

        Map<String, Object> row = jdbc.queryForMap("SELECT id, role, phone, \"passwordHash\", pincodes::text AS pins, "
                + "\"createdAt\" = \"updatedAt\" AS same FROM \"User\" WHERE email = 'zed@example.test'");
        assertThat((String) row.get("id")).matches("c[0-9a-z]{24}"); // Prisma cuid() format
        assertThat(row.get("role")).isEqualTo("ZONAL_HEAD");
        assertThat(row.get("phone")).isEqualTo("9123456789"); // inline form does not add +91
        assertThat((String) row.get("passwordHash")).startsWith("$2b$10$");
        assertThat(row.get("pins")).isEqualTo("{}");
        assertThat(row.get("same")).isEqualTo(true);

        String zhId = (String) row.get("id");
        insertCity("c-1", "Chennai", true, zhId);
        String partnerCookie = quickRegister("Pia", "pia@example.test", null);
        post("/api/staff/partners/grant", admin, Map.of("email", "pia@example.test", "cityId", "c-1", "managerId", zhId));

        JsonNode list = json(get("/api/staff/zonal-heads", admin));
        assertThat(list).hasSize(1);
        assertThat(list.get(0).get("email").asText()).isEqualTo("zed@example.test");
        assertThat(list.get(0).get("managedCities").get(0).get("name").asText()).isEqualTo("Chennai");
        assertThat(list.get(0).get("managedUsers").get(0).get("email").asText()).isEqualTo("pia@example.test");
        assertThat(list.get(0).get("managedUsers").get(0).get("city").get("id").asText()).isEqualTo("c-1");

        assertThat(post("/api/staff/zonal-heads", null, Map.of("name", "X", "email", "x@x", "password", "p"))
                .statusCode()).isEqualTo(401);
        assertThat(post("/api/staff/zonal-heads", quickRegister("V", "v@example.test", null),
                Map.of("name", "X", "email", "x@x", "password", "p")).statusCode()).isEqualTo(403);
        assertThat(partnerCookie).isNotNull();
    }

    // ------------------------------------------------------------------------------- partners page

    @Test
    void partnerAdministrationAppliesZonalHeadScoping() throws Exception {
        String admin = superAdmin();
        String zhCookie = quickRegister("Zara", "zara@example.test", null);
        post("/api/staff/zonal-heads/grant", admin, Map.of("email", "zara@example.test"));
        zhCookie = quickLogin("zara@example.test"); // refresh role in the session
        String zhId = id("zara@example.test");

        insertCity("c-managed", "Madurai", true, zhId);
        insertCity("c-other", "Coimbatore", true, null);
        insertCity("c-inactive", "Salem", false, zhId);

        // Zonal head: city outside their territory -> nothing created (original returns early)
        assertThat(json(post("/api/staff/partners", zhCookie, partner("p1@example.test", "c-other", "none")))
                .get("created").asBoolean()).isFalse();
        // Zonal head: managed city -> created, and the zonal head becomes the manager
        assertThat(json(post("/api/staff/partners", zhCookie, partner("p2@example.test", "c-managed", "ignored")))
                .get("created").asBoolean()).isTrue();
        assertThat(jdbc.queryForObject("SELECT \"managerId\" FROM \"User\" WHERE email='p2@example.test'", String.class))
                .isEqualTo(zhId);
        // Admin: picks city and manager freely; 'none' means no manager
        post("/api/staff/partners", admin, partner("p3@example.test", "c-other", "none"));
        assertThat(jdbc.queryForObject("SELECT \"managerId\" FROM \"User\" WHERE email='p3@example.test'", String.class))
                .isNull();

        JsonNode zhView = json(get("/api/staff/partners/overview", zhCookie));
        assertThat(emails(zhView.get("partners"))).containsExactly("p2@example.test");
        assertThat(zhView.get("partners").get(0).get("city").get("name").asText()).isEqualTo("Madurai");
        assertThat(zhView.get("partners").get(0).get("manager").get("email").asText()).isEqualTo("zara@example.test");
        assertThat(ids(zhView.get("availableCities"))).containsExactly("c-managed");

        JsonNode adminView = json(get("/api/staff/partners/overview", admin));
        assertThat(emails(adminView.get("partners"))).containsExactlyInAnyOrder("p2@example.test", "p3@example.test");
        assertThat(ids(adminView.get("availableCities"))).containsExactly("c-other", "c-managed"); // by name
        assertThat(emails(adminView.get("zonalHeads"))).containsExactly("zara@example.test");

        // Zonal head reassignment: city outside territory keeps the current city; manager cannot change
        String p2 = id("p2@example.test");
        put("/api/staff/partners/" + p2 + "/assignment", zhCookie, Map.of("cityId", "c-other", "managerId", "none"));
        assertThat(jdbc.queryForMap("SELECT \"cityId\", \"managerId\" FROM \"User\" WHERE id = ?", p2))
                .containsEntry("cityId", "c-managed").containsEntry("managerId", zhId);
        // ... and partners outside their view cannot be touched
        assertThat(put("/api/staff/partners/" + id("p3@example.test") + "/assignment", zhCookie,
                Map.of("cityId", "c-managed", "managerId", "none")).statusCode()).isEqualTo(404);
        // Admin reassignment: 'none' clears city and manager
        put("/api/staff/partners/" + p2 + "/assignment", admin, Map.of("cityId", "none", "managerId", "none"));
        assertThat(jdbc.queryForMap("SELECT \"cityId\", \"managerId\" FROM \"User\" WHERE id = ?", p2))
                .containsEntry("cityId", null).containsEntry("managerId", null);
    }

    @Test
    void relationshipManagersOwnTheirPartnersAndSeeOnlyThemOnTheDashboard() throws Exception {
        String admin = superAdmin();
        quickRegister("Rita", "rita@example.test", null);
        quickRegister("Ravi", "ravi@example.test", null);
        quickRegister("Upgrade", "upgrade@example.test", null);
        post("/api/staff/relationship-managers/grant", admin, Map.of("email", "rita@example.test"));
        post("/api/staff/relationship-managers/grant", admin, Map.of("email", "ravi@example.test"));
        String rita = quickLogin("rita@example.test");
        String ritaId = id("rita@example.test");
        String raviId = id("ravi@example.test");
        insertCity("c-one", "Chennai", true, null);

        // An RM's new partner is theirs, whatever the form says.
        Map<String, Object> byRita = new java.util.HashMap<>(partner("pa@example.test", "c-one", "none"));
        byRita.put("relationshipManagerId", raviId);
        post("/api/staff/partners", rita, byRita);
        assertThat(rmOf("pa@example.test")).isEqualTo(ritaId);
        // Administrators choose; only RELATIONSHIP_MANAGER users are accepted.
        Map<String, Object> byAdmin = new java.util.HashMap<>(partner("pb@example.test", "c-one", "none"));
        byAdmin.put("relationshipManagerId", raviId);
        post("/api/staff/partners", admin, byAdmin);
        assertThat(rmOf("pb@example.test")).isEqualTo(raviId);
        Map<String, Object> notAnRm = new java.util.HashMap<>(partner("pc@example.test", "c-one", "none"));
        notAnRm.put("relationshipManagerId", id("admin@fonzkart.in")); // a super admin, not an RM
        post("/api/staff/partners", admin, notAnRm);
        assertThat(rmOf("pc@example.test")).isNull();
        // addPartner by an RM.
        post("/api/staff/partners/grant", rita, Map.of("email", "upgrade@example.test"));
        assertThat(rmOf("upgrade@example.test")).isEqualTo(ritaId);

        // RMs cannot move partners between RMs; administrators can, and "none" clears it.
        String pb = id("pb@example.test");
        put("/api/staff/partners/" + pb + "/assignment", rita, Map.of("cityId", "c-one", "managerId", "none", "relationshipManagerId", ritaId));
        assertThat(rmOf("pb@example.test")).isEqualTo(raviId);
        put("/api/staff/partners/" + pb + "/assignment", admin, Map.of("cityId", "c-one", "managerId", "none", "relationshipManagerId", ritaId));
        assertThat(rmOf("pb@example.test")).isEqualTo(ritaId);
        put("/api/staff/partners/" + pb + "/assignment", admin, Map.of("cityId", "c-one", "managerId", "none", "relationshipManagerId", "none"));
        assertThat(rmOf("pb@example.test")).isNull();

        JsonNode overview = json(get("/api/staff/partners/overview", admin));
        assertThat(emails(overview.get("relationshipManagers"))).containsExactly("ravi@example.test", "rita@example.test");
        for (JsonNode p : overview.get("partners")) {
            if (p.get("email").asText().equals("pa@example.test")) {
                assertThat(p.get("relationshipManager").get("email").asText()).isEqualTo("rita@example.test");
                assertThat(p.get("relationshipManagerId").asText()).isEqualTo(ritaId);
            }
        }

        // Dashboard: Rita's partners only; orders by "partnerId", unrouted legacy orders by pincode.
        String pa = id("pa@example.test");
        jdbc.update("UPDATE \"User\" SET pincodes = '{600001}' WHERE id = ? OR id = ?", pa, pb);
        String customer = id("upgrade@example.test");
        insertOrder("o-routed", customer, pa, "600009");
        insertOrder("o-legacy", customer, null, "600001");
        insertOrder("o-elsewhere", customer, pb, "600001"); // routed to another partner although pa covers 600001
        JsonNode dashboard = json(get("/api/staff/rm-dashboard", rita));
        assertThat(emails(dashboard.get("partners"))).containsExactly("pa@example.test", "upgrade@example.test");
        JsonNode paView = dashboard.get("partners").get(0);
        assertThat(ids(paView.get("orders"))).containsExactlyInAnyOrder("o-routed", "o-legacy");
        assertThat(paView.get("orders").get(0).has("partnerId")).isTrue();
        String ravi = quickLogin("ravi@example.test");
        assertThat(json(get("/api/staff/rm-dashboard", ravi)).get("partners")).isEmpty();
    }

    private String rmOf(String email) {
        return jdbc.queryForObject("SELECT \"relationshipManagerId\" FROM \"User\" WHERE email = ?", String.class, email);
    }

    private void insertOrder(String id, String userId, String partnerId, String pincode) {
        jdbc.update("INSERT INTO \"Order\" (id, \"userId\", device, price, status, address, \"createdAt\", \"updatedAt\", "
                + "pincode, \"partnerId\") VALUES (?, ?, 'Phone', 1000, 'Pending Pickup', 'Addr', now(), now(), ?, ?)",
                id, userId, pincode, partnerId);
    }

    // ---------------------------------------------------------------------------------- helpers

    private Map<String, Object> partner(String email, String cityId, String managerId) {
        return Map.of("name", "Partner", "email", email, "phone", "+9180000" + Math.abs(email.hashCode() % 100000), "password", "ppw", "cityId", cityId,
                "managerId", managerId);
    }

    private String superAdmin() throws Exception {
        HttpResponse<String> r = post("/api/auth/signup", null,
                Map.of("name", "Root", "email", "admin@fonzkart.in", "phone", "9000000000", "password", "pw"));
        return cookie(r.headers().firstValue("Set-Cookie").orElseThrow());
    }

    private String quickRegister(String name, String email, String phone) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>(Map.of("name", name, "email", email, "password", "pw"));
        if (phone != null) {
            body.put("phone", phone);
        }
        return cookie(post("/api/auth/quick-register", null, body).headers().firstValue("Set-Cookie").orElseThrow());
    }

    private String quickLogin(String email) throws Exception {
        return cookie(post("/api/auth/quick-login", null, Map.of("email", email, "password", "pw"))
                .headers().firstValue("Set-Cookie").orElseThrow());
    }

    private void insertCity(String id, String name, boolean active, String managerId) {
        jdbc.update("INSERT INTO \"City\" (id, name, \"isActive\", pincodes, \"displayOrder\", \"isFeatured\", "
                + "\"createdAt\", \"updatedAt\", \"managerId\") VALUES (?, ?, ?, '{}', 0, false, now(), now(), ?)",
                id, name, active, managerId);
    }

    private String id(String email) {
        return jdbc.queryForObject("SELECT id FROM \"User\" WHERE email = ?", String.class, email);
    }

    private String role(String email) {
        return jdbc.queryForObject("SELECT role FROM \"User\" WHERE email = ?", String.class, email);
    }

    private static String cookie(String setCookie) {
        return setCookie.split(";", 2)[0];
    }

    private static List<String> emails(JsonNode array) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(n.get("email").asText()));
        return out;
    }

    private static List<String> ids(JsonNode array) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(n.get("id").asText()));
        return out;
    }

    private JsonNode json(HttpResponse<String> r) throws Exception {
        assertThat(r.statusCode()).as(r.body()).isEqualTo(200);
        return mapper.readTree(r.body());
    }

    private HttpResponse<String> get(String path, String cookie) throws Exception {
        return send(HttpRequest.newBuilder(uri(path)).GET(), cookie);
    }

    private HttpResponse<String> post(String path, String cookie, Map<String, ?> body) throws Exception {
        return send(HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))), cookie);
    }

    private HttpResponse<String> put(String path, String cookie, Map<String, ?> body) throws Exception {
        return send(HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))), cookie);
    }

    private HttpResponse<String> send(HttpRequest.Builder b, String cookie) throws Exception {
        if (cookie != null) {
            b.header("Cookie", cookie);
        }
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }
}
