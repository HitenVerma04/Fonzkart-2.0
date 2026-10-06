package in.fonzkart.backend.rider.repository;

import in.fonzkart.backend.rider.entity.Rider;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** "Rider" queries equivalent to the Prisma calls in actions/admin.ts, actions/executive.ts and the admin pages. */
public interface RiderRepository extends JpaRepository<Rider, String> {

    /** db.getRiders().find(r => r.phone === phone) / prisma.rider.findFirst({ where: { phone } }) */
    @Query(value = "SELECT * FROM \"Rider\" WHERE \"phone\" = :phone LIMIT 1", nativeQuery = true)
    Optional<Rider> findFirstByPhone(@Param("phone") String phone);

    List<Rider> findAllByOrderByCreatedAtDesc();

    List<Rider> findByPartnerIdInOrderByCreatedAtDesc(Collection<String> partnerIds);

    List<Rider> findByPartnerIdOrderByCreatedAtDesc(String partnerId);

    List<Rider> findByPartnerId(String partnerId);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Rider r SET r.partnerId = :partnerId, r.updatedAt = :now WHERE r.id = :id")
    int updatePartner(@Param("id") String id, @Param("partnerId") String partnerId, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Rider r SET r.password = :password, r.updatedAt = :now WHERE r.id = :id")
    int updatePassword(@Param("id") String id, @Param("password") String password, @Param("now") LocalDateTime now);

    /** prisma.rider.delete({ where: { id } }); orders keep existing with riderId = NULL (FK ON DELETE SET NULL). */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM Rider r WHERE r.id = :id")
    int deleteRiderById(@Param("id") String id);
}
