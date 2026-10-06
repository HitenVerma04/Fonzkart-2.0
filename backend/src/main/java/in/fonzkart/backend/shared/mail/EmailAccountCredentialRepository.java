package in.fonzkart.backend.shared.mail;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

@Transactional(readOnly = true)
public interface EmailAccountCredentialRepository extends JpaRepository<EmailAccountCredential, String> {

    /** prisma.emailAccount.findFirst() */
    @Query(value = "SELECT * FROM \"EmailAccount\" LIMIT 1", nativeQuery = true)
    Optional<EmailAccountCredential> findFirstAccount();
}
