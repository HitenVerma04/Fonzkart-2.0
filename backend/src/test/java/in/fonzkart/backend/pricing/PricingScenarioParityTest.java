package in.fonzkart.backend.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.fonzkart.backend.support.PostgresTestBase;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
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
 * Evaluation-rule management parity with the website actions (getEvaluationRules, upsertEvaluationRule including
 * access control and Prisma's validation/coercion, and calculatePrice before and after rule changes).
 * golden/pricing-scenario.json was executed against the website code (scripts/security-tests/run.sh golden) on
 * db/01 + db/03 + db/04 seeds — since the staff-permission hardening only SUPER_ADMIN and ADMIN may change rules;
 * the outcome of every step and the final "EvaluationRule" table are in golden/pricing-scenario-expected.json.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class PricingScenarioParityTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            PostgresTestBase.prismaDatabaseWith("db/03-staff-seed.sql", "db/04-pricing-rules-seed.sql");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    private static final Set<String> DROP = Set.of("id", "createdAt", "updatedAt");
    private static final Set<String> KNOWN_THROWN = Set.of("Unauthorized", "Forbidden: Admin access required");

    @LocalServerPort
    private int port;
    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();
    private final Map<String, String> sessions = new HashMap<>();

    @Test
    void replaysScenarioWithIdenticalOutcomes() throws Exception {
        JsonNode scenario = read("/golden/pricing-scenario.json");
        JsonNode expected = read("/golden/pricing-scenario-expected.json");

        List<String> mismatches = new ArrayList<>();
        int i = 0;
        for (JsonNode step : scenario.get("steps")) {
            String actor = step.get("actor").asText();
            String action = step.get("action").asText();
            JsonNode outcome = normalize(invoke(actor, action, step.get("input")));
            JsonNode exp = expected.get("steps").get(i);
            assertThat(exp.get("step").asText()).isEqualTo(actor + ":" + action);
            if (!normalize(exp.get("outcome")).equals(outcome)) {
                mismatches.add("#" + (i + 1) + " " + actor + ":" + action + "\n  expected " + exp.get("outcome")
                        + "\n  actual   " + outcome);
            }
            i++;
        }
        assertThat(i).isEqualTo(35);
        assertThat(mismatches).as("steps differing from the website implementation").isEmpty();
        assertThat(normalize(rulesSnapshot())).isEqualTo(normalize(expected.get("rules")));
    }

    private JsonNode invoke(String actor, String action, JsonNode in) throws Exception {
        HttpRequest.Builder req = switch (action) {
            case "signin" -> json("POST", "/api/auth/signin", in);
            case "getEvaluationRules" -> HttpRequest.newBuilder(uri("/api/pricing/rules"
                    + (in.has("category") ? "?category=" + URLEncoder.encode(in.get("category").asText(), StandardCharsets.UTF_8) : "")))
                    .GET();
            case "upsertEvaluationRule" -> json("PUT", "/api/pricing/rules", in);
            case "calculatePrice" -> json("POST", "/api/pricing/calculate", in);
            default -> throw new IllegalArgumentException(action);
        };
        if (sessions.containsKey(actor)) {
            req.header("Cookie", "session=" + sessions.get(actor));
        }
        HttpResponse<String> res = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
        res.headers().allValues("Set-Cookie").stream().filter(c -> c.startsWith("session="))
                .forEach(c -> sessions.put(actor, c.split(";")[0].substring("session=".length())));

        ObjectNode outcome = JsonNodeFactory.instance.objectNode();
        JsonNode body = res.body() == null || res.body().isEmpty() ? null : mapper.readTree(res.body());
        if (res.statusCode() == 200) {
            if (body != null && body.isObject() && body.has("redirectTo")) {
                outcome.put("redirect", body.get("redirectTo").asText());
            } else {
                outcome.set("returned", body == null ? JsonNodeFactory.instance.nullNode() : body);
            }
        } else if ((res.statusCode() == 401 || res.statusCode() == 403) && KNOWN_THROWN.contains(body.get("error").asText())) {
            outcome.put("thrown", body.get("error").asText());
        } else {
            outcome.put("thrown", "<server-error>");
        }
        return outcome;
    }

    private HttpRequest.Builder json(String method, String path, JsonNode body) throws Exception {
        return HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    private JsonNode rulesSnapshot() {
        ArrayNode rules = JsonNodeFactory.instance.arrayNode();
        jdbc.query("SELECT category, \"questionKey\", \"answerKey\", label, \"deductionAmount\", \"deductionPercent\" "
                + "FROM \"EvaluationRule\" ORDER BY category ASC, \"questionKey\" ASC, \"answerKey\" ASC", rs -> {
            ObjectNode r = rules.addObject();
            r.put("category", rs.getString(1));
            r.put("questionKey", rs.getString(2));
            r.put("answerKey", rs.getString(3));
            r.put("label", rs.getString(4));
            r.put("deductionAmount", rs.getInt(5));
            r.put("deductionPercent", rs.getDouble(6));
        });
        return rules;
    }

    /** Drops volatile fields and compares all numbers by value (10 == 10.0). */
    private JsonNode normalize(JsonNode node) {
        if (node == null) {
            return JsonNodeFactory.instance.nullNode();
        }
        if (node.isArray()) {
            ArrayNode a = JsonNodeFactory.instance.arrayNode();
            node.forEach(n -> a.add(normalize(n)));
            return a;
        }
        if (node.isObject()) {
            ObjectNode o = JsonNodeFactory.instance.objectNode();
            node.fields().forEachRemaining(e -> {
                if (!DROP.contains(e.getKey())) {
                    o.set(e.getKey(), normalize(e.getValue()));
                }
            });
            return o;
        }
        if (node.isNumber()) {
            return JsonNodeFactory.instance.numberNode(node.asDouble());
        }
        return node;
    }

    private JsonNode read(String resource) throws Exception {
        try (InputStream in = getClass().getResourceAsStream(resource)) {
            return mapper.readTree(in);
        }
    }
}
