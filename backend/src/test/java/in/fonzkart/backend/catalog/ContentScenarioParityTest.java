package in.fonzkart.backend.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.fonzkart.backend.catalog.rules.CatalogOrdering;
import in.fonzkart.backend.support.PostgresTestBase;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Array;
import java.util.ArrayList;
import java.util.HashMap;
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
 * Behavioural parity with the website for catalog and landing-page editing (actions/admin.ts, lib/store.ts,
 * lib/banner-prices.ts): brands, models, variants, reordering, deleting a brand with its models, and the banner's
 * display prices, including who is refused. golden/content-scenario.json was executed against the website code by
 * scripts/security-tests/run.sh golden (content-ref.ts) on db/01 + 02 + 03; this test replays it over HTTP.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class ContentScenarioParityTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.prismaDatabaseWith("db/02-catalog-data.sql", "db/03-staff-seed.sql");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    private static final Set<String> KNOWN_THROWN = Set.of("Unauthorized", "Forbidden: Admin access required");
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
        JsonNode scenario = mapper.readTree(getClass().getResourceAsStream("/golden/content-scenario.json"));
        JsonNode expected = mapper.readTree(getClass().getResourceAsStream("/golden/content-scenario-expected.json"));
        List<String> mismatches = new ArrayList<>();
        int i = 0;
        for (JsonNode step : scenario.get("steps")) {
            String actor = step.get("actor").asText();
            String action = step.get("action").asText();
            JsonNode outcome = canon(invoke(actor, action, resolve(step.get("input"))));
            JsonNode exp = expected.get("steps").get(i);
            assertThat(exp.get("step").asText()).isEqualTo(actor + ":" + action);
            if (!exp.get("outcome").equals(outcome)) {
                mismatches.add("#" + (i + 1) + " " + actor + ":" + action + "\n  expected " + exp.get("outcome") + "\n  actual   " + outcome);
            }
            i++;
        }
        assertThat(i).isEqualTo(47);
        assertThat(mismatches).as("steps differing from the website implementation").isEmpty();
        assertThat(canon(snapshot())).isEqualTo(expected.get("snapshot"));
    }

    private JsonNode invoke(String actor, String action, JsonNode in) throws Exception {
        ObjectNode outcome = F.objectNode();
        if (action.equals("snapshot")) {
            outcome.set("returned", snapshot());
            return outcome;
        }
        String body = mapper.writeValueAsString(in);
        String id = enc(in.path("id").asText(""));
        HttpRequest.Builder req = switch (action) {
            case "signin" -> send("POST", "/api/auth/signin", body);
            case "addBrand" -> send("POST", "/api/catalog/admin/brands", body);
            case "updateBrand" -> send("PUT", "/api/catalog/admin/brands/" + id, body);
            case "deleteBrand" -> send("DELETE", "/api/catalog/admin/brands/" + id
                    + (in.hasNonNull("category") ? "?category=" + enc(in.get("category").asText()) : ""), null);
            case "addModel" -> send("POST", "/api/catalog/admin/models", body);
            case "updateModel" -> send("PUT", "/api/catalog/admin/models/" + id, body);
            case "reorderModels" -> send("PUT", "/api/catalog/admin/models/order", mapper.writeValueAsString(in.get("items")));
            case "deleteModel" -> send("DELETE", "/api/catalog/admin/models/" + id, null);
            case "addVariant" -> send("POST", "/api/catalog/admin/variants", body);
            case "updateVariant" -> send("PUT", "/api/catalog/admin/variants/" + id, body);
            case "deleteVariant" -> send("DELETE", "/api/catalog/admin/variants/" + id, null);
            case "getDeviceDisplayPrices" -> send("GET", "/api/content/banner-prices/admin", null);
            case "updateDeviceDisplayPrice" -> send("PUT", "/api/content/banner-prices/" + id, body);
            default -> throw new IllegalArgumentException(action);
        };
        Map<String, String> jar = jars.computeIfAbsent(actor, a -> new HashMap<>());
        if (!jar.isEmpty()) {
            req.header("Cookie", String.join("; ", jar.entrySet().stream().map(e -> e.getKey() + "=" + e.getValue()).toList()));
        }
        HttpResponse<String> res = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
        res.headers().allValues("Set-Cookie").forEach(c -> {
            String[] nv = c.split(";")[0].split("=", 2);
            if (nv.length == 2 && !nv[1].isEmpty()) {
                jar.put(nv[0].trim(), nv[1]);
            }
        });
        JsonNode json = res.body() == null || res.body().isEmpty() ? null : mapper.readTree(res.body());
        if (res.statusCode() == 200) {
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

    private JsonNode adapt(String action, JsonNode json) {
        switch (action) {
            case "addModel", "addVariant" -> {
                ObjectNode o = ((ObjectNode) json).deepCopy();
                o.put("id", "<new-id>");
                return o;
            }
            case "getDeviceDisplayPrices" -> {
                ArrayNode a = F.arrayNode();
                json.forEach(p -> a.add(((ObjectNode) p.deepCopy()).without("id")));
                return a;
            }
            case "updateDeviceDisplayPrice" -> {
                ObjectNode o = F.objectNode();
                o.set("success", json.get("success"));
                return o;
            }
            default -> {
                return json;
            }
        }
    }

    private JsonNode snapshot() {
        ObjectNode s = F.objectNode();
        List<String> brandIds = new ArrayList<>();
        ArrayNode brands = s.putArray("brands");
        jdbc.query("SELECT id, name, logo, categories, priority FROM \"Brand\" WHERE id LIKE 'acme%' OR id = 'zeta' ORDER BY id ASC", rs -> {
            ObjectNode b = brands.addObject();
            brandIds.add(rs.getString(1));
            b.put("id", rs.getString(1));
            b.put("name", rs.getString(2));
            b.put("logo", rs.getString(3));
            b.set("categories", array(rs.getArray(4)));
            b.put("priority", rs.getInt(5));
        });
        ArrayNode models = s.putArray("models");
        ArrayNode variants = s.putArray("variants");
        if (!brandIds.isEmpty()) {
            String in = String.join(",", brandIds.stream().map(x -> "'" + x + "'").toList());
            jdbc.query("SELECT \"brandId\", name, img, category, priority FROM \"Model\" WHERE \"brandId\" IN (" + in + ") ORDER BY name ASC", rs -> {
                ObjectNode m = models.addObject();
                m.put("brandId", rs.getString(1));
                m.put("name", rs.getString(2));
                m.put("img", rs.getString(3));
                m.put("category", rs.getString(4));
                m.put("priority", rs.getInt(5));
            });
            List<ObjectNode> list = new ArrayList<>();
            jdbc.query("SELECT m.name, v.name, v.\"basePrice\" FROM \"Variant\" v JOIN \"Model\" m ON m.id = v.\"modelId\" WHERE m.\"brandId\" IN (" + in + ")", rs -> {
                ObjectNode v = F.objectNode();
                v.put("model", rs.getString(1));
                v.put("name", rs.getString(2));
                v.put("basePrice", rs.getInt(3));
                list.add(v);
            });
            list.sort((a, b) -> CatalogOrdering.localeCompare(a.get("model").asText() + "/" + a.get("name").asText(),
                    b.get("model").asText() + "/" + b.get("name").asText()));
            list.forEach(variants::add);
        }
        ArrayNode prices = s.putArray("bannerPrices");
        jdbc.query("SELECT \"categoryKey\", \"categoryName\", \"displayPrice\" FROM \"DeviceDisplayPrice\" ORDER BY \"categoryKey\" ASC", rs -> {
            ObjectNode p = prices.addObject();
            p.put("categoryKey", rs.getString(1));
            p.put("categoryName", rs.getString(2));
            p.put("displayPrice", rs.getString(3));
        });
        return s;
    }

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
            if (s.startsWith("$model:")) {
                return F.textNode(first("SELECT id FROM \"Model\" WHERE name = ? LIMIT 1", s.substring(7)));
            }
            if (s.startsWith("$variant:")) {
                String[] parts = s.substring(9).split("/", 2);
                List<String> r = jdbc.queryForList("SELECT v.id FROM \"Variant\" v JOIN \"Model\" m ON m.id = v.\"modelId\" WHERE m.name = ? AND v.name = ? LIMIT 1",
                        String.class, parts[0], parts[1]);
                return F.textNode(r.isEmpty() ? "NO-ID" : r.get(0));
            }
            if (s.startsWith("$banner:")) {
                return F.textNode(first("SELECT id FROM \"DeviceDisplayPrice\" WHERE \"categoryKey\" = ? LIMIT 1", s.substring(8)));
            }
        }
        return v;
    }

    private String first(String sql, String arg) {
        List<String> r = jdbc.queryForList(sql, String.class, arg);
        return r.isEmpty() ? "NO-ID" : r.get(0);
    }

    private static JsonNode array(Array sql) throws java.sql.SQLException {
        ArrayNode a = F.arrayNode();
        if (sql != null) {
            for (Object o : (Object[]) sql.getArray()) {
                a.add(String.valueOf(o));
            }
        }
        return a;
    }

    private JsonNode canon(JsonNode node) throws Exception {
        return mapper.readTree(mapper.writeValueAsString(node));
    }

    private HttpRequest.Builder send(String method, String path, String body) {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (body != null) {
            b.header("Content-Type", "application/json");
        }
        return b.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
