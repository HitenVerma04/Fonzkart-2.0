package in.fonzkart.backend.shared.mail;

import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.rules.StaffAccess.Staff;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

/**
 * The email system for staff (actions/email-hub.ts, app/api/email/*): the stored messages of the mailboxes a staff
 * member may use, and sending from one of them. Who may use which mailbox follows the website's rule (and its security
 * fix, lib/mail-admin.ts): administrators all; a zonal head their own, their cities' partners' and those partners'
 * executives' (phone@fonzkart.in); a partner their own and their executives'; anyone else their own address.
 * <p>
 * Not part of the backend: creating or deleting mailboxes on the mail server (the website does that over SSH, for
 * administrators, only where MAILSERVER_SSH_HOST is set) and reading the mail server over IMAP.
 */
@Service
public class EmailHubService {

    public static final String FORBIDDEN_MAILBOX = "Forbidden: Not your mailbox";
    private static final Logger log = LoggerFactory.getLogger(EmailHubService.class);

    public record EmailSummary(String id, String subject, String fromEmail, String toEmail, String date, String text,
                               String snippet, boolean isOutbound, String bodyHtml) {
    }

    public record Access(Staff staff, boolean all, List<String> emails) {
    }

    private final StaffAccess staffAccess;
    private final JdbcTemplate jdbc;
    private final MailTransport transport;
    private final MailProperties mail;

    public EmailHubService(StaffAccess staffAccess, JdbcTemplate jdbc, MailTransport transport, MailProperties mail) {
        this.staffAccess = staffAccess;
        this.jdbc = jdbc;
        this.transport = transport;
        this.mail = mail;
    }

    public Access access(Optional<SessionPayload> session) {
        Staff staff = staffAccess.current(session).orElseThrow(ActionException::unauthorized);
        if (staff.isAdmin()) {
            return new Access(staff, true, jdbc.queryForList("SELECT email FROM \"EmailAccount\"", String.class));
        }
        List<String> emails = new ArrayList<>();
        emails.add(staff.user().getEmail());
        if (staff.isZonalHead()) {
            List<String> partnerIds = jdbc.queryForList("SELECT u.id FROM \"User\" u JOIN \"City\" c ON c.id = u.\"cityId\" "
                    + "WHERE c.\"managerId\" = ? AND u.role = 'PARTNER'", String.class, staff.id());
            for (String partnerId : partnerIds) {
                emails.addAll(jdbc.queryForList("SELECT email FROM \"User\" WHERE id = ?", String.class, partnerId));
                jdbc.queryForList("SELECT phone FROM \"Rider\" WHERE \"partnerId\" = ?", String.class, partnerId)
                        .forEach(phone -> emails.add(phone + "@fonzkart.in"));
            }
        } else if (staff.isPartner()) {
            jdbc.queryForList("SELECT phone FROM \"Rider\" WHERE \"partnerId\" = ?", String.class, staff.id())
                    .forEach(phone -> emails.add(phone + "@fonzkart.in"));
        }
        return new Access(staff, false, emails);
    }

    /** fetchRoleBasedEmails(account?) without the IMAP sync: the latest 300 stored messages the caller may see. */
    public Map<String, Object> messages(Optional<SessionPayload> session, String account) {
        Access access = access(session);
        String where;
        List<Object> args = new ArrayList<>();
        if (JsText.truthy(account)) {
            if (!access.all() && !access.emails().contains(account)) {
                throw ActionException.forbidden(FORBIDDEN_MAILBOX);
            }
            where = "WHERE \"from\" = ? OR \"to\" = ?";
            args.add(account);
            args.add(account);
        } else if (!access.all()) {
            if (access.emails().isEmpty()) {
                where = "WHERE false";
            } else {
                String marks = String.join(",", access.emails().stream().map(e -> "?").toList());
                where = "WHERE \"from\" IN (" + marks + ") OR \"to\" IN (" + marks + ")";
                args.addAll(access.emails());
                args.addAll(access.emails());
            }
        } else {
            where = "";
        }
        List<EmailSummary> emails = jdbc.query("SELECT id, subject, \"from\", \"to\", \"receivedAt\", \"bodyText\", \"bodySnippet\", "
                + "\"isOutbound\", \"bodyHtml\" FROM \"EmailMessage\" " + where + " ORDER BY \"receivedAt\" DESC LIMIT 300",
                (rs, i) -> new EmailSummary(rs.getString(1), JsText.truthy(rs.getString(2)) ? rs.getString(2) : "No Subject",
                        rs.getString(3), rs.getString(4), JsDates.toIsoString(rs.getObject(5, LocalDateTime.class)),
                        rs.getString(6) == null ? "" : rs.getString(6), rs.getString(7) == null ? "" : rs.getString(7),
                        rs.getBoolean(8), rs.getString(9)), args.toArray());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("emails", emails);
        m.put("totalInDb", jdbc.queryForObject("SELECT count(*) FROM \"EmailMessage\"", Integer.class));
        m.put("totalAccounts", access.emails().size());
        m.put("userRole", access.staff().role());
        m.put("userEmail", access.staff().user().getEmail());
        m.put("reachableEmails", access.emails());
        return m;
    }

