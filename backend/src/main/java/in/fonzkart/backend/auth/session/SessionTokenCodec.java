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
 * Signs and verifies session tokens exactly like lib/session.ts does with the {@code jose} library (v6):
 * <pre>
 * new SignJWT({ user, expires }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1 week')
 * jwtVerify(token, key, { algorithms: ['HS256'] })
 * </pre>
 * Implemented directly on HMAC-SHA256 (no JWT library) because common Java JWT libraries reject HS256 keys
 * shorter than 256 bits, which jose accepts — the existing AUTH_SECRET must keep working unchanged.
 * Tokens are byte-for-byte identical to jose's for the same input (verified by tests).
 */
public class SessionTokenCodec {

    public static final long ONE_WEEK_SECONDS = 7L * 24 * 60 * 60;

    private static final String HEADER_JSON = "{\"alg\":\"HS256\"}";
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();

    private final byte[] key;
    private final ObjectMapper mapper;

    /** @param secret the non-empty AUTH_SECRET string; encoded as UTF-8 like {@code new TextEncoder().encode(secret)} */
    public SessionTokenCodec(String secret, ObjectMapper mapper) {
        if (secret == null || secret.isEmpty()) {
            throw new IllegalArgumentException("Session secret must not be empty");
        }
        this.key = secret.getBytes(StandardCharsets.UTF_8);
        this.mapper = mapper;
    }

    /** encrypt({ user, expires }) with iat = issuedAtSeconds and exp = iat + 1 week. */
    public String sign(SessionUser user, String expiresIso, long issuedAtSeconds) {
        Map<String, Object> userJson = new LinkedHashMap<>();
        userJson.put("id", user.id());
        userJson.put("email", user.email());
        userJson.put("name", user.name());
        userJson.put("role", user.role());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("user", userJson);
        payload.put("expires", expiresIso);
        payload.put("iat", issuedAtSeconds);
        payload.put("exp", issuedAtSeconds + ONE_WEEK_SECONDS);
        try {
            // writeValueAsString (not ...AsBytes): Jackson's UTF-8 byte writer escapes non-BMP characters such as
            // emoji as \\uD83D\\uDE00, whereas JSON.stringify (used by jose) emits them raw.
            String signingInput = B64.encodeToString(HEADER_JSON.getBytes(StandardCharsets.UTF_8)) + "."
                    + B64.encodeToString(mapper.writeValueAsString(payload).getBytes(StandardCharsets.UTF_8));
            return signingInput + "." + B64.encodeToString(hmac(signingInput));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialise session payload", e);
        }
    }

    /**
     * decrypt(token) — returns empty when jose's jwtVerify would throw: malformed token, header alg other than
     * HS256, critical headers, bad signature, non-object payload, non-numeric or past {@code exp},
     * future {@code nbf}.
     */
    public Optional<SessionPayload> verify(String token, Instant now) {
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
            byte[] signature = B64D.decode(parts[2]);
            if (!MessageDigest.isEqual(hmac(parts[0] + "." + parts[1]), signature)) {
                return Optional.empty();
            }
            JsonNode payload = mapper.readTree(B64D.decode(parts[1]));
            if (payload == null || !payload.isObject()) {
                return Optional.empty();
            }
            long nowSeconds = now.getEpochSecond();
            if (payload.has("exp") && (!payload.get("exp").isNumber() || payload.get("exp").asDouble() <= nowSeconds)) {
                return Optional.empty();
            }
            if (payload.has("nbf") && (!payload.get("nbf").isNumber() || payload.get("nbf").asDouble() > nowSeconds)) {
                return Optional.empty();
            }
            if (payload.has("iat") && !payload.get("iat").isNumber()) {
                return Optional.empty();
            }
            JsonNode u = payload.path("user");
            SessionUser user = u.isObject()
                    ? new SessionUser(text(u, "id"), text(u, "email"), text(u, "name"), text(u, "role"))
                    : null;
            return Optional.of(new SessionPayload(user, text(payload, "expires"),
                    payload.has("iat") ? payload.get("iat").asLong() : null,
                    payload.has("exp") ? payload.get("exp").asLong() : null));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private byte[] hmac(String signingInput) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(signingInput.getBytes(StandardCharsets.US_ASCII));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA256 unavailable", e);
        }
    }
}
