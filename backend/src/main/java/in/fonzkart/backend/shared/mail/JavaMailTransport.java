package in.fonzkart.backend.shared.mail;

import jakarta.mail.internet.MimeMessage;
import java.util.Properties;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

/**
 * SMTP transport equivalent to the nodemailer transports in the Next.js app:
 * authenticated, implicit TLS only when SMTP_SECURE=true, certificate checks disabled
 * ({@code tls: { rejectUnauthorized: false }} in the original).
 */
@Component
public class JavaMailTransport implements MailTransport {

    @Override
    public void send(SmtpTarget target, Message message) throws Exception {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(target.host());
        sender.setPort(target.port());
        sender.setUsername(target.username());
        sender.setPassword(target.password());
        sender.setDefaultEncoding("UTF-8");

        Properties props = sender.getJavaMailProperties();
        props.put("mail.smtp.auth", "true");
        if (target.secure()) {
            props.put("mail.smtp.ssl.enable", "true");
        } else {
            props.put("mail.smtp.starttls.enable", "true");
        }
        props.put("mail.smtp.ssl.trust", "*");
        props.put("mail.smtp.connectiontimeout", "30000");
        props.put("mail.smtp.timeout", "30000");
        props.put("mail.smtp.writetimeout", "30000");

        MimeMessage mime = sender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mime, "UTF-8");
        helper.setFrom(message.from());
        helper.setTo(message.to());
        helper.setSubject(message.subject());
        helper.setText(message.html(), true);
        sender.send(mime);
    }
}
