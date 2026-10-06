package in.fonzkart.backend.auth.password;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Component;

/**
 * Same password hashing as the Next.js app ({@code bcryptjs} 3.x): bcrypt, version {@code $2b$}, cost 10,
 * UTF-8 password bytes with only the first 72 bytes significant (bcryptjs truncates silently instead of failing).
 * Hashes are interchangeable in both directions (verified by tests against bcryptjs output).
 */
@Component
public class PasswordHasher {

    private static final int COST = 10;
    private static final int MAX_BYTES = 72;

    /** bcrypt.hash(password, 10) */
    public String hash(String password) {
        return BCrypt.hashpw(bytes(password), BCrypt.gensalt("$2b", COST));
    }

    /** bcrypt.compare(password, hash) — false for malformed hashes instead of throwing. */
    public boolean matches(String password, String hash) {
        if (password == null || hash == null || hash.isEmpty()) {
            return false;
        }
        try {
            return BCrypt.checkpw(bytes(password), hash);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static byte[] bytes(String password) {
        byte[] b = password.getBytes(StandardCharsets.UTF_8);
        return b.length > MAX_BYTES ? Arrays.copyOf(b, MAX_BYTES) : b;
    }
}
