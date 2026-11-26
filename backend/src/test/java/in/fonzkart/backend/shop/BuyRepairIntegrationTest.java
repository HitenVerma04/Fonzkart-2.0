package in.fonzkart.backend.shop;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.support.PostgresTestBase;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
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

/** Buying refurbished devices and booking repairs: who may change what, stock, pricing, and what a booking may contain. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class BuyRepairIntegrationTest {

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
    @Autowired
    private RepairPriceSheet sheet;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();

    @BeforeEach
    void cleanDatabase() {
        jdbc.update("DELETE FROM \"RefurbishedOrder\"");
        jdbc.update("DELETE FROM \"RefurbishedDevice\"");
        jdbc.update("DELETE FROM \"RepairBooking\"");
        jdbc.update("DELETE FROM \"RepairPrice\"");
        jdbc.update("DELETE FROM \"AppSetting\"");
        jdbc.update("DELETE FROM \"User\"");
    }

    @Test
    void onlyAdministratorsChangeListingsAndPrices() throws Exception {
        assertThat(post("/api/buy/admin/devices", null, device(1)).statusCode()).isEqualTo(401);
        assertThat(post("/api/repair/admin/prices", null, price("screen", 2999)).statusCode()).isEqualTo(401);
        String customer = quickRegister("Cara", "cara@example.test");
        assertThat(post("/api/buy/admin/devices", customer, device(1)).statusCode()).isEqualTo(403);
        assertThat(get("/api/buy/admin/orders", customer).statusCode()).isEqualTo(403);
        assertThat(put("/api/buy/admin/settings", customer, Map.of("enabled", false)).statusCode()).isEqualTo(403);
        assertThat(post("/api/repair/admin/prices", customer, price("screen", 2999)).statusCode()).isEqualTo(403);
        assertThat(get("/api/repair/admin/bookings", customer).statusCode()).isEqualTo(403);
        assertThat(put("/api/repair/admin/settings", customer, Map.of("enabled", false)).statusCode()).isEqualTo(403);
    }

    @Test
    void customersSeeOnlyActiveDevicesInStock() throws Exception {
        String admin = admin();
        String shown = id(post("/api/buy/admin/devices", admin, device(2)));
        Map<String, Object> soldOut = device(0);
        soldOut.put("name", "Sold out");
        id(post("/api/buy/admin/devices", admin, soldOut));
        Map<String, Object> hidden = device(3);
        hidden.put("name", "Hidden");
        hidden.put("isActive", false);
        id(post("/api/buy/admin/devices", admin, hidden));

        JsonNode store = json(get("/api/buy/devices", null));
        assertThat(store.get("enabled").asBoolean()).isTrue();
        assertThat(store.get("items")).hasSize(1);
        assertThat(store.get("items").get(0).get("id").asText()).isEqualTo(shown);
        assertThat(json(get("/api/buy/admin/devices", admin)).get("items")).hasSize(3);

        assertThat(json(put("/api/buy/admin/settings", admin, Map.of("enabled", false))).get("success").asBoolean()).isTrue();
        JsonNode closed = json(get("/api/buy/devices", null));
        assertThat(closed.get("enabled").asBoolean()).isFalse();
        assertThat(closed.get("items")).isEmpty();
        String customer = quickRegister("Cara", "cara@example.test");
        assertThat(error(post("/api/buy/orders", customer, order(shown)))).contains("closed");
    }

    @Test
    void anOrderTakesOneFromStockAndCancellingPutsItBack() throws Exception {
        String admin = admin();
        String deviceId = id(post("/api/buy/admin/devices", admin, device(1)));
        assertThat(post("/api/buy/orders", null, order(deviceId)).statusCode()).isEqualTo(401);

        String cara = quickRegister("Cara", "cara@example.test");
        JsonNode placed = json(post("/api/buy/orders", cara, order(deviceId)));
        assertThat(placed.get("status").asText()).isEqualTo("placed");
        assertThat(placed.get("price").asInt()).isEqualTo(24999);
        assertThat(placed.get("phone").asText()).isEqualTo("9876543210");
        assertThat(placed.get("paymentMethod").asText()).isEqualTo("cod");
        assertThat(json(get("/api/buy/devices", null)).get("items")).isEmpty();

        String dev = quickRegister("Dev", "dev@example.test");
        assertThat(error(post("/api/buy/orders", dev, order(deviceId)))).contains("just been sold");
        assertThat(json(get("/api/buy/orders", dev))).isEmpty();
        assertThat(json(get("/api/buy/orders", cara))).hasSize(1);

        String orderId = placed.get("id").asText();
        assertThat(json(get("/api/buy/admin/orders", admin)).get(0).get("customerEmail").asText()).isEqualTo("cara@example.test");
        assertThat(put("/api/buy/admin/orders/" + orderId + "/status", admin, Map.of("status", "lost")).statusCode()).isEqualTo(400);
        json(put("/api/buy/admin/orders/" + orderId + "/status", admin, Map.of("status", "cancelled")));
        assertThat(json(get("/api/buy/devices", null)).get("items").get(0).get("stock").asInt()).isEqualTo(1);
        // Cancelling twice does not add a second device.
        json(put("/api/buy/admin/orders/" + orderId + "/status", admin, Map.of("status", "cancelled")));
        assertThat(json(get("/api/buy/devices", null)).get("items").get(0).get("stock").asInt()).isEqualTo(1);

        // It went to someone else, so the cancelled order cannot come back.
        json(post("/api/buy/orders", dev, order(deviceId)));
        assertThat(error(put("/api/buy/admin/orders/" + orderId + "/status", admin, Map.of("status", "placed")))).contains("out of stock");
    }

    @Test
    void aDeviceMustBeComplete() throws Exception {
        String admin = admin();
        Map<String, Object> grade = device(1);
        grade.put("grade", "mint");
        assertThat(error(post("/api/buy/admin/devices", admin, grade))).contains("grade");
        Map<String, Object> dear = device(1);
        dear.put("price", 99999);
        assertThat(error(post("/api/buy/admin/devices", admin, dear))).contains("more than the MRP");
        Map<String, Object> image = device(1);
        image.put("imageUrl", "javascript:alert(1)");
        assertThat(error(post("/api/buy/admin/devices", admin, image))).contains("picture");
    }

    @Test
    void aBookingIsPricedFromTheListAndNeedsAValidVisit() throws Exception {
        String admin = admin();
        String priceId = id(post("/api/repair/admin/prices", admin, price("screen", 2999)));
        assertThat(error(post("/api/repair/admin/prices", admin, price("screen", 1999)))).contains("already has a price");
        assertThat(error(post("/api/repair/admin/prices", admin, price("toaster", 1999)))).contains("Unknown repair");
        assertThat(json(get("/api/repair/prices", null)).get("items")).hasSize(1);

        assertThat(post("/api/repair/bookings", null, booking(priceId, 1, "morning")).statusCode()).isEqualTo(401);
        String cara = quickRegister("Cara", "cara@example.test");
        assertThat(error(post("/api/repair/bookings", cara, booking(priceId, 0, "morning")))).contains("next 14 days");
        assertThat(error(post("/api/repair/bookings", cara, booking(priceId, 15, "morning")))).contains("next 14 days");
        assertThat(error(post("/api/repair/bookings", cara, booking(priceId, 1, "midnight")))).contains("time slot");
        assertThat(error(post("/api/repair/bookings", cara, booking("nope", 1, "morning")))).contains("no longer offered");

        JsonNode booked = json(post("/api/repair/bookings", cara, booking(priceId, 1, "evening")));
        assertThat(booked.get("status").asText()).isEqualTo("booked");
        assertThat(booked.get("price").asInt()).isEqualTo(2999);
        assertThat(booked.get("model").asText()).isEqualTo("iPhone 15");
        assertThat(booked.get("slot").asText()).isEqualTo("evening");

        // A later price change leaves the booking as it was.
        Map<String, Object> dearer = price("screen", 3499);
        json(put("/api/repair/admin/prices/" + priceId, admin, dearer));
        assertThat(json(get("/api/repair/bookings", cara)).get(0).get("price").asInt()).isEqualTo(2999);

        String dev = quickRegister("Dev", "dev@example.test");
        assertThat(json(get("/api/repair/bookings", dev))).isEmpty();
        String bookingId = booked.get("id").asText();
        assertThat(json(get("/api/repair/admin/bookings", admin)).get(0).get("customerEmail").asText()).isEqualTo("cara@example.test");
        json(put("/api/repair/admin/bookings/" + bookingId + "/status", admin, Map.of("status", "completed")));
        assertThat(json(get("/api/repair/bookings", cara)).get(0).get("status").asText()).isEqualTo("completed");
        assertThat(put("/api/repair/admin/bookings/" + bookingId + "/status", admin, Map.of("status", "shipped")).statusCode()).isEqualTo(400);

        json(put("/api/repair/admin/settings", admin, Map.of("enabled", false)));
        assertThat(json(get("/api/repair/prices", null)).get("enabled").asBoolean()).isFalse();
        assertThat(error(post("/api/repair/bookings", cara, booking(priceId, 1, "morning")))).contains("closed");
    }

    @Test
    void aRepairCanHaveAPriceRangeAndTheBookingKeepsIt() throws Exception {
        String admin = admin();
        Map<String, Object> range = price("battery", 7000);
        range.put("priceMax", 10000);
        String priceId = id(post("/api/repair/admin/prices", admin, range));
        JsonNode listed = json(get("/api/repair/prices", null)).get("items").get(0);
        assertThat(listed.get("price").asInt()).isEqualTo(7000);
        assertThat(listed.get("priceMax").asInt()).isEqualTo(10000);

        // The top of the range cannot be below the bottom; the same number is a fixed price.
        Map<String, Object> upsideDown = price("charging", 5000);
        upsideDown.put("priceMax", 4000);
        assertThat(error(post("/api/repair/admin/prices", admin, upsideDown))).contains("at least the lowest");
        Map<String, Object> same = price("camera", 5000);
        same.put("priceMax", 5000);
        String fixedId = id(post("/api/repair/admin/prices", admin, same));
        JsonNode fixed = null;
        for (JsonNode item : json(get("/api/repair/admin/prices", admin)).get("items")) {
            if (item.get("id").asText().equals(fixedId)) {
                fixed = item;
            }
        }
        assertThat(fixed).isNotNull();
        assertThat(fixed.get("priceMax").isNull()).isTrue();

        String cara = quickRegister("Cara", "cara@example.test");
        JsonNode booked = json(post("/api/repair/bookings", cara, booking(priceId, 2, "morning")));
        assertThat(booked.get("price").asInt()).isEqualTo(7000);
        assertThat(booked.get("priceMax").asInt()).isEqualTo(10000);
        assertThat(json(get("/api/repair/bookings", cara)).get(0).get("priceMax").asInt()).isEqualTo(10000);
    }

    @Test
    void thePriceSheetSetsRangesOnceAndOnlyForPhonesOnTheList() throws Exception {
        String admin = admin();
        id(post("/api/repair/admin/prices", admin, price("battery", 1999)));
        Map<String, Object> other = price("battery", 1999);
        other.put("model", "Nokia 3310");
        id(post("/api/repair/admin/prices", admin, other));
        jdbc.update("DELETE FROM \"AppSetting\" WHERE key = ?", RepairPriceSheet.VERSION_KEY);

        JsonNode file = new ObjectMapper().readTree("""
                {"version": "test-1", "issues": ["screen", "battery"],
                 "phones": [{"brand": "apple", "model": "IPHONE 15", "prices": [[14000, 22000], [4500, 7000]]},
                            {"brand": "Apple", "model": "Not On The List", "prices": [[1, 2], [3, 4]]}]}""");
        assertThat(sheet.apply(file).updated()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"RepairPrice\"", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForMap("SELECT price, \"priceMax\" FROM \"RepairPrice\" WHERE model = 'iPhone 15'"))
                .containsEntry("price", 4500).containsEntry("priceMax", 7000);
        assertThat(jdbc.queryForObject("SELECT price FROM \"RepairPrice\" WHERE model = 'Nokia 3310'", Integer.class)).isEqualTo(1999);

        // The same version again changes nothing, so an admin's later edit stays.
        jdbc.update("UPDATE \"RepairPrice\" SET price = 5000, \"priceMax\" = NULL WHERE model = 'iPhone 15'");
        assertThat(sheet.apply(file).applied()).isFalse();
        assertThat(jdbc.queryForObject("SELECT price FROM \"RepairPrice\" WHERE model = 'iPhone 15'", Integer.class)).isEqualTo(5000);
    }

    @Test
    void theShippedPriceSheetIsWellFormed() throws Exception {
        JsonNode file = new ObjectMapper().readTree(new org.springframework.core.io.ClassPathResource("repair/repair-prices.json").getInputStream());
        assertThat(file.path("version").asText()).isNotBlank();
        assertThat(file.path("issues")).hasSize(6);
        assertThat(file.path("phones").size()).isGreaterThan(50);
        for (JsonNode phone : file.path("phones")) {
            String name = phone.path("brand").asText() + " " + phone.path("model").asText();
            assertThat(phone.path("prices")).as(name).hasSize(6);
            for (JsonNode range : phone.path("prices")) {
                assertThat(range.get(0).asInt()).as(name).isPositive();
                assertThat(range.get(1).asInt()).as(name).isGreaterThan(range.get(0).asInt()).isLessThanOrEqualTo(ServiceSupport.MAX_PRICE);
            }
        }
    }

    private static Map<String, Object> device(int stock) {
        Map<String, Object> m = new HashMap<>();
        m.put("name", "iPhone 13");
        m.put("brand", "Apple");
        m.put("storage", "128 GB");
        m.put("grade", "superb");
        m.put("warrantyMonths", 6);
        m.put("mrp", 39999);
        m.put("price", 24999);
        m.put("stock", stock);
        return m;
    }

    private static Map<String, Object> price(String issue, int price) {
        Map<String, Object> m = new HashMap<>();
        m.put("brand", "Apple");
        m.put("model", "iPhone 15");
        m.put("issue", issue);
        m.put("price", price);
        return m;
    }

    private static Map<String, Object> order(String deviceId) {
        Map<String, Object> m = details();
        m.put("deviceId", deviceId);
        return m;
    }

    private static Map<String, Object> booking(String priceId, int daysAhead, String slot) {
        Map<String, Object> m = details();
        m.put("repairPriceId", priceId);
        m.put("visitDate", LocalDate.now(ZoneId.of("Asia/Kolkata")).plusDays(daysAhead).toString());
        m.put("slot", slot);
        return m;
    }

    private static Map<String, Object> details() {
        Map<String, Object> m = new HashMap<>();
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
        return post("/api/auth/quick-register", null, Map.of("name", name, "email", email, "password", "pw"))
                .headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0];
    }

    private String id(HttpResponse<String> r) throws Exception {
        return json(r).get("id").asText();
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
