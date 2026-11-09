package in.fonzkart.backend.push;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface PushTokenRepository extends JpaRepository<PushToken, String> {

    List<PushToken> findByUserIdIn(Collection<String> userIds);

    List<PushToken> findByRiderId(String riderId);

    @Modifying
    @Transactional
    @Query("delete from PushToken p where p.token in :tokens")
    int deleteTokens(@Param("tokens") Collection<String> tokens);
}
