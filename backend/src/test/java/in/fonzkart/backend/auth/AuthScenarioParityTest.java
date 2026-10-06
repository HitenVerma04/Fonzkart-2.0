package in.fonzkart.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.fonzkart.backend.auth.session.SessionTokenCodec;
import in.fonzkart.backend.support.PostgresTestBase;
import in.fonzkart.backend.support.RecordingMailTransport;
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
 * Behavioural parity with the website (Next.js) implementation.
 * <p>
 * golden/auth-scenario.json (72 steps: sign-up, OTP verification, sign-in by email/phone, invalid credentials,
 * password reset, quick register/login, profile, logout, sessions, role grants/revocations, authorization
 * failures, identity overrides) was executed by scripts/security-tests/run.sh golden against the website's server
 * actions — actions/auth.ts, actions/inlineAuth.ts, actions/profile.ts, actions/admin.ts and lib/session.ts with
 * Prisma, jose, bcryptjs and nodemailer — on an empty database. The normalised outcome of every step, the session
 * cookie each actor holds afterwards, the final "User" rows and the emails sent are in
 * golden/auth-scenario-expected.json. This test replays the same scenario over HTTP against Spring Boot on an
 * identical empty database and requires identical results. Since the staff-permission hardening only administrators
 * may grant or revoke ADMIN and list admins, and getPartnersManagedBy needs an administrator or zonal head.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class AuthScenarioParityTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.emptyPrismaDatabase();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    private static final Set<String> DROP = Set.of("createdAt", "updatedAt", "passwordHash", "resetToken", "resetTokenExpiry");
    private static final Set<String> KNOWN_THROWN = Set.of("Unauthorized", "Forbidden: Admin access required");

    @LocalServerPort
    private int port;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private RecordingMailTransport mail;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();
    private final Map<String, String> jars = new HashMap<>();

    @Test
    void replaysScenarioWithIdenticalOutcomes() throws Exception {
        JsonNode scenario = read("/golden/auth-scenario.json");
        JsonNode expected = read("/golden/auth-scenario-expected.json");

        List<String> mismatches = new ArrayList<>();
        int i = 0;
        for (JsonNode step : scenario.get("steps")) {
            String actor = step.get("actor").asText();
            String action = step.get("action").asText();
            ObjectNode input = resolve((ObjectNode) step.get("input"));

            JsonNode outcome = normalize(invoke(actor, action, input));
            JsonNode cookieUser = normalize(cookieUser(actor));

            JsonNode exp = expected.get("steps").get(i);
            assertThat(exp.get("step").asText()).isEqualTo(actor + ":" + action);
            if (!exp.get("outcome").equals(outcome)) {
                mismatches.add("#" + (i + 1) + " " + actor + ":" + action + " outcome\n  expected " + exp.get("outcome")
                        + "\n  actual   " + outcome);
            }
            if (!exp.get("cookieUser").equals(cookieUser)) {
                mismatches.add("#" + (i + 1) + " " + actor + ":" + action + " cookie\n  expected " + exp.get("cookieUser")
                        + "\n  actual   " + cookieUser);
            }
            i++;
        }
        assertThat(i).isEqualTo(expected.get("steps").size()).isEqualTo(72);
        assertThat(mismatches).as("steps differing from the website implementation").isEmpty();

        // Final database state
        assertThat(normalize(usersSnapshot())).isEqualTo(expected.get("users"));

        // Emails sent (welcome emails are fire-and-forget, as in the original)
        List<String> mails = mail.awaitCount(expected.get("mails").size(), 5000).stream()
                .map(s -> s.message().to() + "|" + s.message().subject()).sorted().toList();
        List<String> expectedMails = new ArrayList<>();
        expected.get("mails").forEach(m -> expectedMails.add(m.asText()));
        assertThat(mails).containsExactlyElementsOf(expectedMails);
    }

    // ------------------------------------------------------------------------------------------- HTTP

    private JsonNode invoke(String actor, String action, ObjectNode in) throws Exception {
        String body = mapper.writeValueAsString(in);
        HttpRequest.Builder req = switch (action) {
            case "signin" -> post("/api/auth/signin", body);
            case "signup" -> post("/api/auth/signup", body);
            case "verifyEmail" -> post("/api/auth/verify-email", body);
            case "requestPasswordReset" -> post("/api/auth/password-reset/request", body);
            case "verifyAndResetPassword" -> post("/api/auth/password-reset/confirm", body);
            case "quickRegister" -> post("/api/auth/quick-register", body);
            case "quickLogin" -> post("/api/auth/quick-login", body);
            case "logout" -> post("/api/auth/logout", "{}");
            case "session" -> get("/api/auth/session");
            case "updateProfile" -> put("/api/users/me", body);
            case "getAdmins" -> get("/api/staff/admins");
            case "addAdmin" -> post("/api/staff/admins", body);
            case "addZonalHead" -> post("/api/staff/zonal-heads/grant", body);
            case "addRelationshipManager" -> post("/api/staff/relationship-managers/grant", body);
            case "addPartner" -> post("/api/staff/partners/grant", body);
            case "removeAdmin" -> post("/api/staff/admins/remove", body);
            case "removeUserRole" -> post("/api/staff/roles/remove", body);
            case "updatePartnerManager" -> put("/api/staff/partners/" + enc(in.get("partnerId").asText()) + "/manager", body);
            case "getPartnersManagedBy" -> get("/api/staff/partners/managed-by/" + enc(in.get("managerId").asText()));
            default -> throw new IllegalArgumentException(action);
        };
        String token = jars.get(actor);
        if (token != null) {
            req.header("Cookie", "session=" + token);
        }
        HttpResponse<String> res = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
        res.headers().allValues("Set-Cookie").forEach(c -> updateJar(actor, c));

        ObjectNode outcome = JsonNodeFactory.instance.objectNode();
        JsonNode json = res.body() == null || res.body().isEmpty() ? null : mapper.readTree(res.body());
        if (res.statusCode() == 200) {
            if (json != null && json.has("redirectTo")) {
                outcome.put("redirect", json.get("redirectTo").asText());
            } else if ("session".equals(action)) {
                JsonNode s = json.get("session");
                outcome.set("returned", s.isNull() ? s : JsonNodeFactory.instance.objectNode().set("user", s.get("user")));
            } else {
                outcome.set("returned", json == null ? JsonNodeFactory.instance.nullNode() : json);
            }
        } else if ((res.statusCode() == 401 || res.statusCode() == 403) && KNOWN_THROWN.contains(json.get("error").asText())) {
            outcome.put("thrown", json.get("error").asText());
        } else {
            outcome.put("thrown", "<server-error>");
        }
        return outcome;
    }

    private void updateJar(String actor, String setCookie) {
        String[] parts = setCookie.split(";");
        String[] nv = parts[0].split("=", 2);
        if (!"session".equals(nv[0].trim())) {
            return;
        }
        boolean expired = nv.length < 2 || nv[1].isEmpty() || setCookie.toLowerCase().contains("max-age=0");
        if (expired) {
            jars.remove(actor);
        } else {
            jars.put(actor, nv[1]);
        }
    }

    private JsonNode cookieUser(String actor) {
        String token = jars.get(actor);
        if (token == null) {
            return JsonNodeFactory.instance.nullNode();
        }
        return new SessionTokenCodec(PostgresTestBase.AUTH_SECRET, mapper).verify(token, Instant.now())
                .map(p -> (JsonNode) mapper.valueToTree(p.user()))
                .orElse(JsonNodeFactory.instance.textNode("INVALID"));
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

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }

    // ------------------------------------------------------------------------------- normalisation

    private ObjectNode resolve(ObjectNode input) {
        ObjectNode out = JsonNodeFactory.instance.objectNode();
        for (Iterator<Map.Entry<String, JsonNode>> it = input.fields(); it.hasNext(); ) {
            Map.Entry<String, JsonNode> e = it.next();
            String v = e.getValue().isTextual() ? e.getValue().asText() : null;
            if (v != null && v.startsWith("$otp:")) {
                out.put(e.getKey(), single("SELECT \"resetToken\" FROM \"User\" WHERE email = ?", v.substring(5), "NO-OTP"));
            } else if (v != null && v.startsWith("$id:")) {
                out.put(e.getKey(), single("SELECT id FROM \"User\" WHERE email = ?", v.substring(4), "NO-ID"));
            } else {
                out.set(e.getKey(), e.getValue());
            }
        }
        return out;
    }

    private String single(String sql, String email, String fallback) {
        List<String> r = jdbc.queryForList(sql, String.class, email);
        return r.isEmpty() || r.get(0) == null ? fallback : r.get(0);
    }

    private JsonNode normalize(JsonNode node) {
        Map<String, String> ids = new HashMap<>();
        jdbc.query("SELECT id, email FROM \"User\"", rs -> {
            ids.put(rs.getString(1), rs.getString(2));
        });
        return normalize(node, ids);
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
            return JsonNodeFactory.instance.textNode("<id:" + ids.get(node.asText()) + ">");
        }
        return node;
    }

    private JsonNode usersSnapshot() {
        ArrayNode users = JsonNodeFactory.instance.arrayNode();
        jdbc.query("SELECT email, name, role, phone, \"cityId\", \"managerId\", pincodes, \"resetToken\" "
                + "FROM \"User\" ORDER BY email ASC", rs -> {
            ObjectNode u = users.addObject();
            u.put("email", rs.getString(1));
            u.put("name", rs.getString(2));
            u.put("role", rs.getString(3));
            u.put("phone", rs.getString(4));
            u.put("cityId", rs.getString(5));
            u.put("managerId", rs.getString(6));
            ArrayNode pins = u.putArray("pincodes");
            java.sql.Array arr = rs.getArray(7);
            if (arr != null) {
                for (Object p : (Object[]) arr.getArray()) {
                    pins.add(String.valueOf(p));
                }
            }
            u.put("hasResetToken", rs.getString(8) != null);
        });
        return users;
    }

    private JsonNode read(String resource) throws Exception {
        try (InputStream in = getClass().getResourceAsStream(resource)) {
            return mapper.readTree(in);
        }
    }
}
