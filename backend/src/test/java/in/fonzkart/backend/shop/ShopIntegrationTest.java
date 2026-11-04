package in.fonzkart.backend.shop;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.support.PostgresTestBase;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.HashMap;
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

/** The screen guard shop: who may change it, what customers see, how orders are priced, and what a guard may contain. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class ShopIntegrationTest {

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
        jdbc.update("DELETE FROM \"ShopOrder\"");
        jdbc.update("DELETE FROM \"ScreenGuard\"");
        jdbc.update("DELETE FROM \"AppSetting\"");
        jdbc.update("DELETE FROM \"User\"");
    }

    @Test
    void administratorsChooseTheFestiveTheme() throws Exception {
        assertThat(json(get("/api/app/theme", null)).get("theme").asText()).isEqualTo("none");

        assertThat(put("/api/app/admin/theme", null, Map.of("theme", "diwali")).statusCode()).isEqualTo(401);
        String customer = quickRegister("Cara", "cara@example.test");
        assertThat(put("/api/app/admin/theme", customer, Map.of("theme", "diwali")).statusCode()).isEqualTo(403);
        assertThat(json(get("/api/app/theme", null)).get("theme").asText()).isEqualTo("none");

        String admin = admin();
        assertThat(json(put("/api/app/admin/theme", admin, Map.of("theme", "diwali"))).get("success").asBoolean()).isTrue();
        assertThat(json(get("/api/app/theme", null)).get("theme").asText()).isEqualTo("diwali");

        assertThat(put("/api/app/admin/theme", admin, Map.of("theme", "holi")).statusCode()).isEqualTo(400);
        assertThat(json(get("/api/app/theme", null)).get("theme").asText()).isEqualTo("diwali");

        assertThat(json(put("/api/app/admin/theme", admin, Map.of("theme", "none"))).get("success").asBoolean()).isTrue();
        assertThat(json(get("/api/app/theme", null)).get("theme").asText()).isEqualTo("none");
    }

    @Test
    void onlyAdministratorsChangeTheShop() throws Exception {
        assertThat(post("/api/shop/admin/screen-guards", null, guard("Glass", 999, 499)).statusCode()).isEqualTo(401);
        assertThat(get("/api/shop/admin/screen-guards", null).statusCode()).isEqualTo(401);

        String customer = quickRegister("Cara", "cara@example.test");
        assertThat(post("/api/shop/admin/screen-guards", customer, guard("Glass", 999, 499)).statusCode()).isEqualTo(403);
        assertThat(get("/api/shop/admin/screen-guards", customer).statusCode()).isEqualTo(403);
        assertThat(put("/api/shop/admin/settings", customer, Map.of("storeEnabled", false)).statusCode()).isEqualTo(403);
        assertThat(get("/api/shop/admin/orders", customer).statusCode()).isEqualTo(403);

        String partner = quickRegister("Pat", "pat@example.test");
        jdbc.update("UPDATE \"User\" SET role = 'PARTNER' WHERE email = 'pat@example.test'");
        assertThat(post("/api/shop/admin/screen-guards", partner, guard("Glass", 999, 499)).statusCode()).isEqualTo(403);

        String admin = admin();
        JsonNode added = json(post("/api/shop/admin/screen-guards", admin, guard("Glass", 999, 499)));
        assertThat(added.get("success").asBoolean()).isTrue();
        String id = added.get("id").asText();

        assertThat(put("/api/shop/admin/screen-guards/" + id, customer, guard("Changed", 999, 499)).statusCode()).isEqualTo(403);
        assertThat(delete("/api/shop/admin/screen-guards/" + id, customer).statusCode()).isEqualTo(403);
        assertThat(jdbc.queryForObject("SELECT name FROM \"ScreenGuard\"", String.class)).isEqualTo("Glass");
    }

    @Test
    void administratorsEditGuardsAndSwitches() throws Exception {
        String admin = admin();
        JsonNode empty = json(get("/api/shop/admin/screen-guards", admin));
        assertThat(empty.get("settings").get("storeEnabled").asBoolean()).isTrue();
        assertThat(empty.get("settings").get("discountsEnabled").asBoolean()).isTrue();
        assertThat(empty.get("items").size()).isZero();

        String a = json(post("/api/shop/admin/screen-guards", admin, guard("Alpha", 949, 749))).get("id").asText();
        String b = json(post("/api/shop/admin/screen-guards", admin, guard("Beta", 499, 299))).get("id").asText();
        JsonNode items = json(get("/api/shop/admin/screen-guards", admin)).get("items");
        assertThat(ids(items)).containsExactly(a, b);
        assertThat(items.get(1).get("displayOrder").asInt()).isEqualTo(1);
        JsonNode first = items.get(0);
        assertThat(first.get("guardType").asText()).isEqualTo("tempered");
        assertThat(first.get("brand").asText()).isEqualTo("Apple");
        assertThat(first.get("model").asText()).isEqualTo("iPhone 15");
        assertThat(first.get("imageUrl").isNull()).isTrue();
        assertThat(first.get("mrp").asInt()).isEqualTo(949);
        assertThat(first.get("price").asInt()).isEqualTo(749);
        assertThat(first.get("isActive").asBoolean()).isTrue();

        Map<String, Object> change = guard("Alpha Pro", 1099, 799);
        change.put("imageUrl", "/uploads/alpha.png");
        change.put("isActive", false);
        assertThat(json(put("/api/shop/admin/screen-guards/" + a, admin, change)).get("id").asText()).isEqualTo(a);
        JsonNode changed = json(get("/api/shop/admin/screen-guards", admin)).get("items").get(0);
        assertThat(changed.get("name").asText()).isEqualTo("Alpha Pro");
        assertThat(changed.get("imageUrl").asText()).isEqualTo("/uploads/alpha.png");
        assertThat(changed.get("isActive").asBoolean()).isFalse();
        assertThat(changed.get("displayOrder").asInt()).isZero();

        json(put("/api/shop/admin/settings", admin, Map.of("discountsEnabled", false)));
        JsonNode settings = json(get("/api/shop/admin/screen-guards", admin)).get("settings");
        assertThat(settings.get("storeEnabled").asBoolean()).isTrue();
        assertThat(settings.get("discountsEnabled").asBoolean()).isFalse();
        json(put("/api/shop/admin/settings", admin, Map.of("storeEnabled", false, "discountsEnabled", true)));
        settings = json(get("/api/shop/admin/screen-guards", admin)).get("settings");
        assertThat(settings.get("storeEnabled").asBoolean()).isFalse();
        assertThat(settings.get("discountsEnabled").asBoolean()).isTrue();

        assertThat(json(delete("/api/shop/admin/screen-guards/" + b, admin)).get("success").asBoolean()).isTrue();
        assertThat(delete("/api/shop/admin/screen-guards/" + b, admin).statusCode()).isEqualTo(404);
        assertThat(put("/api/shop/admin/screen-guards/missing", admin, guard("X", 10, 5)).statusCode()).isEqualTo(404);
    }

    @Test
    void customersSeeActiveGuardsPricedByTheDiscountSwitch() throws Exception {
        String admin = admin();
        String shown = json(post("/api/shop/admin/screen-guards", admin, guard("Shown", 949, 749))).get("id").asText();
        Map<String, Object> hidden = guard("Hidden", 500, 400);
        hidden.put("isActive", false);
        json(post("/api/shop/admin/screen-guards", admin, hidden));

        JsonNode store = json(get("/api/shop/screen-guards", null));
        assertThat(store.get("storeEnabled").asBoolean()).isTrue();
        assertThat(store.get("discountsEnabled").asBoolean()).isTrue();
        assertThat(ids(store.get("items"))).containsExactly(shown);
        assertThat(store.get("items").get(0).get("price").asInt()).isEqualTo(749);
        assertThat(store.get("items").get(0).get("mrp").asInt()).isEqualTo(949);

        json(put("/api/shop/admin/settings", admin, Map.of("discountsEnabled", false)));
        store = json(get("/api/shop/screen-guards", null));
        assertThat(store.get("discountsEnabled").asBoolean()).isFalse();
        assertThat(store.get("items").get(0).get("price").asInt()).isEqualTo(949);

        json(put("/api/shop/admin/settings", admin, Map.of("storeEnabled", false)));
        store = json(get("/api/shop/screen-guards", null));
        assertThat(store.get("storeEnabled").asBoolean()).isFalse();
        assertThat(store.get("items").size()).isZero();
    }

    @Test
    void customersOrderAtServerPricesAndAdministratorsMoveOrdersAlong() throws Exception {
        String admin = admin();
        String a = json(post("/api/shop/admin/screen-guards", admin, guard("Alpha", 949, 749))).get("id").asText();
        String b = json(post("/api/shop/admin/screen-guards", admin, guard("Beta", 499, 299))).get("id").asText();

        assertThat(post("/api/shop/orders", null, order(List.of(line(a, 1)))).statusCode()).isEqualTo(401);
        assertThat(get("/api/shop/orders", null).statusCode()).isEqualTo(401);

        String cara = quickRegister("Cara", "cara@example.test");
        Map<String, Object> body = order(List.of(line(a, 2), line(b, 1)));
        body.put("unitPrice", 1);
        body.put("total", 1);
        JsonNode placed = json(post("/api/shop/orders", cara, body));
        assertThat(placed.get("status").asText()).isEqualTo("placed");
        assertThat(placed.get("paymentMethod").asText()).isEqualTo("cod");
        assertThat(placed.get("total").asInt()).isEqualTo(2 * 749 + 299);
        assertThat(placed.get("orderNumber").asInt()).isPositive();
        assertThat(placed.get("createdAt").asText()).endsWith("Z");
        assertThat(placed.has("customerEmail")).isFalse();
        assertThat(placed.get("phone").asText()).isEqualTo("9876543210");
        JsonNode first = placed.get("items").get(0);
        assertThat(first.get("screenGuardId").asText()).isEqualTo(a);
        assertThat(first.get("name").asText()).isEqualTo("Alpha");
        assertThat(first.get("model").asText()).isEqualTo("iPhone 15");
        assertThat(first.get("quantity").asInt()).isEqualTo(2);
        assertThat(first.get("unitPrice").asInt()).isEqualTo(749);
        assertThat(first.get("unitMrp").asInt()).isEqualTo(949);

        json(put("/api/shop/admin/settings", admin, Map.of("discountsEnabled", false)));
        JsonNode atMrp = json(post("/api/shop/orders", cara, order(List.of(line(b, 1)))));
        assertThat(atMrp.get("total").asInt()).isEqualTo(499);
        assertThat(atMrp.get("items").get(0).get("unitPrice").asInt()).isEqualTo(499);

        String dan = quickRegister("Dan", "dan@example.test");
        json(post("/api/shop/orders", dan, order(List.of(line(a, 1)))));

        JsonNode mine = json(get("/api/shop/orders", cara));
        assertThat(ids(mine)).containsExactly(atMrp.get("id").asText(), placed.get("id").asText());

        JsonNode all = json(get("/api/shop/admin/orders", admin));
        assertThat(all.size()).isEqualTo(3);
        assertThat(all.get(1).get("customerEmail").asText()).isEqualTo("cara@example.test");

        String id = placed.get("id").asText();
        assertThat(put("/api/shop/admin/orders/" + id + "/status", cara, Map.of("status", "delivered")).statusCode()).isEqualTo(403);
        assertThat(error(put("/api/shop/admin/orders/" + id + "/status", admin, Map.of("status", "lost"))))
                .isEqualTo("Unknown order status.");
        assertThat(put("/api/shop/admin/orders/missing/status", admin, Map.of("status", "shipped")).statusCode()).isEqualTo(404);
        json(put("/api/shop/admin/orders/" + id + "/status", admin, Map.of("status", "shipped")));
        assertThat(jdbc.queryForObject("SELECT status FROM \"ShopOrder\" WHERE id = ?", String.class, id)).isEqualTo("shipped");

        // a deleted guard leaves the orders that have it as they were
        json(delete("/api/shop/admin/screen-guards/" + a, admin));
        assertThat(json(get("/api/shop/orders", cara)).get(1).get("items").get(0).get("name").asText()).isEqualTo("Alpha");
    }

    @Test
    void ordersAreChecked() throws Exception {
        String admin = admin();
        String a = json(post("/api/shop/admin/screen-guards", admin, guard("Alpha", 949, 749))).get("id").asText();
        Map<String, Object> off = guard("Off", 500, 400);
        off.put("isActive", false);
        String hidden = json(post("/api/shop/admin/screen-guards", admin, off)).get("id").asText();
        String cara = quickRegister("Cara", "cara@example.test");

        assertThat(error(post("/api/shop/orders", cara, order(List.of())))).isEqualTo("Your cart is empty.");
        assertThat(error(post("/api/shop/orders", cara, order(List.of(line(a, 0)))))).isEqualTo("The quantity must be from 1 to 5.");
        assertThat(error(post("/api/shop/orders", cara, order(List.of(line(a, 6)))))).isEqualTo("The quantity must be from 1 to 5.");
        assertThat(error(post("/api/shop/orders", cara, order(List.of(line(a, 1), line(a, 2))))))
                .isEqualTo("Each guard can be in the order once.");
        assertThat(error(post("/api/shop/orders", cara, order(List.of(line(hidden, 1))))))
                .startsWith("A guard in your cart is no longer sold.");
        assertThat(error(post("/api/shop/orders", cara, order(List.of(line("missing", 1))))))
                .startsWith("A guard in your cart is no longer sold.");

        List<Map<String, Object>> eleven = new ArrayList<>();
        for (int i = 0; i < 11; i++) {
            eleven.add(line("g" + i, 1));
        }
        assertThat(error(post("/api/shop/orders", cara, order(eleven)))).isEqualTo("An order can have at most 10 different guards.");

        Map<String, Object> badPhone = order(List.of(line(a, 1)));
        badPhone.put("phone", "12345");
        assertThat(error(post("/api/shop/orders", cara, badPhone))).isEqualTo("Enter a 10-digit phone number.");
        Map<String, Object> badPin = order(List.of(line(a, 1)));
        badPin.put("pincode", "4000");
        assertThat(error(post("/api/shop/orders", cara, badPin))).isEqualTo("Enter a 6-digit pincode.");
        Map<String, Object> noName = order(List.of(line(a, 1)));
        noName.put("name", "  ");
        assertThat(error(post("/api/shop/orders", cara, noName))).isEqualTo("Add your name.");
        Map<String, Object> noAddress = order(List.of(line(a, 1)));
        noAddress.put("address", "abc");
        assertThat(error(post("/api/shop/orders", cara, noAddress))).isEqualTo("Add your delivery address.");

        json(put("/api/shop/admin/settings", admin, Map.of("storeEnabled", false)));
        assertThat(error(post("/api/shop/orders", cara, order(List.of(line(a, 1)))))).isEqualTo("The store is closed right now.");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM \"ShopOrder\"", Integer.class)).isZero();

        // a deleted account cannot order
        json(put("/api/shop/admin/settings", admin, Map.of("storeEnabled", true)));
        jdbc.update("UPDATE \"User\" SET email = 'gone@deleted.invalid' WHERE email = 'cara@example.test'");
        assertThat(post("/api/shop/orders", cara, order(List.of(line(a, 1)))).statusCode()).isEqualTo(401);
    }

    @Test
    void guardsAreChecked() throws Exception {
        String admin = admin();
        String path = "/api/shop/admin/screen-guards";
        assertThat(error(post(path, admin, guard("", 999, 499)))).isEqualTo("Add a name.");
        assertThat(error(post(path, admin, guard("x".repeat(81), 999, 499)))).isEqualTo("The name can have at most 80 characters.");
        assertThat(error(post(path, admin, guard("Glass", 999, 1000)))).isEqualTo("The sale price cannot be more than the MRP.");
        assertThat(error(post(path, admin, guard("Glass", 0, 0)))).startsWith("The MRP must be");
        assertThat(error(post(path, admin, guard("Glass", 100_001, 5)))).startsWith("The MRP must be");
        assertThat(error(post(path, admin, guard("Glass", 999, 0)))).startsWith("The sale price must be");

        Map<String, Object> fraction = guard("Glass", 999, 499);
        fraction.put("price", 499.5);
        assertThat(error(post(path, admin, fraction))).startsWith("The sale price must be");
        Map<String, Object> type = guard("Glass", 999, 499);
        type.put("guardType", "diamond");
        assertThat(error(post(path, admin, type))).isEqualTo("Unknown guard type.");
        Map<String, Object> noModel = guard("Glass", 999, 499);
        noModel.put("model", " ");
        assertThat(error(post(path, admin, noModel))).isEqualTo("Add the phone brand and model it fits.");
        Map<String, Object> script = guard("Glass", 999, 499);
        script.put("imageUrl", "javascript:alert(1)");
        assertThat(error(post(path, admin, script))).isEqualTo("The picture must be an uploaded picture or an https link.");
        Map<String, Object> otherHost = guard("Glass", 999, 499);
        otherHost.put("imageUrl", "//evil.example/x.png");
        assertThat(error(post(path, admin, otherHost))).isEqualTo("The picture must be an uploaded picture or an https link.");
        assertThat(error(put("/api/shop/admin/settings", admin, Map.of()))).isEqualTo("Nothing to change.");

        Map<String, Object> https = guard("Glass", 999, 999);
        https.put("imageUrl", "https://cdn.example.test/g.png");
        json(post(path, admin, https));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM \"ScreenGuard\"", Integer.class)).isEqualTo(1);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private static Map<String, Object> guard(String name, double mrp, double price) {
        Map<String, Object> m = new HashMap<>();
        m.put("name", name);
        m.put("guardType", "tempered");
        m.put("brand", "Apple");
        m.put("model", "iPhone 15");
        m.put("imageUrl", null);
        m.put("mrp", mrp);
        m.put("price", price);
        m.put("isActive", true);
        return m;
    }

    private static Map<String, Object> line(String id, int quantity) {
        return Map.of("screenGuardId", id, "quantity", quantity);
    }

    private static Map<String, Object> order(List<Map<String, Object>> items) {
        Map<String, Object> m = new HashMap<>();
        m.put("items", items);
        m.put("name", "Cara Cust");
        m.put("phone", "98765 43210");
        m.put("address", "12 Lake Road, Andheri");
        m.put("pincode", "400053");
        return m;
    }

    private String admin() throws Exception {
        String admin = quickRegister("Ada", "ada@example.test");
        jdbc.update("UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'ada@example.test'");
        return admin;
    }

    private String quickRegister(String name, String email) throws Exception {
        return cookie(post("/api/auth/quick-register", null, Map.of("name", name, "email", email, "password", "pw"))
                .headers().firstValue("Set-Cookie").orElseThrow());
    }

    private static String cookie(String setCookie) {
        return setCookie.split(";", 2)[0];
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

    private String error(HttpResponse<String> r) throws Exception {
        assertThat(r.statusCode()).as(r.body()).isEqualTo(400);
        return mapper.readTree(r.body()).get("error").asText();
    }

    private HttpResponse<String> get(String path, String cookie) throws Exception {
        return send(HttpRequest.newBuilder(uri(path)).GET(), cookie);
    }

    private HttpResponse<String> delete(String path, String cookie) throws Exception {
        return send(HttpRequest.newBuilder(uri(path)).DELETE(), cookie);
    }

    private HttpResponse<String> post(String path, String cookie, Object body) throws Exception {
        return send(HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))), cookie);
    }

    private HttpResponse<String> put(String path, String cookie, Object body) throws Exception {
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
