package in.fonzkart.backend.rider.api;

import in.fonzkart.backend.rider.dto.RiderDto;
import in.fonzkart.backend.rider.service.ExecutiveAuthService;
import in.fonzkart.backend.shared.web.MobileClients;
import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Field-executive phone login (actions/executive.ts): public endpoints; identity comes from the signed executive_id
 * cookie, or for the Partner app ({@code X-Client: mobile}) the same token in X-Auth-Token / Authorization: Bearer.
 */
@RestController
@RequestMapping("/api/executive")
public class ExecutiveController {

    public record LoginRequest(String phone, String password) {
    }

    public record OnboardRequest(String id, String password) {
    }

    private final ExecutiveAuthService executives;

    public ExecutiveController(ExecutiveAuthService executives) {
        this.executives = executives;
    }

    /** loginExecutive(phone, password?) */
    @PostMapping("/login")
    public ResponseEntity<Object> login(@RequestBody(required = false) LoginRequest r,
            HttpServletRequest request) {
        r = r == null ? new LoginRequest(null, null) : r;
        return executives.login(r.phone(), r.password()).toResponseEntity(MobileClients.isMobile(request));
    }

    /** onboardExecutive(id, password) */
    @PostMapping("/onboard")
    public ResponseEntity<Object> onboard(@RequestBody(required = false) OnboardRequest r,
            HttpServletRequest request) {
        r = r == null ? new OnboardRequest(null, null) : r;
        return executives.onboard(r.id(), r.password()).toResponseEntity(MobileClients.isMobile(request));
    }

    /** logoutExecutive() */
    @PostMapping("/logout")
    public ResponseEntity<Object> logout(HttpServletRequest request) {
        return executives.logout().toResponseEntity(MobileClients.isMobile(request));
    }

    /** getExecutiveSession(): {@code {"executive": rider | null}} */
    @GetMapping("/session")
    public Map<String, Object> session(HttpServletRequest request) {
        Map<String, Object> body = new HashMap<>();
        body.put("executive", executives.currentExecutive(request).map(RiderDto::from).orElse(null));
        return body;
    }
}
