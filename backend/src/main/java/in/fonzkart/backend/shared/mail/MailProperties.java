package in.fonzkart.backend.shared.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * SMTP settings read from the same environment variables as the Next.js app
 * (SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD / SMTP_PASS, SMTP_FROM).
 *
 * @param fallbackHost used when SMTP_HOST is unset; replaces the IP address hard-coded in the original
 */
@ConfigurationProperties(prefix = "fonzkart.mail")
public record MailProperties(String host, String fallbackHost, String port, boolean secure, String user,
                             String password, String pass, String from) {
}
