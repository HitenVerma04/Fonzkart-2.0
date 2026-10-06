package in.fonzkart.backend.auth.session;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * The signed field-executive identity carried by the {@code executive_id} cookie, identical to the website's
 * lib/executive-session.ts (jose):
 * <pre>
 * new SignJWT({ typ: 'executive' }).setProtectedHeader({ alg: 'HS256' }).setSubject(riderId)
 *     .setIssuedAt(iat).setExpirationTime(iat + 7 days).sign(key)
 * key = HMAC-SHA256(AUTH_SECRET, "fonzkart:executive-session:v1")
 * </pre>
 * The derived key keeps user session tokens and executive tokens apart: neither is accepted as the other. Tokens
 * are byte-for-byte identical to the website's for the same input (golden/executive-token-fixture.json).
 */
public class ExecutiveTokenCodec {

    public static final long LIFETIME_SECONDS = 7L * 24 * 60 * 60;
    static final String KEY_LABEL = "fonzkart:executive-session:v1";

    private static final String HEADER_JSON = "{\"alg\":\"HS256\"}";
    private static final String TYPE = "executive";
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();

    private final byte[] key;
    private final ObjectMapper mapper;

    /** @param secret the non-empty AUTH_SECRET (UTF-8), as for user sessions */
    public ExecutiveTokenCodec(String secret, ObjectMapper mapper) {
        if (secret == null || secret.isEmpty()) {
            throw new IllegalArgumentException("Session secret must not be empty");
        }
        this.key = hmac(secret.getBytes(StandardCharsets.UTF_8), KEY_LABEL.getBytes(StandardCharsets.UTF_8));
        this.mapper = mapper;
    }

    public String sign(String riderId, long issuedAtSeconds) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("typ", TYPE);
        payload.put("sub", riderId);
        payload.put("iat", issuedAtSeconds);
        payload.put("exp", issuedAtSeconds + LIFETIME_SECONDS);
        try {
            String signingInput = B64.encodeToString(HEADER_JSON.getBytes(StandardCharsets.UTF_8)) + "."
                    + B64.encodeToString(mapper.writeValueAsString(payload).getBytes(StandardCharsets.UTF_8));
            return signingInput + "." + B64.encodeToString(hmac(key, signingInput.getBytes(StandardCharsets.US_ASCII)));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialise executive token", e);
        }
    }

    /**
     * The rider id of a valid token; empty for anything else: malformed, alg other than HS256, critical headers,
     * bad signature, missing or past {@code exp}, future {@code nbf}, {@code typ} other than "executive", or no
     * {@code sub}. A legacy cookie holding a raw rider id is not a token and is rejected.
     */
    public Optional<String> verify(String token, Instant now) {
        if (token == null || token.isEmpty()) {
            return Optional.empty();
        }
        try {
            String[] parts = token.split("\\.", -1);
            if (parts.length != 3) {
                return Optional.empty();
            }
            JsonNode header = mapper.readTree(B64D.decode(parts[0]));
            if (header == null || !header.isObject() || !"HS256".equals(header.path("alg").asText(null))
                    || header.has("crit") || (header.has("b64") && !header.get("b64").asBoolean(true))) {
                return Optional.empty();
            }
            byte[] expected = hmac(key, (parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
            if (!MessageDigest.isEqual(expected, B64D.decode(parts[2]))) {
                return Optional.empty();
            }
            JsonNode payload = mapper.readTree(B64D.decode(parts[1]));
            if (payload == null || !payload.isObject()) {
                return Optional.empty();
            }
            long nowSeconds = now.getEpochSecond();
            if (!payload.path("exp").isNumber() || payload.get("exp").asDouble() <= nowSeconds) {
                return Optional.empty();
            }
            if (payload.has("nbf") && (!payload.get("nbf").isNumber() || payload.get("nbf").asDouble() > nowSeconds)) {
                return Optional.empty();
            }
            if (payload.has("iat") && !payload.get("iat").isNumber()) {
                return Optional.empty();
            }
            JsonNode sub = payload.get("sub");
            if (!TYPE.equals(payload.path("typ").asText(null)) || sub == null || !sub.isTextual() || sub.asText().isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(sub.asText());
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private static byte[] hmac(byte[] key, byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA256 unavailable", e);
        }
    }
}
