package in.fonzkart.backend.rider;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.fonzkart.backend.auth.session.ExecutiveTokenCodec;
import in.fonzkart.backend.auth.session.SessionTokenCodec;
import in.fonzkart.backend.rider.service.RiderPasswords;
import in.fonzkart.backend.support.PostgresTestBase;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
 * Behavioural parity with the website's implementation for riders, field executives, executive phone login, city
 * management, zonal-head city assignment and the relationship-manager dashboard, including the security hardening
 * (city/partner access rules, hashed rider passwords, onboarding that cannot overwrite a password, signed
 * executive_id cookie) and the staff permissions (who may grant and revoke roles, upgrade accounts to PARTNER or
 * FIELD_EXECUTIVE, manage riders of their team, open the admin-only pages and change pricing rules).
 * <p>
 * golden/staff-scenario.json was executed on db/01-prisma-schema.sql + db/03-staff-seed.sql against the website
 * code by scripts/security-tests/run.sh golden: server actions called directly (actions/admin.ts,
 * app/admin/cities/actions.ts, actions/executive.ts, actions/orders.ts) and the actual pages rendered behind the
 * admin layout (riders, cities, zonal-heads, rm-dashboard, homepage, admins, home), recording the props each page
 * passes to its components and invoking the inline server actions found in the rendered output. The normalised
 * outcome of every step, each actor's cookies afterwards and the final User/Rider/City/Order state are in
 * golden/staff-scenario-expected.json. This test replays the scenario over HTTP against Spring Boot on the same seed.
 * Executive cookies are compared by the rider they verify as ("INVALID" when they do not verify) and rider
 * passwords by kind (hashed / plain / empty), because tokens carry the time and bcrypt hashes are salted.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class StaffScenarioParityTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.prismaDatabaseWith("db/03-staff-seed.sql");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    private static final Set<String> DROP = Set.of("createdAt", "updatedAt", "passwordHash", "resetToken",
            "resetTokenExpiry", "password");
    private static final Set<String> KNOWN_THROWN = Set.of("Unauthorized", "Forbidden: Admin access required",
            "Forbidden: Insufficient privileges to grant executive access", "Forbidden: Outside your assigned cities",
            "Forbidden: Outside your team", "Forbidden: Cannot change this user's role");

    @LocalServerPort
    private int port;
    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();
    private final Map<String, Map<String, String>> jars = new HashMap<>();

    @Test
    void replaysScenarioWithIdenticalOutcomes() throws Exception {
        JsonNode scenario = read("/golden/staff-scenario.json");
        JsonNode expected = read("/golden/staff-scenario-expected.json");

        List<String> mismatches = new ArrayList<>();
        int i = 0;
        for (JsonNode step : scenario.get("steps")) {
            String actor = step.get("actor").asText();
            String action = step.get("action").asText();
            ObjectNode input = resolve(actor, (ObjectNode) step.get("input"));

            JsonNode outcome = normalize(invoke(actor, action, input));
            JsonNode jar = normalize(jarState(actor));

            JsonNode exp = expected.get("steps").get(i);
            assertThat(exp.get("step").asText()).isEqualTo(actor + ":" + action);
            if (!exp.get("outcome").equals(outcome)) {
                mismatches.add("#" + (i + 1) + " " + actor + ":" + action + " outcome\n  expected " + exp.get("outcome")
                        + "\n  actual   " + outcome);
            }
            if (!exp.get("jar").equals(jar)) {
                mismatches.add("#" + (i + 1) + " " + actor + ":" + action + " cookies\n  expected " + exp.get("jar")
                        + "\n  actual   " + jar);
            }
            i++;
        }
        assertThat(i).isEqualTo(expected.get("steps").size()).isEqualTo(158);
        assertThat(mismatches).as("steps differing from the website implementation").isEmpty();
        assertThat(normalize(snapshot())).isEqualTo(expected.get("snapshot"));
    }

    // ------------------------------------------------------------------------------------------- HTTP

    private JsonNode invoke(String actor, String action, ObjectNode in) throws Exception {
        if (action.equals("setCookie")) {
            // The actor's browser stores a cookie value as-is (e.g. a forged executive_id).
            jars.computeIfAbsent(actor, a -> new HashMap<>()).put(in.get("name").asText(), in.get("value").asText());
            ObjectNode outcome = JsonNodeFactory.instance.objectNode();
            outcome.putNull("returned");
            return outcome;
        }
        String body = mapper.writeValueAsString(in);
        HttpRequest.Builder req = switch (action) {
            case "signin" -> post("/api/auth/signin", body);
            case "updateCityPincodes" -> put("/api/cities/" + enc(in, "cityId") + "/pincodes", body);
            case "toggleCityActive" -> put("/api/cities/" + enc(in, "cityId") + "/active", body);
            case "updatePartnerPincodes" -> put("/api/cities/partners/" + enc(in, "partnerId") + "/pincodes", body);
            case "removePartnerFromCity" -> post("/api/cities/partners/" + enc(in, "partnerId") + "/remove", "{}");
            case "toggleFeaturedCity" -> put("/api/cities/" + enc(in, "id") + "/featured", body);
            case "updateCityDisplayOrder" -> put("/api/cities/" + enc(in, "id") + "/display-order", body);
            case "checkPincodeAvailability" -> get("/api/cities/pincode-availability?pincode=" + enc(in, "pincode"));
            case "registerHub" -> post("/api/cities/hubs", body);
            case "zhAssignCity" -> post("/api/staff/zonal-heads/" + enc(in, "zonalHeadId") + "/cities", body);
            case "zhUnassignCity" -> delete("/api/staff/zonal-heads/" + enc(in, "zonalHeadId") + "/cities/" + enc(in, "cityId"));
            case "addRider" -> post("/api/riders", body);
            case "deleteRider" -> delete("/api/riders/" + enc(in, "id"));
            case "updateRiderPartner" -> put("/api/riders/" + enc(in, "riderId") + "/partner", body);
            case "addFieldExecutive" -> post("/api/riders/field-executives", body);
            case "loginExecutive" -> post("/api/executive/login", body);
            case "onboardExecutive" -> post("/api/executive/onboard", body);
            case "logoutExecutive" -> post("/api/executive/logout", "{}");
            case "getExecutiveSession" -> get("/api/executive/session");
            case "getAdmins" -> get("/api/staff/admins");
            case "addAdmin" -> post("/api/staff/admins", body);
            case "addZonalHead" -> post("/api/staff/zonal-heads/grant", body);
            case "addRelationshipManager" -> post("/api/staff/relationship-managers/grant", body);
            case "addPartner" -> post("/api/staff/partners/grant", body);
            case "removeAdmin" -> post("/api/staff/admins/remove", body);
            case "removeUserRole" -> post("/api/staff/roles/remove", body);
            case "updatePartnerManager" -> put("/api/staff/partners/" + enc(in, "partnerId") + "/manager", body);
            case "getPartnersManagedBy" -> get("/api/staff/partners/managed-by/" + enc(in, "managerId"));
            case "upsertEvaluationRule" -> put("/api/pricing/rules", body);
            case "page:cities" -> get("/api/cities/overview");
            case "page:riders" -> get("/api/riders/overview");
            case "page:rm-dashboard" -> get("/api/staff/rm-dashboard");
            case "page:homepage" -> get("/api/cities/homepage");
            case "page:home" -> get("/api/cities/active-names");
            case "page:admins" -> get("/api/staff/directory");
            default -> throw new IllegalArgumentException(action);
        };
        Map<String, String> jar = jars.computeIfAbsent(actor, a -> new HashMap<>());
        if (!jar.isEmpty()) {
            req.header("Cookie", String.join("; ", jar.entrySet().stream().map(e -> e.getKey() + "=" + e.getValue()).toList()));
        }
        HttpResponse<String> res = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
        res.headers().allValues("Set-Cookie").forEach(c -> updateJar(jar, c));

        JsonNode json = res.body() == null || res.body().isEmpty() ? null : mapper.readTree(res.body());
        ObjectNode outcome = JsonNodeFactory.instance.objectNode();
        int status = res.statusCode();
        if (action.startsWith("page:") && (status == 401 || status == 403)) {
            outcome.put("denied", true);
        } else if (status == 404 && action.startsWith("zh")) {
            outcome.put("unavailable", true);
        } else if (status == 200) {
            if (json != null && json.isObject() && json.has("redirectTo")) {
                outcome.put("redirect", json.get("redirectTo").asText());
            } else {
                outcome.set("returned", adapt(action, json));
            }
        } else if ((status == 401 || status == 403) && KNOWN_THROWN.contains(json.get("error").asText())) {
            outcome.put("thrown", json.get("error").asText());
        } else {
            outcome.put("thrown", "<server-error>");
        }
        return outcome;
    }

    /** Puts Spring's responses into the shape the original pages pass to their components. */
    private JsonNode adapt(String action, JsonNode json) {
        if (json == null) {
            return JsonNodeFactory.instance.nullNode();
        }
        switch (action) {
            case "getExecutiveSession":
                return json.get("executive");
            case "page:cities": {
                ObjectNode o = JsonNodeFactory.instance.objectNode();
                o.set("cities", json.get("cities"));
                o.set("isZonalHead", json.get("cities").isEmpty()
                        ? JsonNodeFactory.instance.nullNode() : json.get("isZonalHead"));
                return o;
            }
            case "page:admins": {
                ObjectNode o = ((ObjectNode) json).deepCopy();
                ArrayNode combined = JsonNodeFactory.instance.arrayNode();
                json.get("riders").forEach(combined::add);
                json.get("fieldExecutiveUsers").forEach(combined::add);
                o.remove("fieldExecutiveUsers");
                o.set("riders", combined);
                return o;
            }
            default:
                return json;
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

    private JsonNode jarState(String actor) {
        Map<String, String> jar = jars.getOrDefault(actor, Map.of());
        ObjectNode state = JsonNodeFactory.instance.objectNode();
        String token = jar.get("session");
        if (token == null) {
            state.putNull("session");
        } else {
            state.set("session", new SessionTokenCodec(PostgresTestBase.AUTH_SECRET, mapper).verify(token, Instant.now())
                    .filter(p -> p.user() != null)
                    .map(p -> (JsonNode) mapper.valueToTree(p.user()))
                    .orElse(JsonNodeFactory.instance.textNode("INVALID")));
        }
        String executive = jar.get("executive_id");
        if (executive == null) {
            state.putNull("executive");
        } else {
            state.put("executive", new ExecutiveTokenCodec(PostgresTestBase.AUTH_SECRET, mapper)
                    .verify(executive, Instant.now()).orElse("INVALID"));
        }
        return state;
    }

    private HttpRequest.Builder post(String path, String body) {
        return HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
    }

    private HttpRequest.Builder put(String path, String body) {
        return HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(body));
    }

    private HttpRequest.Builder get(String path) {
        return HttpRequest.newBuilder(uri(path)).GET();
    }

    private HttpRequest.Builder delete(String path) {
        return HttpRequest.newBuilder(uri(path)).DELETE();
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    private static String enc(ObjectNode in, String field) {
        return URLEncoder.encode(in.get(field).asText(), StandardCharsets.UTF_8).replace("+", "%20");
    }

    // ------------------------------------------------------------------------------- normalisation

    private ObjectNode resolve(String actor, ObjectNode input) {
        ObjectNode out = JsonNodeFactory.instance.objectNode();
        for (Iterator<Map.Entry<String, JsonNode>> it = input.fields(); it.hasNext(); ) {
            Map.Entry<String, JsonNode> e = it.next();
            String v = e.getValue().isTextual() ? e.getValue().asText() : null;
            if ("$session".equals(v)) {
                out.put(e.getKey(), jars.getOrDefault(actor, Map.of()).getOrDefault("session", ""));
            } else if (v != null && v.startsWith("$user:")) {
                out.put(e.getKey(), first("SELECT id FROM \"User\" WHERE email = ?", v.substring(6)));
            } else if (v != null && v.startsWith("$rider:")) {
                out.put(e.getKey(), first("SELECT id FROM \"Rider\" WHERE phone = ?", v.substring(7)));
            } else if (v != null && v.startsWith("$city:")) {
                out.put(e.getKey(), first("SELECT id FROM \"City\" WHERE name = ?", v.substring(6)));
            } else {
                out.set(e.getKey(), e.getValue());
            }
        }
        return out;
    }

    private String first(String sql, String arg) {
        List<String> r = jdbc.queryForList(sql, String.class, arg);
        return r.isEmpty() ? "NO-ID" : r.get(0);
    }

    /** Same labelling as the reference run: users, then riders, then cities (later labels win). */
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
        return m;
    }

    private JsonNode normalize(JsonNode node) {
        return normalize(node, labels());
    }

    private JsonNode normalize(JsonNode node, Map<String, String> ids) {
        if (node == null) {
            return JsonNodeFactory.instance.nullNode();
        }
        if (node.isArray()) {
            ArrayNode a = JsonNodeFactory.instance.arrayNode();
            node.forEach(x -> a.add(normalize(x, ids)));
            return a;
        }
        if (node.isObject()) {
            ObjectNode o = JsonNodeFactory.instance.objectNode();
            node.fields().forEachRemaining(e -> {
                if (!DROP.contains(e.getKey())) {
                    o.set(e.getKey(), normalize(e.getValue(), ids));
                }
            });
            return o;
        }
        if (node.isTextual() && ids.containsKey(node.asText())) {
            return JsonNodeFactory.instance.textNode(ids.get(node.asText()));
        }
        return node;
    }

    private JsonNode snapshot() {
        ObjectNode s = JsonNodeFactory.instance.objectNode();
        ArrayNode users = s.putArray("users");
        jdbc.query("SELECT email, role, \"cityId\", pincodes, \"managerId\", \"relationshipManagerId\" FROM \"User\" ORDER BY email", rs -> {
            ObjectNode u = users.addObject();
            u.put("email", rs.getString(1));
            u.put("role", rs.getString(2));
            u.put("cityId", rs.getString(3));
            u.set("pincodes", array(rs.getArray(4)));
            u.put("managerId", rs.getString(5));
            u.put("relationshipManagerId", rs.getString(6));
        });
        ArrayNode riders = s.putArray("riders");
        jdbc.query("SELECT name, phone, email, status, password, \"partnerId\" FROM \"Rider\" ORDER BY phone", rs -> {
            ObjectNode r = riders.addObject();
            r.put("name", rs.getString(1));
            r.put("phone", rs.getString(2));
            r.put("email", rs.getString(3));
            r.put("status", rs.getString(4));
            String password = rs.getString(5);
            r.put("passwordState", password == null ? null : password.isEmpty() ? "empty"
                    : RiderPasswords.isHash(password) ? "hashed" : "plain");
            r.put("partnerId", rs.getString(6));
        });
        ArrayNode cities = s.putArray("cities");
        jdbc.query("SELECT name, \"isActive\", pincodes, \"displayOrder\", \"isFeatured\", \"managerId\" FROM \"City\" ORDER BY name", rs -> {
            ObjectNode c = cities.addObject();
            c.put("name", rs.getString(1));
            c.put("isActive", rs.getBoolean(2));
            c.set("pincodes", array(rs.getArray(3)));
            c.put("displayOrder", rs.getInt(4));
            c.put("isFeatured", rs.getBoolean(5));
            c.put("managerId", rs.getString(6));
        });
        ArrayNode orders = s.putArray("orders");
        jdbc.query("SELECT id, \"riderId\", \"partnerId\" FROM \"Order\" ORDER BY id", rs -> {
            ObjectNode o = orders.addObject();
            o.put("id", rs.getString(1));
            o.put("riderId", rs.getString(2));
            o.put("partnerId", rs.getString(3));
        });
        return s;
    }

    private static ArrayNode array(java.sql.Array arr) throws java.sql.SQLException {
        ArrayNode a = JsonNodeFactory.instance.arrayNode();
        if (arr != null) {
            for (Object p : (Object[]) arr.getArray()) {
                a.add(String.valueOf(p));
            }
        }
        return a;
    }

    private JsonNode read(String resource) throws Exception {
        try (InputStream in = getClass().getResourceAsStream(resource)) {
            return mapper.readTree(in);
        }
    }
}
