package in.fonzkart.backend.shared.mail;

import static in.fonzkart.backend.shared.text.JsText.truthy;

import java.util.Optional;
import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

/**
 * Email sending as done by the Next.js app. Two variants exist in the original and are kept distinct:
 * <ul>
 *   <li>{@link Channel#AUTH} — the inline nodemailer transports in actions/auth.ts (OTP emails):
 *       default port 587; SMTP_HOST "10.0.5.2" is treated as unset.</li>
 *   <li>{@link Channel#SYSTEM} — lib/email.ts → sendSystemEmail(): default port 25; never throws.</li>
 * </ul>
 * Credentials: SMTP_USER / SMTP_PASSWORD (or SMTP_PASS), else the first row of "EmailAccount".
 */
@Service
public class MailService {

    public enum Channel {
        AUTH(587, true),
        SYSTEM(25, false);

        final int defaultPort;
        final boolean ignoresInternalHost;

        Channel(int defaultPort, boolean ignoresInternalHost) {
            this.defaultPort = defaultPort;
            this.ignoresInternalHost = ignoresInternalHost;
        }
    }

    public record Credentials(String user, String password) {
    }

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final MailProperties properties;
    private final EmailAccountCredentialRepository accounts;
    private final MailTransport transport;
    private final Executor executor;

    public MailService(MailProperties properties, EmailAccountCredentialRepository accounts, MailTransport transport,
                       @Qualifier("mailExecutor") Executor executor) {
        this.properties = properties;
        this.accounts = accounts;
        this.transport = transport;
        this.executor = executor;
    }

    /** smtpUser = SMTP_USER || account.email; smtpPass = SMTP_PASSWORD || SMTP_PASS || account.password (both required). */
    public Optional<Credentials> credentials() {
        EmailAccountCredential account = null;
        if (!truthy(properties.user()) || (!truthy(properties.password()) && !truthy(properties.pass()))) {
            account = accounts.findFirstAccount().orElse(null);
        }
        String user = truthy(properties.user()) ? properties.user() : account == null ? null : account.getEmail();
        String pass = truthy(properties.password()) ? properties.password()
                : truthy(properties.pass()) ? properties.pass()
                : account == null ? null : account.getPassword();
        return truthy(user) && truthy(pass) ? Optional.of(new Credentials(user, pass)) : Optional.empty();
    }

    /** SMTP_FROM || fallback */
    public String fromOr(String fallback) {
        return truthy(properties.from()) ? properties.from() : fallback;
    }

    /** Sends synchronously; throws on any failure (callers decide whether to swallow it, like the original). */
    public void send(Channel channel, Credentials credentials, String from, String to, String subject, String html)
            throws Exception {
        transport.send(target(channel, credentials), new MailTransport.Message(from, to, subject, html));
    }

    /** lib/email.ts → sendSystemEmail(to, subject, html): returns false instead of throwing. */
    public boolean sendSystemEmail(String to, String subject, String html) {
        try {
            Optional<Credentials> credentials = credentials();
            if (credentials.isEmpty()) {
                log.error("No system email accounts exist.");
                return false;
            }
            send(Channel.SYSTEM, credentials.get(), fromOr(credentials.get().user()), to, subject, html);
            log.info("[SYSTEM EMAIL] Successfully sent email to {}", to);
            return true;
        } catch (Exception e) {
            log.error("[SYSTEM EMAIL] Failed to send email to {}", to, e);
            return false;
        }
    }

    /** sendSystemEmail(...) without awaiting the result (the original does not await these calls). */
    public void sendSystemEmailAsync(String to, String subject, String html) {
        executor.execute(() -> sendSystemEmail(to, subject, html));
    }

    private MailTransport.SmtpTarget target(Channel channel, Credentials credentials) {
        String host = properties.host();
        if (!truthy(host) || (channel.ignoresInternalHost && "10.0.5.2".equals(host))) {
            host = properties.fallbackHost();
        }
        if (!truthy(host)) {
            throw new IllegalStateException("SMTP host is not configured (set SMTP_HOST)");
        }
        int port = truthy(properties.port()) ? Integer.parseInt(properties.port().trim()) : channel.defaultPort;
        return new MailTransport.SmtpTarget(host, port, properties.secure(), credentials.user(), credentials.password());
    }
}
