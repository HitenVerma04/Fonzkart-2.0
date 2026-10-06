package in.fonzkart.backend.auth.api;

import in.fonzkart.backend.shared.web.ActionResponse;
import in.fonzkart.backend.shared.web.MobileClients;
import in.fonzkart.backend.auth.service.AuthService;
import in.fonzkart.backend.auth.session.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authentication endpoints, one per original server action (actions/auth.ts, actions/inlineAuth.ts, lib/session.ts).
 * <p>
 * Contract: HTTP 200 means the action completed. The body is what the original returned (form errors such as
 * {@code {"error": "Invalid email/phone or password"}} included), or {@code {"redirectTo": url}} where the original
 * called redirect(). Session cookies are set/cleared with Set-Cookie exactly as Next.js does; the phone apps
 * ({@code X-Client: mobile}) get the session token in {@code X-Auth-Token} instead ({@link MobileClients}).
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record SigninRequest(String email, String password) {
    }

    public record SignupRequest(String name, String email, String phone, String password) {
    }

    public record VerifyEmailRequest(String email, String otp) {
    }

    public record PasswordResetRequest(String email) {
    }

    public record PasswordResetConfirmRequest(String email, String otp, String password) {
    }

    private final AuthService auth;
    private final SessionService sessions;

    public AuthController(AuthService auth, SessionService sessions) {
        this.auth = auth;
        this.sessions = sessions;
    }

    /** actions/auth.ts → signin */
    @PostMapping("/signin")
    public ResponseEntity<Object> signin(@RequestBody(required = false) SigninRequest r,
            HttpServletRequest request) {
        r = r == null ? new SigninRequest(null, null) : r;
        return toResponse(auth.signin(r.email(), r.password()), request);
    }

    /** actions/auth.ts → signup */
    @PostMapping("/signup")
    public ResponseEntity<Object> signup(@RequestBody(required = false) SignupRequest r,
            HttpServletRequest request) {
        r = r == null ? new SignupRequest(null, null, null, null) : r;
        return toResponse(auth.signup(r.name(), r.email(), r.phone(), r.password()), request);
    }

    /** actions/auth.ts → verifyEmailSignup */
    @PostMapping("/verify-email")
    public ResponseEntity<Object> verifyEmail(@RequestBody(required = false) VerifyEmailRequest r,
            HttpServletRequest request) {
        r = r == null ? new VerifyEmailRequest(null, null) : r;
        return toResponse(auth.verifyEmailSignup(r.email(), r.otp()), request);
    }

    /** actions/auth.ts → requestPasswordReset */
    @PostMapping("/password-reset/request")
    public ResponseEntity<Object> requestPasswordReset(@RequestBody(required = false) PasswordResetRequest r,
            HttpServletRequest request) {
        return toResponse(auth.requestPasswordReset(r == null ? null : r.email()), request);
    }

    /** actions/auth.ts → verifyAndResetPassword */
    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Object> verifyAndResetPassword(@RequestBody(required = false) PasswordResetConfirmRequest r,
            HttpServletRequest request) {
        r = r == null ? new PasswordResetConfirmRequest(null, null, null) : r;
        return toResponse(auth.verifyAndResetPassword(r.email(), r.otp(), r.password()), request);
    }

    /** actions/inlineAuth.ts → quickRegister */
    @PostMapping("/quick-register")
    public ResponseEntity<Object> quickRegister(@RequestBody(required = false) SignupRequest r,
            HttpServletRequest request) {
        r = r == null ? new SignupRequest(null, null, null, null) : r;
        return toResponse(auth.quickRegister(r.name(), r.email(), r.phone(), r.password()), request);
    }

    /** actions/inlineAuth.ts → quickLogin */
    @PostMapping("/quick-login")
    public ResponseEntity<Object> quickLogin(@RequestBody(required = false) SigninRequest r,
            HttpServletRequest request) {
        r = r == null ? new SigninRequest(null, null) : r;
        return toResponse(auth.quickLogin(r.email(), r.password()), request);
    }

    /** lib/session.ts → logout */
    @PostMapping("/logout")
    public ResponseEntity<Object> logout() {
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, sessions.logout().toString()).build();
    }

    /** lib/session.ts → getSession(): {@code {"session": payload | null}} */
    @GetMapping("/session")
    public Map<String, Object> session(HttpServletRequest request) {
        Map<String, Object> body = new HashMap<>();
        body.put("session", sessions.getSession(request).orElse(null));
        return Collections.unmodifiableMap(body);
    }

    private static ResponseEntity<Object> toResponse(ActionResponse result, HttpServletRequest request) {
        return result.toResponseEntity(MobileClients.isMobile(request));
    }
}
