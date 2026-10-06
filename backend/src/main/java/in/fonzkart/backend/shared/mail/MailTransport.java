package in.fonzkart.backend.shared.mail;

/** Sends one message over SMTP. Replaced by a recording implementation in tests. */
public interface MailTransport {

    /**
     * @param host     SMTP host
     * @param port     SMTP port
     * @param secure   implicit TLS (SMTP_SECURE=true); otherwise plain with opportunistic STARTTLS
     * @param username SMTP user
     * @param password SMTP password
     */
    record SmtpTarget(String host, int port, boolean secure, String username, String password) {
    }

    record Message(String from, String to, String subject, String html) {
    }

    void send(SmtpTarget target, Message message) throws Exception;
}
