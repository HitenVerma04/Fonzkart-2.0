package in.fonzkart.backend.rider.service;

import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.auth.password.PasswordHasher;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Field-executive passwords ("Rider"."password"), same rules as the website's lib/rider-password.ts: new and
 * changed passwords are stored as bcrypt hashes (same format and cost as user passwords); legacy plain-text values
 * still verify, in constant time, and are reported for re-hashing so no executive is locked out.
 */
@Component
public class RiderPasswords {

    private static final Pattern BCRYPT_HASH = Pattern.compile("^\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}$");

    public record Check(boolean ok, boolean needsRehash) {
    }

    private final PasswordHasher hasher;

    public RiderPasswords(PasswordHasher hasher) {
        this.hasher = hasher;
    }

    public static boolean isHash(String stored) {
        return stored != null && BCRYPT_HASH.matcher(stored).matches();
    }

    public String hash(String password) {
        return hasher.hash(password);
    }

    public Check verify(String stored, String supplied) {
        if (!truthy(stored) || supplied == null || supplied.isEmpty()) {
            return new Check(false, false);
        }
        if (isHash(stored)) {
            return new Check(hasher.matches(supplied, stored), false);
        }
        boolean ok = MessageDigest.isEqual(stored.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8));
        return new Check(ok, ok);
    }
}
