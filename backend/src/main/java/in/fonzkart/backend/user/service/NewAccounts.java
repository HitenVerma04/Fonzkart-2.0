package in.fonzkart.backend.user.service;

import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.user.repository.UserRepository;
import java.util.Optional;

/**
 * Checks for staff accounts created from the Admin app or website (partners, zonal heads), so the form gets a clear
 * reason instead of a silent "not created" or a database error.
 */
final class NewAccounts {

    private NewAccounts() {
    }

    /** A blank phone is stored as no phone: phones are unique, so two "" phones would clash. */
    static String phoneOrNull(String phone) {
        return truthy(phone) && !phone.isBlank() ? phone.trim() : null;
    }

    /** Why the account cannot be created, or empty when it can. */
    static Optional<String> problem(UserRepository users, String name, String email, String phone, String password) {
        if (!truthy(name) || name.isBlank()) {
            return Optional.of("Enter a name.");
        }
        if (!truthy(email) || !email.trim().matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
            return Optional.of("Enter a valid email address.");
        }
        if (!truthy(password)) {
            return Optional.of("Enter a first password.");
        }
        if (users.findUserByEmail(email).isPresent()) {
            return Optional.of("An account with " + email.trim() + " already exists. To give it this role, use \"Upgrade an account\" (Partners) or Users & roles.");
        }
        String p = phoneOrNull(phone);
        if (p != null && users.findFirstByPhone(p).isPresent()) {
            return Optional.of("An account with the phone number " + p + " already exists.");
        }
        return Optional.empty();
    }
}
