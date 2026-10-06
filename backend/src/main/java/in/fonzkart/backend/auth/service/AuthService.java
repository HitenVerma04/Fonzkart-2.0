package in.fonzkart.backend.auth.service;

import static in.fonzkart.backend.shared.text.JsText.encodeURIComponent;
import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.auth.config.AuthProperties;
import in.fonzkart.backend.auth.password.PasswordHasher;
import in.fonzkart.backend.auth.rules.AccessRules;
import in.fonzkart.backend.auth.rules.OneTimePasswords;
import in.fonzkart.backend.auth.rules.PhoneNumbers;
import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.shared.mail.MailService;
import in.fonzkart.backend.shared.mail.MailService.Channel;
import in.fonzkart.backend.shared.mail.MailService.Credentials;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.shared.web.ActionResponse;
import in.fonzkart.backend.user.entity.User;
import in.fonzkart.backend.user.repository.Constraints;
import in.fonzkart.backend.user.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

/**
 * Port of actions/auth.ts (signup, verifyEmailSignup, signin, requestPasswordReset, verifyAndResetPassword) and
 * actions/inlineAuth.ts (quickRegister, quickLogin). Messages, redirects, role handling and database effects are
 * the original ones; each step is its own database call, as in the original (no wrapping transaction).
 */
@Service
public class AuthService {

    static final String NO_MAIL_ACCOUNT = "No system email accounts exist. Please create one in /admin/email first.";

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository users;
    private final PasswordHasher passwords;
    private final SessionService sessions;
    private final AccessRules access;
    private final MailService mail;
    private final AuthProperties properties;

    public AuthService(UserRepository users, PasswordHasher passwords, SessionService sessions, AccessRules access,
                       MailService mail, AuthProperties properties) {
        this.users = users;
        this.passwords = passwords;
        this.sessions = sessions;
        this.access = access;
        this.mail = mail;
        this.properties = properties;
    }

    // ---------------------------------------------------------------------------------------------- signup

    public ActionResponse signup(String name, String email, String phone, String password) {
        if (!truthy(email) || !truthy(password) || !truthy(name) || !truthy(phone)) {
            return error("Please fill all fields");
        }
        phone = PhoneNumbers.withIndiaPrefix(phone);

        if (users.findUserByEmail(email).isPresent()) {
            return error("Email already registered");
        }

        String id = UUID.randomUUID().toString();
        String passwordHash = passwords.hash(password);

        if (truthy(phone) && users.findByPhone(phone).isPresent()) {
            return error("Phone number already registered");
        }

        boolean isSuperAdminEmail = access.isSuperAdminEmail(email);
        Optional<ActionResponse> createError = createUser(id, name, email, phone, passwordHash,
                isSuperAdminEmail ? Roles.SUPER_ADMIN : Roles.UNVERIFIED);
        if (createError.isPresent()) {
            return createError.get();
        }

        if (isSuperAdminEmail) {
            return ActionResponse.redirect("/admin", sessions.login(new SessionUser(id, email, name, Roles.SUPER_ADMIN)));
        }

        String otp = OneTimePasswords.generate();
        storeOtp(email, otp);

        try {
            Optional<Credentials> credentials = mail.credentials();
            if (credentials.isEmpty()) {
                return error(NO_MAIL_ACCOUNT);
            }
            mail.send(Channel.AUTH, credentials.get(), mail.fromOr(credentials.get().user()), email,
                    AuthEmails.VERIFY_SUBJECT, AuthEmails.signupOtp(otp));
        } catch (Exception e) {
            log.error("Signup Email Verify Failed", e);
        }

        return ActionResponse.redirect("/verify-email?email=" + encodeURIComponent(email));
    }

    // ---------------------------------------------------------------------------------- verifyEmailSignup

