package in.fonzkart.backend.auth.session;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * The signed executive_id cookie. golden/executive-token-fixture.json holds tokens produced by the website's
 * lib/executive-session.ts (jose) for fixed inputs, so both backends are shown to issue and accept the same tokens.
 */
class ExecutiveTokenCodecTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static JsonNode fixture;

    @BeforeAll
    static void load() throws Exception {
        try (InputStream in = ExecutiveTokenCodecTest.class.getResourceAsStream("/golden/executive-token-fixture.json")) {
            fixture = MAPPER.readTree(in);
        }
    }

    private static ExecutiveTokenCodec codec() {
        return new ExecutiveTokenCodec(fixture.get("secret").asText(), MAPPER);
    }

    @Test
    void signsByteForByteIdenticalTokensToTheWebsite() {
        assertThat(fixture.get("tokens")).hasSize(3);
        for (JsonNode c : fixture.get("tokens")) {
            assertThat(codec().sign(c.get("riderId").asText(), c.get("iat").asLong()))
                    .as("rider %s", c.get("riderId")).isEqualTo(c.get("token").asText());
        }
    }

    @Test
    void acceptsWebsiteTokensUntilTheyExpire() {
        for (JsonNode c : fixture.get("tokens")) {
            String token = c.get("token").asText();
            long exp = c.get("exp").asLong();
            assertThat(exp).isEqualTo(c.get("iat").asLong() + ExecutiveTokenCodec.LIFETIME_SECONDS);
            assertThat(codec().verify(token, Instant.ofEpochSecond(exp - 1))).contains(c.get("riderId").asText());
            assertThat(codec().verify(token, Instant.ofEpochSecond(exp))).isEmpty();
        }
    }

    @Test
    void rejectsForgedTamperedAndForeignTokens() throws Exception {
        long now = 1_800_000_000L;
        Instant at = Instant.ofEpochSecond(now);
        String secret = fixture.get("secret").asText();
        String valid = codec().sign("r1", now);
        assertThat(codec().verify(valid, at)).contains("r1");

        String[] parts = valid.split("\\.");
        String otherPayload = b64("{\"typ\":\"executive\",\"sub\":\"r2\",\"iat\":" + now + ",\"exp\":" + (now + 600) + "}");
        byte[] derived = hmac(secret.getBytes(StandardCharsets.UTF_8), "fonzkart:executive-session:v1");

        // the legacy raw rider id, and nothing at all
        assertThat(codec().verify("r1", at)).isEmpty();
        assertThat(codec().verify("", at)).isEmpty();
        assertThat(codec().verify(null, at)).isEmpty();
        // payload changed after signing
        assertThat(codec().verify(parts[0] + "." + otherPayload + "." + parts[2], at)).isEmpty();
        // alg "none"
        assertThat(codec().verify(b64("{\"alg\":\"none\"}") + "." + otherPayload + ".", at)).isEmpty();
        // signed with another secret
        assertThat(new ExecutiveTokenCodec("another-secret", MAPPER).verify(valid, at)).isEmpty();
        // signed with the user-session key (the raw secret) instead of the derived executive key
        assertThat(codec().verify(signed(secret.getBytes(StandardCharsets.UTF_8),
                "{\"typ\":\"executive\",\"sub\":\"r1\",\"iat\":" + now + ",\"exp\":" + (now + 600) + "}"), at)).isEmpty();
        // correct key but wrong type, no expiry, or no subject
        assertThat(codec().verify(signed(derived, "{\"typ\":\"session\",\"sub\":\"r1\",\"exp\":" + (now + 600) + "}"), at)).isEmpty();
        assertThat(codec().verify(signed(derived, "{\"typ\":\"executive\",\"sub\":\"r1\"}"), at)).isEmpty();
        assertThat(codec().verify(signed(derived, "{\"typ\":\"executive\",\"sub\":\"\",\"exp\":" + (now + 600) + "}"), at)).isEmpty();
        assertThat(codec().verify(signed(derived, "{\"typ\":\"executive\",\"sub\":\"r1\",\"exp\":" + (now + 600) + "}"), at))
                .contains("r1");
        // a user session token is never an executive token
        String session = new SessionTokenCodec(secret, MAPPER)
                .sign(new SessionUser("u1", "a@b.c", "A", "FIELD_EXECUTIVE"), "2030-01-01T00:00:00.000Z", now);
        assertThat(codec().verify(session, at)).isEmpty();
        // ...and an executive token is never a user session with a user in it
        assertThat(new SessionTokenCodec(secret, MAPPER).verify(valid, at)).isEmpty();
    }

    private static String signed(byte[] key, String payloadJson) throws Exception {
        String input = b64("{\"alg\":\"HS256\"}") + "." + b64(payloadJson);
        return input + "." + B64.encodeToString(hmac(key, input));
    }

    private static byte[] hmac(byte[] key, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
    }

    private static String b64(String s) {
        return B64.encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }
}
