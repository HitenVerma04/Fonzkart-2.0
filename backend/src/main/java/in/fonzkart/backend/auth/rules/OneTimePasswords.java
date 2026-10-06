package in.fonzkart.backend.auth.rules;

import java.security.SecureRandom;
import java.time.Duration;

/**
 * OTP rules from actions/auth.ts: 6 digits (100000–999999), valid for 15 minutes, stored in
 * "User"."resetToken"/"resetTokenExpiry" (used for both email verification and password reset).
 * Generated with SecureRandom instead of Math.random(); the format and range are unchanged.
 */
public final class OneTimePasswords {

    public static final Duration VALIDITY = Duration.ofMinutes(15);

    private static final SecureRandom RANDOM = new SecureRandom();

    private OneTimePasswords() {
    }

    public static String generate() {
        return Integer.toString(100000 + RANDOM.nextInt(900000));
    }
}