    public ActionResponse verifyEmailSignup(String email, String otp) {
        if (!truthy(email) || !truthy(otp)) {
            return error("Missing information.");
        }
        Optional<User> found = users.findUserByEmail(email);
        if (found.isEmpty()) {
            return error("User not found.");
        }
        User user = found.get();
        if (!Objects.equals(user.getResetToken(), otp)) {
            return error("Invalid OTP provided.");
        }
        if (isExpired(user.getResetTokenExpiry())) {
            return error("Your OTP has expired. Please sign up again or request a new one.");
        }

        LocalDateTime now = JsDates.nowUtc();
        requireUpdated(users.updateRoleByEmail(email, access.isSuperAdminEmail(email) ? Roles.SUPER_ADMIN : Roles.USER, now));
        requireUpdated(users.clearResetTokenByEmail(email, now));

        mail.sendSystemEmailAsync(email, AuthEmails.WELCOME_SUBJECT, AuthEmails.welcome(user.getName(), properties.appUrl()));

        return ActionResponse.redirect("/",
                sessions.login(new SessionUser(user.getId(), user.getEmail(), user.getName(), Roles.USER)));
    }

    // --------------------------------------------------------------------------------------------- signin

    public ActionResponse signin(String email, String password) {
        if (!truthy(email) || !truthy(password)) {
            return error("Please fill all fields");
        }

        Optional<User> found = users.findUserByEmail(email);
        // Support phone-based login (common for field executives)
        if (found.isEmpty()) {
            found = PhoneNumbers.signinPhoneCandidate(email).flatMap(users::findFirstByPhone);
        }
        if (found.isEmpty() || !passwords.matches(password, found.get().getPasswordHash())) {
            return error("Invalid email/phone or password");
        }
        User user = found.get();

        if (Roles.UNVERIFIED.equals(user.getRole())) {
            String otp = OneTimePasswords.generate();
            storeOtp(email, otp);
            try {
                Optional<Credentials> credentials = mail.credentials();
                if (credentials.isPresent()) {
                    mail.send(Channel.AUTH, credentials.get(), mail.fromOr("noreply@fonzkart.in"), email,
                            AuthEmails.VERIFY_SUBJECT, AuthEmails.resendOtp(otp));
                }
            } catch (Exception ignored) {
                // The original swallows OTP resend failures.
            }
            return ActionResponse.redirect("/verify-email?email=" + encodeURIComponent(email));
        }

        String role = user.getRole();
        if (access.isSuperAdminEmail(user.getEmail())) {
            role = Roles.SUPER_ADMIN;
            syncRole(user.getId(), role, "Failed to sync superadmin in DB:");
        } else if (access.isForcedUserEmail(user.getEmail())) {
            role = Roles.USER;
            syncRole(user.getId(), role, "Failed to demote forced-user account in DB:");
        }

        ResponseCookie cookie = sessions.login(new SessionUser(user.getId(), user.getEmail(), user.getName(), role));
        // Redirect privileged users to admin panel, normal users to homepage
        return ActionResponse.redirect(Roles.ADMIN_REDIRECT_ROLES.contains(role) ? "/admin" : "/", cookie);
    }

    // ------------------------------------------------------------------------------ requestPasswordReset

