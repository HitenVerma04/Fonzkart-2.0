package in.fonzkart.backend.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.fonzkart.backend.pricing.rules.JsValues;
import in.fonzkart.backend.pricing.service.PricingService;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.support.PostgresTestBase;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
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
 * Bit-for-bit parity of the price engine with the ORIGINAL actions/priceCalculation.ts.
 * <p>
 * golden/pricing-cases.json holds 1,842 cases evaluated by the original calculatePrice (Node.js, real Prisma) on
 * db/04-pricing-rules-seed.sql: answer sets generated from the real questionnaire (lib/data.ts) for 15 categories
 * (including the sell flow's 'smartwatch'/'smarttv', unknown categories, '' and no category), 24 base prices around
 * every floor boundary, ~1/3 with type mutations (strings for arrays, numbers, null, {length} objects, nested arrays),
 * plus handcrafted edge cases. Phase "rules" uses the seeded rules; phase "fallback" runs with the table emptied so
 * every hard-coded branch is exercised. Expected values: the price, "NaN", or {"thrown": true}.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class PricingCasesParityTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.prismaDatabaseWith("db/04-pricing-rules-seed.sql");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    @LocalServerPort
    private int port;
    @Autowired
    private PricingService pricing;
    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void everyCaseMatchesTheOriginalEngine() throws Exception {
        JsonNode cases;
        try (InputStream in = getClass().getResourceAsStream("/golden/pricing-cases.json")) {
            cases = mapper.readTree(in).get("cases");
        }
        assertThat(cases).hasSize(1842);

        List<String> mismatches = new ArrayList<>();
        int index = 0;
        int viaHttp = 0;
        boolean rulesDeleted = false;
        for (JsonNode c : cases) {
            if (c.get("phase").asText().equals("fallback") && !rulesDeleted) {
                jdbc.update("DELETE FROM \"EvaluationRule\"");
                rulesDeleted = true;
            }
            JsonNode expected = c.get("expected");
            String actual = viaService(c);
            if (!expectedAsString(expected).equals(actual)) {
                mismatches.add("#" + index + " " + c + " -> expected " + expected + " actual " + actual);
            }
            if (index % 15 == 0) {
                viaHttp++;
                String httpActual = viaHttp(c);
                if (!expectedAsString(expected).equals(httpActual)) {
                    mismatches.add("#" + index + " (HTTP) " + c + " -> expected " + expected + " actual " + httpActual);
                }
            }
            index++;
        }
        assertThat(viaHttp).isGreaterThan(100);
        assertThat(mismatches).as("cases differing from the original calculatePrice").isEmpty();
    }

    private String viaService(JsonNode c) {
        try {
            double v = pricing.calculatePrice(c.get("basePrice").asDouble(),
                    c.has("answers") ? c.get("answers") : JsValues.undefined(),
                    c.has("category") ? c.get("category") : JsValues.undefined());
            return format(v);
        } catch (ActionException e) {
            return "thrown";
        }
    }

    private String viaHttp(JsonNode c) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.set("basePrice", c.get("basePrice"));
        if (c.has("answers")) {
            body.set("answers", c.get("answers"));
        }
        if (c.has("category")) {
            body.set("category", c.get("category"));
        }
        HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/pricing/calculate"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build(),
                HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() == 500) {
            return "thrown";
        }
        assertThat(res.statusCode()).as(res.body()).isEqualTo(200);
        JsonNode json = mapper.readTree(res.body());
        // JSON.stringify(NaN) is null; the reference recorded the raw NaN
        return json.isNull() ? "NaN" : format(json.asDouble());
    }

    private static String expectedAsString(JsonNode expected) {
        if (expected.isObject() && expected.has("thrown")) {
            return "thrown";
        }
        if (expected.isTextual()) {
            return expected.asText(); // "NaN"
        }
        return format(expected.asDouble());
    }

    private static String format(double v) {
        return Double.isNaN(v) ? "NaN" : Double.toString(v);
    }
}
