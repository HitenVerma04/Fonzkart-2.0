package in.fonzkart.backend.rider.service;

import static org.assertj.core.api.Assertions.assertThat;

import in.fonzkart.backend.auth.password.PasswordHasher;
import org.junit.jupiter.api.Test;

/** Same rules as the website's lib/rider-password.ts (covered there by scripts/security-tests). */
class RiderPasswordsTest {

    private final RiderPasswords passwords = new RiderPasswords(new PasswordHasher());

    @Test
    void hashesLikeUserPasswords() {
        String hash = passwords.hash("first-pw");
        assertThat(hash).startsWith("$2b$10$").hasSize(60).isNotEqualTo(passwords.hash("first-pw"));
        assertThat(RiderPasswords.isHash(hash)).isTrue();
        assertThat(passwords.verify(hash, "first-pw")).isEqualTo(new RiderPasswords.Check(true, false));
        assertThat(passwords.verify(hash, "First-pw")).isEqualTo(new RiderPasswords.Check(false, false));
    }

    @Test
    void acceptsBcryptHashesFromTheWebsite() {
        // bcryptjs.hash('pw', 10), as in db/03-staff-seed.sql
        String bcryptjs = "$2b$10$vwCMCMkDDqa8kFUhqiPAI.ZyNG3a7xirwUvkyy3Aa8z8vn5VM4vXa";
        assertThat(passwords.verify(bcryptjs, "pw")).isEqualTo(new RiderPasswords.Check(true, false));
    }

    @Test
    void legacyPlainTextVerifiesExactlyAndAsksForRehash() {
        assertThat(passwords.verify("riderpw", "riderpw")).isEqualTo(new RiderPasswords.Check(true, true));
        assertThat(passwords.verify("riderpw", "riderpw ")).isEqualTo(new RiderPasswords.Check(false, false));
        assertThat(passwords.verify("riderpw", "RIDERPW")).isEqualTo(new RiderPasswords.Check(false, false));
        assertThat(passwords.verify("pässwörd", "pässwörd")).isEqualTo(new RiderPasswords.Check(true, true));
        assertThat(RiderPasswords.isHash("riderpw")).isFalse();
        assertThat(RiderPasswords.isHash("$2b$10$short")).isFalse();
    }

    @Test
    void emptyValuesNeverMatch() {
        assertThat(passwords.verify(null, "x").ok()).isFalse();
        assertThat(passwords.verify("", "").ok()).isFalse();
        assertThat(passwords.verify("x", "").ok()).isFalse();
        assertThat(passwords.verify("x", null).ok()).isFalse();
    }
}