    /** fetchEmailById(id): only a message from or to a mailbox the caller may use. */
    public Optional<EmailSummary> message(Optional<SessionPayload> session, String id) {
        Access access = access(session);
        return jdbc.query("SELECT id, subject, \"from\", \"to\", \"receivedAt\", \"bodyText\", \"bodySnippet\", \"isOutbound\", \"bodyHtml\" "
                        + "FROM \"EmailMessage\" WHERE id = ?",
                (rs, i) -> new EmailSummary(rs.getString(1), JsText.truthy(rs.getString(2)) ? rs.getString(2) : "No Subject",
                        rs.getString(3), rs.getString(4), JsDates.toIsoString(rs.getObject(5, LocalDateTime.class)),
                        rs.getString(6) == null ? "" : rs.getString(6), rs.getString(7) == null ? "" : rs.getString(7),
                        rs.getBoolean(8), rs.getString(9)), id)
                .stream()
                .filter(m -> access.all() || access.emails().contains(m.fromEmail()) || access.emails().contains(m.toEmail()))
                .findFirst();
    }

    /** The mailboxes, for administrators (GET /api/email/account; never the passwords). */
    public List<Map<String, Object>> accounts(Optional<SessionPayload> session) {
        staffAccess.requireRole(session, StaffAccess.ADMINS);
        return jdbc.query("SELECT email, \"createdAt\" FROM \"EmailAccount\" ORDER BY \"createdAt\" DESC", (rs, i) -> {
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("email", rs.getString(1));
            a.put("createdAt", JsDates.toIsoString(rs.getObject(2, LocalDateTime.class)));
            return a;
        });
    }

    /**
     * POST /api/email/send: from one of the caller's mailboxes, with that mailbox's own credentials, through SMTP_HOST
     * (there is no fallback to a fixed server address). The sent message is kept in "EmailMessage".
     */
    public Map<String, Object> send(Optional<SessionPayload> session, String fromAccount, String to, String subject, String text) {
        if (!JsText.truthy(fromAccount) || !JsText.truthy(to) || !JsText.truthy(subject) || !JsText.truthy(text)) {
            throw new ActionException(HttpStatus.BAD_REQUEST, "Missing required fields");
        }
        Access access = access(session);
        if (!access.all() && !access.emails().contains(fromAccount)) {
            throw ActionException.forbidden(FORBIDDEN_MAILBOX);
        }
        List<String> passwords = jdbc.queryForList("SELECT password FROM \"EmailAccount\" WHERE email = ?", String.class, fromAccount);
        if (passwords.isEmpty()) {
            throw new ActionException(HttpStatus.NOT_FOUND, "Account not found");
        }
        if (!JsText.truthy(mail.host())) {
            throw new ActionException(HttpStatus.SERVICE_UNAVAILABLE, "Sending is not set up on this server (SMTP_HOST)");
        }
        int port = JsText.truthy(mail.port()) ? Integer.parseInt(mail.port().trim()) : 587;
        String html = "<div style=\"white-space: pre-wrap\">" + HtmlUtils.htmlEscape(text) + "</div>";
        try {
            transport.send(new MailTransport.SmtpTarget(mail.host(), port, mail.secure(), fromAccount, passwords.get(0)),
                    new MailTransport.Message(fromAccount, to, subject, html));
        } catch (Exception e) {
            log.warn("Email hub send failed from {}: {}", fromAccount, e.getMessage());
            throw new ActionException(HttpStatus.BAD_GATEWAY, "The mail server did not accept the message");
        }
        String id = Cuid.next();
        LocalDateTime now = JsDates.nowUtc();
        jdbc.update("INSERT INTO \"EmailMessage\" (id, \"messageId\", \"from\", \"to\", subject, \"bodyText\", \"isOutbound\", status, "
                + "\"receivedAt\", \"createdAt\", \"updatedAt\") VALUES (?, ?, ?, ?, ?, ?, true, 'delivered', ?, ?, ?)",
                id, "<" + id + "@fonzkart.in>", fromAccount, to, subject, text, now, now, now);
        return Map.of("success", true, "messageId", "<" + id + "@fonzkart.in>");
    }
}
