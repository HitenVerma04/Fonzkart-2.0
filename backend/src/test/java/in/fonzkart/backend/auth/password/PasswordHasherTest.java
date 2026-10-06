package in.fonzkart.backend.auth.password;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/** Compatibility with bcryptjs 3.0.3 (fixtures produced by bcryptjs: golden/auth-fixtures.json). */
class PasswordHasherTest {

    private static JsonNode fixtures;
    private final PasswordHasher hasher = new PasswordHasher();

    @BeforeAll
    static void load() throws Exception {
        try (InputStream in = PasswordHasherTest.class.getResourceAsStream("/golden/auth-fixtures.json")) {
            fixtures = new ObjectMapper().readTree(in);
        }
    }

    @Test
    void verifiesHashesCreatedByBcryptjs() {
        assertThat(fixtures.get("bcrypt")).hasSize(13);
        for (JsonNode c : fixtures.get("bcrypt")) {
            String password = c.get("password").asText();
            String hash = c.get("hash").asText();
            assertThat(hasher.matches(password, hash)).as("password %s", password).isTrue();
            assertThat(hasher.matches(password + "!", hash)).as("wrong password for %s", password)
                    .isEqualTo(password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length >= 72);
        }
    }

    @Test
    void onlyTheFirst72BytesCountLikeBcryptjs() {
        JsonNode t = fixtures.get("truncation");
        assertThat(t.get("jsCompare").asBoolean()).isTrue();
        assertThat(hasher.matches(t.get("other").asText(), t.get("hash").asText())).isTrue();
    }

    @Test
    void producesBcryptjsFormatHashes() {
        String hash = hasher.hash("pässwörd");
        assertThat(hash).startsWith("$2b$10$").hasSize(60);
        assertThat(hasher.matches("pässwörd", hash)).isTrue();
        assertThat(hasher.matches("passwörd", hash)).isFalse();
    }

    @Test
    void malformedOrEmptyHashesNeverMatch() {
        assertThat(hasher.matches("x", "")).isFalse();
        assertThat(hasher.matches("x", "not-a-bcrypt-hash")).isFalse();
        assertThat(hasher.matches(null, "$2b$10$abc")).isFalse();
    }
}