    public ActionResponse requestPasswordReset(String email) {
        if (!truthy(email)) {
            return error("Please enter your registered email address.");
        }
        if (users.findUserByEmail(email).isEmpty()) {
            return error("Invalid email. We could not verify ownership.");
        }
        try {
            String otp = OneTimePasswords.generate();
            storeOtp(email, otp);

            Optional<Credentials> credentials = mail.credentials();
            if (credentials.isEmpty()) {
                return error(NO_MAIL_ACCOUNT);
            }
            mail.send(Channel.AUTH, credentials.get(), mail.fromOr(credentials.get().user()), email,
                    AuthEmails.RESET_SUBJECT, AuthEmails.passwordResetOtp(otp));
            log.info("[MAIL SERVER] OTP successfully sent to {}", email);
        } catch (Exception e) {
            log.error("Email Sending Failed", e);
            return error("Email gateway failed: " + (e.getMessage() != null ? e.getMessage() : "Unknown error"));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", "OTP successfully sent to your registered email address.");
        result.put("email", email);
        result.put("step", "verify");
        return ActionResponse.returned(result);
    }

    // ---------------------------------------------------------------------------- verifyAndResetPassword

    public ActionResponse verifyAndResetPassword(String email, String otp, String password) {
        if (!truthy(email) || !truthy(otp) || !truthy(password)) {
            return error("Please fill all fields.");
        }
        Optional<User> found = users.findUserByEmail(email);
        if (found.isEmpty()) {
            return error("Invalid user.");
        }
        if (!Objects.equals(found.get().getResetToken(), otp)) {
            return error("Invalid OTP provided.");
        }
        if (isExpired(found.get().getResetTokenExpiry())) {
            return error("Your OTP has expired. Please request a new one.");
        }

        String passwordHash = passwords.hash(password);
        LocalDateTime now = JsDates.nowUtc();
        requireUpdated(users.updatePasswordByEmail(email, passwordHash, now));
        requireUpdated(users.clearResetTokenByEmail(email, now));

        return ActionResponse.returned(Map.of("success", "Password reset successfully! You can now login."));
    }

    // ------------------------------------------------------------------------- inlineAuth: quickRegister

    public ActionResponse quickRegister(String name, String email, String phone, String password) {
        if (!truthy(email) || !truthy(password) || !truthy(name)) {
            return error("Please fill name, email and password");
        }
        if (users.findUserByEmail(email).isPresent()) {
            return error("Email already registered. Please sign in instead.");
        }

        String id = UUID.randomUUID().toString();
        String passwordHash = passwords.hash(password);

        if (truthy(phone) && users.findByPhone(phone).isPresent()) {
            return error("Phone number already registered");
        }

        Optional<ActionResponse> createError = createUser(id, name, email, truthy(phone) ? phone : null, passwordHash,
                Roles.USER);
        if (createError.isPresent()) {
            return createError.get();
        }

        ResponseCookie cookie = sessions.login(new SessionUser(id, email, name, Roles.USER));
        return ActionResponse.returned(success(userInfo(id, email, name, Roles.USER, phone)), cookie);
    }

    // ---------------------------------------------------------------------------- inlineAuth: quickLogin

    public ActionResponse quickLogin(String email, String password) {
        if (!truthy(email) || !truthy(password)) {
            return error("Please fill email and password");
        }
        Optional<User> found = users.findUserByEmail(email);
        if (found.isEmpty() || !passwords.matches(password, found.get().getPasswordHash())) {
            return error("Invalid email or password");
        }
        User user = found.get();
        ResponseCookie cookie = sessions.login(
                new SessionUser(user.getId(), user.getEmail(), user.getName(), user.getRole()));
        return ActionResponse.returned(
                success(userInfo(user.getId(), user.getEmail(), user.getName(), user.getRole(), user.getPhone())), cookie);
    }

    // ------------------------------------------------------------------------------------------- helpers

    /** db.addUser(...) with the original P2002 handling. Returns an error response, or empty on success. */
    private Optional<ActionResponse> createUser(String id, String name, String email, String phone,
                                                String passwordHash, String role) {
        try {
            users.saveAndFlush(User.newUser(id, name, email, phone, passwordHash, role, JsDates.nowUtc()));
            return Optional.empty();
        } catch (RuntimeException e) {
            if (Constraints.isUniqueViolation(e)) {
                return Optional.of(error("Phone number or email already registered"));
            }
            log.error("User registration failed", e);
            return Optional.of(error("An error occurred during registration"));
        }
    }

    /** db.setResetToken(email, otp, expiry) — keyed by the exact email typed; Prisma throws if no row matches. */
    private void storeOtp(String email, String otp) {
        LocalDateTime now = JsDates.nowUtc();
        requireUpdated(users.setResetTokenByEmail(email, otp, now.plus(OneTimePasswords.VALIDITY), now));
    }

    private void syncRole(String userId, String role, String failureMessage) {
        try {
            users.updateRoleById(userId, role, JsDates.nowUtc());
        } catch (RuntimeException e) {
            log.error(failureMessage, e);
        }
    }

    /** {@code !expiry || new Date() > expiry} */
    private static boolean isExpired(LocalDateTime expiry) {
        return expiry == null || JsDates.nowUtc().isAfter(expiry);
    }

    private static void requireUpdated(int rows) {
        if (rows == 0) {
            throw ActionException.recordNotFound();
        }
    }

    private static ActionResponse error(String message) {
        return ActionResponse.returned(Map.of("error", message));
    }

    private static Map<String, Object> success(Map<String, Object> user) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        m.put("user", user);
        return m;
    }

    private static Map<String, Object> userInfo(String id, String email, String name, String role, String phone) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("email", email);
        m.put("name", name);
        m.put("role", role);
        m.put("phone", phone);
        return m;
    }
}
