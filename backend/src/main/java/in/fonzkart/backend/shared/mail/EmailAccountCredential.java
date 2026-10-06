package in.fonzkart.backend.shared.mail;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.Immutable;

/**
 * Read-only view of the existing Prisma table {@code "EmailAccount"}. The original code falls back to the first
 * mailbox's credentials when SMTP_USER / SMTP_PASSWORD are not set. The email hub itself is a later migration.
 */
@Entity
@Immutable
@Table(name = "EmailAccount")
public class EmailAccountCredential {

    @Id
    private String id;

    private String email;

    private String password;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected EmailAccountCredential() {
    }

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }
}
