package in.fonzkart.backend.auth.rules;

import static in.fonzkart.backend.shared.text.JsText.trim;
import static in.fonzkart.backend.shared.text.JsText.truthy;

import java.util.Optional;
import java.util.regex.Pattern;

/** Phone handling rules from actions/auth.ts and actions/profile.ts (India-specific, unchanged). */
public final class PhoneNumbers {

    /** JavaScript /^\+?[\d\s\-]{10,}$/ — \d is ASCII digits, \s is Unicode whitespace. */
    private static final Pattern PHONE_LIKE = Pattern.compile(
            "\\+?[0-9\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF\\-]{10,}");

    private PhoneNumbers() {
    }

    /** signup()/updateProfile(): {@code if (phone && !phone.startsWith('+91')) phone = `+91${phone}`} */
    public static String withIndiaPrefix(String phone) {
        if (truthy(phone) && !phone.startsWith("+91")) {
            return "+91" + phone;
        }
        return phone;
    }

    /**
     * signin(): when the identifier is not a known email but looks like a phone number, the phone to look up.
     * 10 digits → +91 prefix; 12 digits starting with 91 → '+' prefix; otherwise used as typed (trimmed).
     */
    public static Optional<String> signinPhoneCandidate(String identifier) {
        String cleanPhone = trim(identifier);
        if (!PHONE_LIKE.matcher(cleanPhone).matches()) {
            return Optional.empty();
        }
        if (!cleanPhone.startsWith("+")) {
            if (cleanPhone.length() == 10) {
                cleanPhone = "+91" + cleanPhone;
            } else if (cleanPhone.length() == 12 && cleanPhone.startsWith("91")) {
                cleanPhone = "+" + cleanPhone;
            }
        }
        return Optional.of(cleanPhone);
    }
}
