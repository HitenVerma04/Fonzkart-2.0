package in.fonzkart.backend.shared.mail;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.support.PostgresTestBase;
import in.fonzkart.backend.support.RecordingMailTransport;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
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
 * The email system: each staff member sees and sends from only the mailboxes they may use (administrators all;
 * partners their own and their executives' phone@fonzkart.in; others their own), passwords are never listed, and a
 * sent message goes out with that mailbox's own credentials and is kept.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class EmailHubIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.prismaDatabaseWith("db/03-staff-seed.sql");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    @LocalServerPort
    private int port;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private RecordingMailTransport mail;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();

    @BeforeEach
    void seed() {
        jdbc.update("DELETE FROM \"EmailMessage\"");
        jdbc.update("DELETE FROM \"EmailAccount\"");
        jdbc.update("INSERT INTO \"EmailAccount\" (id, email, password, \"createdAt\", \"updatedAt\") VALUES "
                + "('a1', 'support@fonzkart.in', 'support-secret', now(), now()), ('a2', '+917000000001@fonzkart.in', 'ravi-secret', now(), now())");
        jdbc.update("INSERT INTO \"EmailMessage\" (id, \"from\", \"to\", subject, \"bodyText\", \"receivedAt\", \"createdAt\", \"updatedAt\") VALUES "
                + "('m1', 'someone@example.com', 'support@fonzkart.in', 'Private', 'secret', now(), now(), now()), "
                + "('m2', 'hub@example.com', '+917000000001@fonzkart.in', 'For Ravi', 'pickup list', now(), now(), now())");
        mail.clear();
    }

    @Test
    void everyoneSeesOnlyTheirMailboxes() throws Exception {
        String admin = token("ops@example.test");
        String partner = token("p1@example.test");
        String customer = token("cust@example.test");

        assertThat(call("GET", "/api/email/messages", null, null).status()).isEqualTo(401);
        assertThat(subjects(call("GET", "/api/email/messages", admin, null).body())).containsExactlyInAnyOrder("Private", "For Ravi");
        // Partner One's executives include Ravi (+917000000001): his mailbox, not support's.
        assertThat(subjects(call("GET", "/api/email/messages", partner, null).body())).containsExactly("For Ravi");
        assertThat(call("GET", "/api/email/messages?account=support@fonzkart.in", partner, null).status()).isEqualTo(403);
        assertThat(call("GET", "/api/email/messages/m1", partner, null).status()).isEqualTo(404);
        assertThat(call("GET", "/api/email/messages/m2", partner, null).body().get("subject").asText()).isEqualTo("For Ravi");
        assertThat(subjects(call("GET", "/api/email/messages", customer, null).body())).isEmpty();

        assertThat(call("GET", "/api/email/accounts", partner, null).status()).isEqualTo(403);
        Res accounts = call("GET", "/api/email/accounts", admin, null);
        assertThat(accounts.body().findValuesAsText("email")).contains("support@fonzkart.in");
        assertThat(accounts.raw()).doesNotContain("password").doesNotContain("secret");
    }

    @Test
    void sendingUsesTheMailboxOwnCredentialsAndOnlyAllowedMailboxes() throws Exception {
        String admin = token("ops@example.test");
        String customer = token("cust@example.test");
        Map<String, String> message = Map.of("fromAccount", "support@fonzkart.in", "to", "customer@example.com",
                "subject", "Your pickup", "text", "Hello <b>there</b>\nSee you at 3 PM");

        assertThat(call("POST", "/api/email/send", customer, message).status()).isEqualTo(403);
        assertThat(mail.sent()).isEmpty();

        Res sent = call("POST", "/api/email/send", admin, message);
        assertThat(sent.status()).isEqualTo(200);
        assertThat(mail.sent()).hasSize(1);
        RecordingMailTransport.Sent out = mail.sent().get(0);
        assertThat(out.target().username()).isEqualTo("support@fonzkart.in");
        assertThat(out.target().password()).isEqualTo("support-secret");
        assertThat(out.message().to()).isEqualTo("customer@example.com");
        assertThat(out.message().html()).contains("Hello &lt;b&gt;there&lt;/b&gt;").doesNotContain("<b>");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"EmailMessage\" WHERE \"isOutbound\" AND subject = 'Your pickup'", Integer.class))
                .isEqualTo(1);

        assertThat(call("POST", "/api/email/send", admin, Map.of("fromAccount", "support@fonzkart.in")).status()).isEqualTo(400);
        assertThat(call("POST", "/api/email/send", admin, Map.of("fromAccount", "nobody@fonzkart.in", "to", "a@b.c", "subject", "s", "text", "t"))
                .status()).isEqualTo(404);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private record Res(int status, JsonNode body, String raw) {
    }

    private List<String> subjects(JsonNode body) {
        return body.get("emails").findValuesAsText("subject");
    }

    private String token(String email) throws Exception {
        HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/signin"))
                .header("Content-Type", "application/json").header("X-Client", "mobile")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(Map.of("email", email, "password", "pw")))).build(),
                HttpResponse.BodyHandlers.ofString());
        return res.headers().firstValue("X-Auth-Token").orElseThrow();
    }

    private Res call(String method, String path, String bearer, Object body) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (bearer != null) {
            b.header("Authorization", "Bearer " + bearer);
        }
        if (body != null) {
            b.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
        } else {
            b.method(method, HttpRequest.BodyPublishers.noBody());
        }
        HttpResponse<String> res = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
        return new Res(res.statusCode(), res.body() == null || res.body().isEmpty() ? null : mapper.readTree(res.body()), res.body());
    }
}
