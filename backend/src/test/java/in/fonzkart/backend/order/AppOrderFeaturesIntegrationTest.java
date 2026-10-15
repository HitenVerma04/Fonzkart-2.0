package in.fonzkart.backend.order;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.support.PostgresTestBase;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
 * What the backend adds for the apps (beyond the website parity of OrderScenarioParityTest): the price of an order is
 * calculated on the server and equals the quote, the customer's order detail and inbox, the executive's inbox,
 * account deletion, and image uploads. Phone apps authenticate with {@code X-Client: mobile} + Bearer tokens.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class AppOrderFeaturesIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.prismaDatabaseWith(
            "db/02-catalog-data.sql", "db/03-staff-seed.sql", "db/04-pricing-rules-seed.sql");

    static final Path UPLOADS = createTemp();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
        registry.add("fonzkart.uploads.dir", UPLOADS::toString);
    }

    private static Path createTemp() {
        try {
            return Files.createTempDirectory("fz-uploads");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @LocalServerPort
    private int port;
    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();

    private String cust;
    private String user4;
    private String admin;
    private String rider;

    @BeforeEach
    void signIn() throws Exception {
        cust = token("/api/auth/signin", Map.of("email", "cust@example.test", "password", "pw"));
        user4 = token("/api/auth/signin", Map.of("email", "user4@example.test", "password", "pw"));
        admin = token("/api/auth/signin", Map.of("email", "ops@example.test", "password", "pw"));
        rider = token("/api/executive/login", Map.of("phone", "+917000000001", "password", "riderpw"));
    }

    // ------------------------------------------------------------------------------------------------ pricing

    @Test
    void theOrderPriceIsTheServerQuoteNotTheClientsPrice() throws Exception {
        Map<String, Object> answers = Map.of("physical_condition", "good", "body_condition", "flawless",
                "accessories", List.of("charger", "box", "bill"));
        JsonNode quote = call("POST", "/api/orders/quote", null,
                Map.of("device", "iPhone 13", "variant", "128GB", "answers", answers)).body();
        // iPhone 13 is stored with the alias category 'mobile'; the sell flow prices it as 'smartphone'.
        assertThat(quote.get("category").asText()).isEqualTo("smartphone");
        assertThat(quote.get("basePrice").asInt()).isEqualTo(29960);
        int price = quote.get("price").asInt();
        assertThat(price).isLessThan(29960).isPositive();

        // Same price as the website's pricing endpoint with the same inputs.
        JsonNode viaPricing = call("POST", "/api/pricing/calculate", null,
                Map.of("basePrice", 29960, "answers", answers, "category", "smartphone")).body();
        assertThat(viaPricing.asInt()).isEqualTo(price);

        Map<String, Object> order = new java.util.HashMap<>(Map.of("device", "iPhone 13", "variant", "128GB",
                "address", "12 Test Rd", "pincode", "600001", "answers", answers));
        order.put("price", 999999);          // ignored
        order.put("category", "no-rules");   // ignored: the model decides
        Res placed = call("POST", "/api/orders", cust, order);
        assertThat(placed.status()).isEqualTo(200);
        assertThat(placed.body().get("price").asInt()).isEqualTo(price);
        Integer stored = jdbc.queryForObject("SELECT price FROM \"Order\" WHERE id = ?", Integer.class,
                placed.body().get("id").asText());
        assertThat(stored).isEqualTo(price);

        Res unknown = call("POST", "/api/orders", cust, Map.of("device", "Phone X9000", "variant", "1TB",
                "address", "a", "pincode", "600001", "answers", Map.of()));
        assertThat(unknown.status()).isEqualTo(400);
        assertThat(unknown.body().get("error").asText()).isEqualTo("Invalid: Device not found");
    }

    // ------------------------------------------------------------------------------------------------ tracker + inbox

    @Test
    void customersSeeOnlyTheirOwnOrderAndAnInboxOfUpdates() throws Exception {
        JsonNode placed = call("POST", "/api/orders", cust, Map.of("device", "Galaxy S21", "variant", "8GB + 128GB",
                "address", "5 Inbox St, Chennai", "pincode", "600002", "answers", Map.of("physical_condition", "good"))).body();
        String id = placed.get("id").asText();

        Res mine = call("GET", "/api/orders/" + id, cust, null);
        assertThat(mine.status()).isEqualTo(200);
        assertThat(mine.body().get("device").asText()).isEqualTo("Galaxy S21 (8GB + 128GB)");
        assertThat(mine.body().get("executive").isNull()).isTrue();
        assertThat(call("GET", "/api/orders/" + id, user4, null).status()).isEqualTo(404);
        assertThat(call("GET", "/api/orders/" + id, null, null).status()).isEqualTo(401);

        // Staff assigns Ravi (r1, Partner One covers 600002): the tracker shows who is coming; the inbox says so.
        assertThat(call("POST", "/api/staff/orders/" + id + "/rider", admin, Map.of("riderId", "r1")).status()).isEqualTo(200);
        JsonNode tracked = call("GET", "/api/orders/" + id, cust, null).body();
        assertThat(tracked.get("status").asText()).isEqualTo("assigned");
        assertThat(tracked.get("executive").get("name").asText()).isEqualTo("Ravi");

        JsonNode inbox = call("GET", "/api/notifications", cust, null).body().get("notifications");
        List<String> titles = inbox.findValuesAsText("title");
        assertThat(titles).contains("Order placed", "Executive assigned");
        assertThat(inbox.findValuesAsText("userId")).containsOnly(jdbc.queryForObject(
                "SELECT id FROM \"User\" WHERE email = 'cust@example.test'", String.class));
        String first = inbox.get(0).get("id").asText();
        assertThat(call("POST", "/api/notifications/" + first + "/read", user4, null).body().get("success").asBoolean()).isFalse();
        assertThat(call("POST", "/api/notifications/" + first + "/read", cust, null).body().get("success").asBoolean()).isTrue();
        assertThat(call("POST", "/api/notifications/read-all", cust, null).body().get("success").asBoolean()).isTrue();

        // The executive's inbox has the task; nobody else's notifications.
        JsonNode riderInbox = call("GET", "/api/executive/notifications", rider, null).body().get("notifications");
        assertThat(riderInbox.findValuesAsText("title")).contains("New Task Assigned");
        assertThat(riderInbox.findValuesAsText("riderId")).containsOnly("r1");
        assertThat(call("GET", "/api/executive/orders/" + id, rider, null).status()).isEqualTo(200);
    }

    @Test
    void thePulseTestNotifiesOnlyTheStaffMemberWhoPressedIt() throws Exception {
        assertThat(call("POST", "/api/notifications/pulse-test", cust, null).body().get("success").asBoolean()).isFalse();
        assertThat(call("POST", "/api/notifications/pulse-test", null, null).body().get("success").asBoolean()).isFalse();
        assertThat(call("POST", "/api/notifications/pulse-test", admin, null).body().get("success").asBoolean()).isTrue();
        String adminId = jdbc.queryForObject("SELECT id FROM \"User\" WHERE email = 'ops@example.test'", String.class);
        assertThat(jdbc.queryForList("SELECT \"userId\" FROM \"Notification\" WHERE title = 'DB Heartbeat Pulse'", String.class))
                .containsExactly(adminId);
        JsonNode bell = call("GET", "/api/notifications", admin, null).body().get("notifications");
        assertThat(bell.findValuesAsText("title")).contains("DB Heartbeat Pulse");
    }

    // ------------------------------------------------------------------------------------------------ deletion

    @Test
    void deletingAnAccountAnonymisesItAndKeepsItsOrders() throws Exception {
        String user3 = token("/api/auth/signin", Map.of("email", "user3@example.test", "password", "pw"));
        String orderId = call("POST", "/api/orders", user3, Map.of("device", "iPhone 13", "variant", "128GB",
                "address", "7 Gone St", "pincode", "111111", "answers", Map.of())).body().get("id").asText();

        assertThat(call("DELETE", "/api/users/me", admin, null).status()).isEqualTo(403); // staff: by an administrator
        assertThat(call("DELETE", "/api/users/me", null, null).status()).isEqualTo(401);
        Res deleted = call("DELETE", "/api/users/me", user3, null);
        assertThat(deleted.status()).isEqualTo(200);

        Map<String, Object> row = jdbc.queryForMap("SELECT name, email, phone FROM \"User\" WHERE id = 'u-user3'");
        assertThat(row.get("name")).isEqualTo("Deleted user");
        assertThat((String) row.get("email")).endsWith("@deleted.invalid");
        assertThat(row.get("phone")).isNull();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"Order\" WHERE id = ?", Integer.class, orderId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"Notification\" WHERE \"userId\" = 'u-user3'", Integer.class)).isZero();

        // The old session no longer works, and the old password no longer signs in.
        assertThat(call("GET", "/api/orders", user3, null).body().size()).isZero();
        assertThat(call("GET", "/api/orders/" + orderId, user3, null).status()).isEqualTo(401);
        HttpResponse<String> again = raw("POST", "/api/auth/signin", null,
                Map.of("email", "user3@example.test", "password", "pw"));
        assertThat(again.headers().firstValue("X-Auth-Token")).isEmpty();
    }

    // ------------------------------------------------------------------------------------------------ uploads

    @Test
    void uploadsNeedASignInAndMustBeImages() throws Exception {
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
        assertThat(upload(null, "photo.png", png).statusCode()).isEqualTo(401);
        assertThat(upload(rider, "notes.png", "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8)).statusCode())
                .isEqualTo(415);

        HttpResponse<String> ok = upload(rider, "../../front photo.png", png);
        assertThat(ok.statusCode()).isEqualTo(200);
        String url = mapper.readTree(ok.body()).get("url").asText();
        assertThat(url).matches("/uploads/\\d+-\\d+-front.*\\.png");

        HttpResponse<byte[]> served = http.send(HttpRequest.newBuilder(uri(url)).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray());
        assertThat(served.statusCode()).isEqualTo(200);
        assertThat(served.headers().firstValue("Content-Type")).hasValue("image/png");
        assertThat(served.body()).isEqualTo(png);

        assertThat(upload(cust, "c.png", png).statusCode()).isEqualTo(200);
        assertThat(http.send(HttpRequest.newBuilder(uri("/uploads/..%2F..%2Fetc%2Fpasswd")).GET().build(),
                HttpResponse.BodyHandlers.ofString()).statusCode()).isIn(400, 404);
        assertThat(http.send(HttpRequest.newBuilder(uri("/uploads/missing.png")).GET().build(),
                HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(404);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private record Res(int status, JsonNode body) {
    }

    private String token(String path, Map<String, Object> body) throws Exception {
        HttpResponse<String> res = http.send(HttpRequest.newBuilder(uri(path))
                .header("Content-Type", "application/json").header("X-Client", "mobile")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build(),
                HttpResponse.BodyHandlers.ofString());
        return res.headers().firstValue("X-Auth-Token").orElseThrow(() -> new IllegalStateException("no token for " + body));
    }

    private Res call(String method, String path, String bearer, Object body) throws Exception {
        HttpResponse<String> res = raw(method, path, bearer, body);
        return new Res(res.statusCode(), res.body() == null || res.body().isEmpty() ? null : mapper.readTree(res.body()));
    }

    private HttpResponse<String> raw(String method, String path, String bearer, Object body) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(uri(path)).header("X-Client", "mobile");
        if (bearer != null) {
            b.header("Authorization", "Bearer " + bearer);
        }
        if (body != null) {
            b.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
        } else {
            b.method(method, HttpRequest.BodyPublishers.noBody());
        }
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> upload(String bearer, String filename, byte[] content) throws Exception {
        String boundary = "----fz" + UUID.randomUUID();
        byte[] head = ("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + filename
                + "\"\r\nContent-Type: image/png\r\n\r\n").getBytes(StandardCharsets.UTF_8);
        byte[] tail = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);
        byte[] all = new byte[head.length + content.length + tail.length];
        System.arraycopy(head, 0, all, 0, head.length);
        System.arraycopy(content, 0, all, head.length, content.length);
        System.arraycopy(tail, 0, all, head.length + content.length, tail.length);
        HttpRequest.Builder b = HttpRequest.newBuilder(uri("/api/uploads"))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(all));
        if (bearer != null) {
            b.header("Authorization", "Bearer " + bearer);
        }
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }
}
