package in.fonzkart.backend.order;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.fonzkart.backend.order.rules.OrderJson;
import in.fonzkart.backend.support.PostgresTestBase;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Array;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
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
 * Behavioural parity with the website for the whole order loop: booking (at the price the quote gives), routing to
 * the partner covering the pincode, partner and executive assignment, the executive's re-check with a revised price,
 * price approval and rejection, pickup, payout, hub delivery and handover, fail/restore, bulk actions, deletion, the
 * Orders page of each role, the unassigned-order count and the staff notification bell — and who is refused each.
 * <p>
 * golden/order-scenario.json was executed on db/01 + 02 + 03 + 04 against the website code by
 * scripts/security-tests/run.sh golden (order-ref.ts): server actions called directly (actions/orders.ts,
 * actions/admin.ts, actions/executive.ts, actions/notifications.ts), the route handlers of app/api/admin/orders, and the
 * Orders page rendered behind the admin layout. This test replays every step over HTTP against Spring Boot on the same
 * seed and compares the normalised outcomes and the final Order and Notification rows. The customer inbox
 * notifications that only the backend writes ({@code order_update}, for the apps) are left out of the comparison.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class OrderScenarioParityTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.prismaDatabaseWith(
            "db/02-catalog-data.sql", "db/03-staff-seed.sql", "db/04-pricing-rules-seed.sql");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    private static final Set<String> DROP = Set.of("createdAt", "updatedAt", "passwordHash", "resetToken",
            "resetTokenExpiry", "password");
    private static final Set<String> KNOWN_THROWN = Set.of("Unauthorized", "Forbidden: Admin access required",
            "Forbidden: Outside your orders", "Forbidden: Outside your partners and executives",
            "Invalid: Not possible in the order's current status", "Order not found", "Forbidden: Not your order",
            "Invalid: Not a partner", "Invalid: Executive not found", "Invalid: Price", "Invalid: Payout already recorded",
            "Invalid: Hub status", "Invalid: Status");
    private static final Pattern ISO_DATE = Pattern.compile("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z");
    private static final Pattern UUID = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private static final JsonNodeFactory F = JsonNodeFactory.instance;

    @LocalServerPort
    private int port;
    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();
    private final Map<String, Map<String, String>> jars = new HashMap<>();

    @Test
    void replaysScenarioWithIdenticalOutcomes() throws Exception {
        JsonNode scenario = read("/golden/order-scenario.json");
        JsonNode expected = read("/golden/order-scenario-expected.json");

        List<String> mismatches = new ArrayList<>();
        int i = 0;
        for (JsonNode step : scenario.get("steps")) {
            String actor = step.get("actor").asText();
            String action = step.get("action").asText();
            JsonNode input = resolve(step.get("input"));

            JsonNode outcome = canon(normalize(invoke(actor, action, input)));
            if (action.equals("getNotifications") && outcome.path("returned").path("notifications").isArray()) {
                ((ObjectNode) outcome.get("returned")).set("notifications",
                        sortNotifications(outcome.get("returned").get("notifications")));
            }
            JsonNode exp = expected.get("steps").get(i);
            assertThat(exp.get("step").asText()).isEqualTo(actor + ":" + action);
            if (!exp.get("outcome").equals(outcome)) {
                mismatches.add("#" + (i + 1) + " " + actor + ":" + action + "\n  expected " + exp.get("outcome")
                        + "\n  actual   " + outcome);
            }
            i++;
        }
        assertThat(i).isEqualTo(expected.get("steps").size()).isEqualTo(96);
        assertThat(mismatches).as("steps differing from the website implementation").isEmpty();

        JsonNode snapshot = canon(normalize(snapshot()));
        ((ObjectNode) snapshot).set("notifications", sortNotifications(snapshot.get("notifications")));
        assertThat(snapshot.get("orders")).isEqualTo(expected.get("snapshot").get("orders"));
        assertThat(snapshot.get("notifications")).isEqualTo(expected.get("snapshot").get("notifications"));
    }

    // ------------------------------------------------------------------------------------------- HTTP

    private JsonNode invoke(String actor, String action, JsonNode in) throws Exception {
        String body = mapper.writeValueAsString(in);
        String id = in.path("orderId").asText("");
        HttpRequest.Builder req = switch (action) {
            case "signin" -> post("/api/auth/signin", body);
            case "loginExecutive" -> post("/api/executive/login", body);
            case "onboardExecutive" -> post("/api/executive/onboard", body);
            case "placeOrder" -> post("/api/orders", body);
            case "getUserOrders" -> get("/api/orders");
            case "page:orders" -> get("/api/staff/orders");
            case "assignPartner" -> post("/api/staff/orders/" + enc(id) + "/partner", body);
            case "assignRider" -> post("/api/staff/orders/" + enc(id) + "/rider", body);
            case "markPayoutPaid" -> post("/api/staff/orders/" + enc(id),
                    mapper.writeValueAsString(((ObjectNode) in.deepCopy()).put("action", "mark_payout_paid")));
            case "getExecutiveOrders" -> get("/api/executive/orders");
            case "updateOrderStatus" -> post("/api/executive/orders/" + enc(id) + "/status", body);
            case "submitVerification" -> post("/api/executive/orders/" + enc(id) + "/verification",
                    mapper.writeValueAsString(in.get("payload")));
            case "markPayoutPaidByExecutive" -> post("/api/executive/orders/" + enc(id) + "/payout", body);
            case "getNotifications" -> get("/api/notifications");
            case "markAllAsRead" -> post("/api/notifications/read-all", "{}");
            case "route:order" -> post("/api/staff/orders/" + enc(id), mapper.writeValueAsString(in.get("body")));
            case "route:delete" -> HttpRequest.newBuilder(uri("/api/staff/orders/" + enc(id))).DELETE();
            case "route:bulk" -> post("/api/staff/orders/bulk", mapper.writeValueAsString(in.get("body")));
            case "route:unassignedCount" -> get("/api/staff/orders/unassigned-count");
            default -> throw new IllegalArgumentException(action);
        };
        Map<String, String> jar = jars.computeIfAbsent(actor, a -> new HashMap<>());
        if (!jar.isEmpty()) {
            req.header("Cookie", String.join("; ", jar.entrySet().stream().map(e -> e.getKey() + "=" + e.getValue()).toList()));
        }
        HttpResponse<String> res = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
        res.headers().allValues("Set-Cookie").forEach(c -> updateJar(jar, c));
        JsonNode json = parseOrText(res.body());
        int status = res.statusCode();
        ObjectNode outcome = F.objectNode();

        if (action.startsWith("route:")) {
            ObjectNode r = F.objectNode();
            r.put("status", status);
            if (status == 200 || action.equals("route:unassignedCount")) {
                r.set("body", json);
            } else if (status == 500) {
                r.put("body", "Internal error");
            } else {
                r.set("body", json != null && json.has("error") ? json.get("error") : json);
            }
            outcome.set("returned", r);
            return outcome;
        }
        if (action.startsWith("page:") && (status == 401 || status == 403)) {
            outcome.put("denied", true);
        } else if (status == 200) {
            if (json != null && json.isObject() && json.has("redirectTo")) {
                outcome.put("redirect", json.get("redirectTo").asText());
            } else {
                outcome.set("returned", adapt(action, json));
            }
        } else if (json != null && json.has("error") && KNOWN_THROWN.contains(json.get("error").asText())) {
            outcome.put("thrown", json.get("error").asText());
        } else {
            outcome.put("thrown", "<server-error>");
        }
        return outcome;
    }

    /** Puts Spring's responses into the shape the website returns or passes to its components. */
    private JsonNode adapt(String action, JsonNode json) {
        if (json == null) {
            return F.nullNode();
        }
        switch (action) {
            case "placeOrder": {
                // The backend also returns the new order's id, number and the price it calculated.
                ObjectNode o = F.objectNode();
                o.set("success", json.get("success"));
                return o;
            }
            case "page:orders": {
                ObjectNode o = F.objectNode();
                o.set("initialOrders", json.get("orders"));
                o.set("riders", json.get("riders"));
                o.set("partners", json.get("partners"));
                o.set("permissions", json.get("permissions"));
                o.set("userRole", json.get("role"));
                return o;
            }
            case "getNotifications": {
                ObjectNode o = ((ObjectNode) json).deepCopy();
                if (o.get("notifications") != null && o.get("notifications").isArray()) {
                    ArrayNode list = F.arrayNode();
                    o.get("notifications").forEach(n -> list.add(((ObjectNode) n.deepCopy()).without("id")));
                    o.set("notifications", list);
                }
                return o;
            }
            default:
                return json;
        }
    }

    /** Same JSON text, same nodes: numbers compare by value whatever node type built them. */
    private JsonNode canon(JsonNode node) throws Exception {
        return mapper.readTree(mapper.writeValueAsString(node));
    }

    private JsonNode parseOrText(String body) {
        if (body == null || body.isEmpty()) {
            return null;
        }
        try {
            return OrderJson.jsNumbers(mapper.readTree(body));
        } catch (Exception e) {
            return F.textNode(body);
        }
    }

    private static void updateJar(Map<String, String> jar, String setCookie) {
        String[] nv = setCookie.split(";")[0].split("=", 2);
        String name = nv[0].trim();
        boolean expired = nv.length < 2 || nv[1].isEmpty() || setCookie.toLowerCase().contains("max-age=0");
        if (expired) {
            jar.remove(name);
        } else {
            jar.put(name, nv[1]);
        }
    }

    private HttpRequest.Builder post(String path, String body) {
        return HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
    }

    private HttpRequest.Builder get(String path) {
        return HttpRequest.newBuilder(uri(path)).GET();
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }

    // ------------------------------------------------------------------------------- normalisation

    private JsonNode resolve(JsonNode v) {
        if (v == null) {
            return F.objectNode();
        }
        if (v.isArray()) {
            ArrayNode a = F.arrayNode();
            v.forEach(x -> a.add(resolve(x)));
            return a;
        }
        if (v.isObject()) {
            ObjectNode o = F.objectNode();
            v.fields().forEachRemaining(e -> o.set(e.getKey(), resolve(e.getValue())));
            return o;
        }
        if (v.isTextual()) {
            String s = v.asText();
            if (s.startsWith("$user:")) {
                return F.textNode(first("SELECT id FROM \"User\" WHERE email = ?", s.substring(6)));
            }
            if (s.startsWith("$rider:")) {
                return F.textNode(first("SELECT id FROM \"Rider\" WHERE phone = ?", s.substring(7)));
            }
            if (s.startsWith("$order:#")) {
                List<String> r = jdbc.queryForList("SELECT id FROM \"Order\" WHERE \"orderNumber\" = ?", String.class,
                        Integer.parseInt(s.substring(8)));
                return F.textNode(r.isEmpty() ? "NO-ID" : r.get(0));
            }
        }
        return v;
    }

    private String first(String sql, String arg) {
        List<String> r = jdbc.queryForList(sql, String.class, arg);
        return r.isEmpty() ? "NO-ID" : r.get(0);
    }

    /** Same labelling as the reference run: users, riders, cities, then orders (later labels win). */
    private Map<String, String> labels() {
        Map<String, String> m = new HashMap<>();
        jdbc.query("SELECT id, email FROM \"User\"", rs -> {
            m.put(rs.getString(1), "<user:" + rs.getString(2) + ">");
        });
        jdbc.query("SELECT id, phone FROM \"Rider\"", rs -> {
            m.put(rs.getString(1), "<rider:" + rs.getString(2) + ">");
        });
        jdbc.query("SELECT id, name FROM \"City\"", rs -> {
            m.put(rs.getString(1), "<city:" + rs.getString(2) + ">");
        });
        jdbc.query("SELECT id, \"orderNumber\" FROM \"Order\"", rs -> {
            m.put(rs.getString(1), "<order:#" + rs.getInt(2) + ">");
        });
        return m;
    }

    private JsonNode normalize(JsonNode node) {
        return normalize(node, labels());
    }

    private JsonNode normalize(JsonNode node, Map<String, String> ids) {
        if (node == null) {
            return F.nullNode();
        }
        if (node.isArray()) {
            ArrayNode a = F.arrayNode();
            node.forEach(x -> a.add(normalize(x, ids)));
            return a;
        }
        if (node.isObject()) {
            ObjectNode o = F.objectNode();
            for (Iterator<Map.Entry<String, JsonNode>> it = node.fields(); it.hasNext(); ) {
                Map.Entry<String, JsonNode> e = it.next();
                if (!DROP.contains(e.getKey())) {
                    o.set(e.getKey(), normalize(e.getValue(), ids));
                }
            }
            return o;
        }
        if (node.isTextual() && ids.containsKey(node.asText())) {
            return F.textNode(ids.get(node.asText()));
        }
        if (node.isTextual() && ISO_DATE.matcher(node.asText()).matches()) {
            return F.textNode("<date>");
        }
        if (node.isTextual() && UUID.matcher(node.asText()).matches()) {
            return F.textNode("<deleted-order>"); // a random order id no longer in the database
        }
        return OrderJson.jsNumbers(node);
    }

    /** The same order as order-ref.ts: by title, message, type, userId, role, riderId, orderId, isRead. */
    private static JsonNode sortNotifications(JsonNode list) {
        List<JsonNode> items = new ArrayList<>();
        list.forEach(items::add);
        items.sort(Comparator.comparing(OrderScenarioParityTest::notificationKey));
        ArrayNode a = F.arrayNode();
        items.forEach(a::add);
        return a;
    }

    private static String notificationKey(JsonNode n) {
        StringBuilder key = new StringBuilder();
        for (String f : List.of("title", "message", "type", "userId", "role", "riderId", "orderId", "isRead")) {
            JsonNode v = n.get(f);
            if (key.length() > 0) {
                key.append('|');
            }
            key.append(v == null || v.isNull() ? "null" : v.asText());
        }
        return key.toString();
    }

    private JsonNode snapshot() {
        ObjectNode s = F.objectNode();
        ArrayNode orders = s.putArray("orders");
        jdbc.query("SELECT \"orderNumber\", \"userId\", \"riderId\", \"partnerId\", device, price, status, pincode, "
                + "address, \"locationLat\", \"locationLng\", \"offeredPrice\", answers, \"riderAnswers\", "
                + "\"verificationImages\" FROM \"Order\" ORDER BY \"orderNumber\"", rs -> {
            ObjectNode o = orders.addObject();
            o.put("orderNumber", rs.getInt(1));
            o.put("userId", rs.getString(2));
            o.put("riderId", rs.getString(3));
            o.put("partnerId", rs.getString(4));
            o.put("device", rs.getString(5));
            o.put("price", rs.getInt(6));
            o.put("status", rs.getString(7));
            o.put("pincode", rs.getString(8));
            o.put("address", rs.getString(9));
            double lat = rs.getDouble(10);
            o.set("locationLat", rs.wasNull() ? F.nullNode() : OrderJson.jsNumbers(F.numberNode(lat)));
            double lng = rs.getDouble(11);
            o.set("locationLng", rs.wasNull() ? F.nullNode() : OrderJson.jsNumbers(F.numberNode(lng)));
            int offered = rs.getInt(12);
            o.set("offeredPrice", rs.wasNull() ? F.nullNode() : F.numberNode(offered));
            o.set("answers", parsedColumn(rs.getString(13)));
            o.set("riderAnswers", parsedColumn(rs.getString(14)));
            o.set("verificationImages", array(rs.getArray(15)));
        });
        ArrayNode notifications = s.putArray("notifications");
        jdbc.query("SELECT \"userId\", role, \"riderId\", title, message, type, \"orderId\", \"isRead\" FROM \"Notification\" "
                + "WHERE type <> 'order_update'", rs -> {
            ObjectNode n = notifications.addObject();
            n.put("userId", rs.getString(1));
            n.put("role", rs.getString(2));
            n.put("riderId", rs.getString(3));
            n.put("title", rs.getString(4));
            n.put("message", rs.getString(5));
            n.put("type", rs.getString(6));
            n.put("orderId", rs.getString(7));
            n.put("isRead", rs.getBoolean(8));
        });
        return s;
    }

    /** JSON.parse(text), or the text itself when it is not JSON (as order-ref.ts records it). */
    private JsonNode parsedColumn(String text) {
        if (text == null) {
            return F.nullNode();
        }
        try {
            return OrderJson.jsNumbers(mapper.readTree(text));
        } catch (Exception e) {
            return F.textNode(text);
        }
    }

    private static JsonNode array(Array sqlArray) throws java.sql.SQLException {
        ArrayNode a = F.arrayNode();
        if (sqlArray != null) {
            for (Object o : (Object[]) sqlArray.getArray()) {
                a.add(String.valueOf(o));
            }
        }
        return a;
    }

    private JsonNode read(String path) throws Exception {
        return mapper.readTree(getClass().getResourceAsStream(path));
    }
}
