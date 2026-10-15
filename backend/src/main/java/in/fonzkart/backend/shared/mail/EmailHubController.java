package in.fonzkart.backend.shared.mail;

import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.shared.mail.EmailHubService.EmailSummary;
import in.fonzkart.backend.shared.web.ActionException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The staff email system (EmailHubService): stored messages by mailbox, one message, the mailbox list, sending. */
@RestController
@RequestMapping("/api/email")
public class EmailHubController {

    public record SendRequest(String fromAccount, String to, String subject, String text) {
    }

    private final EmailHubService hub;
    private final SessionService sessions;

    public EmailHubController(EmailHubService hub, SessionService sessions) {
        this.hub = hub;
        this.sessions = sessions;
    }

    @GetMapping("/messages")
    public Map<String, Object> messages(HttpServletRequest request, @RequestParam(required = false) String account) {
        return hub.messages(sessions.getSession(request), account);
    }

    @GetMapping("/messages/{id}")
    public EmailSummary message(HttpServletRequest request, @PathVariable String id) {
        return hub.message(sessions.getSession(request), id).orElseThrow(ActionException::notFound);
    }

    @GetMapping("/accounts")
    public List<Map<String, Object>> accounts(HttpServletRequest request) {
        return hub.accounts(sessions.getSession(request));
    }

    @PostMapping("/send")
    public Map<String, Object> send(HttpServletRequest request, @RequestBody(required = false) SendRequest r) {
        r = r == null ? new SendRequest(null, null, null, null) : r;
        return hub.send(sessions.getSession(request), r.fromAccount(), r.to(), r.subject(), r.text());
    }
}
