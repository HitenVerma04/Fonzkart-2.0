package in.fonzkart.backend.pincoderequest;

import in.fonzkart.backend.auth.session.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pincode requests. Partner app: {@code GET /mine}, {@code POST /} (ask), {@code DELETE /{id}} (cancel a pending
 * one). Admin app (admins, zonal heads for their partners): {@code GET /?status=pending|decided},
 * {@code POST /{id}/approve} (all or some pincodes), {@code POST /{id}/reject}.
 */
@RestController
@RequestMapping("/api/pincode-requests")
public class PincodeRequestController {

    public record AskRequest(List<String> pincodes, String note) {
    }

    public record ReviewRequest(List<String> pincodes, String note) {
    }

    private final PincodeRequestService service;
    private final SessionService sessions;

    public PincodeRequestController(PincodeRequestService service, SessionService sessions) {
        this.service = service;
        this.sessions = sessions;
    }

    @GetMapping("/mine")
    public Map<String, Object> mine(HttpServletRequest request) {
        return service.mine(sessions.getSession(request));
    }

    @PostMapping
    public Map<String, Object> ask(HttpServletRequest request, @RequestBody(required = false) AskRequest r) {
        return service.create(sessions.getSession(request), r == null ? null : r.pincodes(), r == null ? null : r.note());
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> cancel(HttpServletRequest request, @PathVariable String id) {
        return service.cancel(sessions.getSession(request), id);
    }

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest request,
                                          @RequestParam(defaultValue = "pending") String status) {
        return service.list(sessions.getSession(request), !"decided".equals(status));
    }

    @PostMapping("/{id}/approve")
    public Map<String, Object> approve(HttpServletRequest request, @PathVariable String id,
                                       @RequestBody(required = false) ReviewRequest r) {
        return service.approve(sessions.getSession(request), id, r == null ? null : r.pincodes(), r == null ? null : r.note());
    }

    @PostMapping("/{id}/reject")
    public Map<String, Object> reject(HttpServletRequest request, @PathVariable String id,
                                      @RequestBody(required = false) ReviewRequest r) {
        return service.reject(sessions.getSession(request), id, r == null ? null : r.note());
    }
}
