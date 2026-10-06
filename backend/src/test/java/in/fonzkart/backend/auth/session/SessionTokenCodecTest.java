package in.fonzkart.backend.auth.session;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.time.Instant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Compatibility with lib/session.ts (jose 6.1.3). Fixtures in golden/auth-fixtures.json were produced by jose itself:
 * tokens signed exactly like encrypt() (with a fixed iat), and jwtVerify() verdicts for valid and hostile tokens.
 */
class SessionTokenCodecTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static JsonNode fixtures;

    @BeforeAll
    static void load() throws Exception {
        try (InputStream in = SessionTokenCodecTest.class.getResourceAsStream("/golden/auth-fixtures.json")) {
            fixtures = MAPPER.readTree(in);
        }
    }

    @Test
    void signsByteForByteIdenticalTokensToJose() {
        assertThat(fixtures.get("signed")).hasSize(12);
        for (JsonNode c : fixtures.get("signed")) {
            JsonNode u = c.get("user");
            SessionUser user = new SessionUser(u.get("id").asText(), u.get("email").asText(), u.get("name").asText(),
                    u.get("role").asText());
            String token = new SessionTokenCodec(c.get("secret").asText(), MAPPER)
                    .sign(user, c.get("expiresIso").asText(), c.get("iat").asLong());
            assertThat(token).as("secret=%s user=%s", c.get("secret"), u).isEqualTo(c.get("token").asText());
        }
    }

    @Test
    void decodesJoseTokens() {
        for (JsonNode c : fixtures.get("signed")) {
            long iat = c.get("iat").asLong();
            SessionPayload payload = new SessionTokenCodec(c.get("secret").asText(), MAPPER)
                    .verify(c.get("token").asText(), Instant.ofEpochSecond(iat + 3600)).orElseThrow();
            assertThat(payload.user().email()).isEqualTo(c.get("user").get("email").asText());
            assertThat(payload.user().name()).isEqualTo(c.get("user").get("name").asText());
            assertThat(payload.user().role()).isEqualTo(c.get("user").get("role").asText());
            assertThat(payload.expires()).isEqualTo(c.get("expiresIso").asText());
            assertThat(payload.iat()).isEqualTo(iat);
            assertThat(payload.exp()).isEqualTo(iat + SessionTokenCodec.ONE_WEEK_SECONDS);
        }
    }

    @Test
    void acceptsAndRejectsExactlyWhatJoseDoes() {
        JsonNode verify = fixtures.get("verify");
        SessionTokenCodec codec = new SessionTokenCodec(verify.get("secret").asText(), MAPPER);
        Instant now = Instant.ofEpochSecond(verify.get("nowEpochSeconds").asLong());
        assertThat(verify.get("cases")).hasSizeGreaterThanOrEqualTo(15);
        for (JsonNode c : verify.get("cases")) {
            assertThat(codec.verify(c.get("token").asText(), now).isPresent())
                    .as("case %s", c.get("name").asText())
                    .isEqualTo(c.get("accepted").asBoolean());
        }
    }

    @Test
    void tokenStopsBeingValidAtExpiry() {
        SessionTokenCodec codec = new SessionTokenCodec("k", MAPPER);
        String token = codec.sign(new SessionUser("1", "a@b.c", "A", "USER"), "2026-01-08T00:00:00.000Z", 1_000_000L);
        assertThat(codec.verify(token, Instant.ofEpochSecond(1_000_000L + 604_799))).isPresent();
        assertThat(codec.verify(token, Instant.ofEpochSecond(1_000_000L + 604_800))).isEmpty();
    }
}
