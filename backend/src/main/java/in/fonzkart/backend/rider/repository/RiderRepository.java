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

    /**
     * Executive phone login: the rider with the same number however it was saved ("+919876543210", "9876543210",
     * "98765 43210"; the website's form saves 10 digits, the apps "+91…"), compared on the last 10 digits.
     * If several match: the exact spelling first, then one that already has a password, then the oldest.
     */
    @Query(value = "SELECT * FROM \"Rider\" WHERE right(regexp_replace(coalesce(\"phone\", ''), '[^0-9]', '', 'g'), 10) = :digits "
            + "ORDER BY (\"phone\" = :phone) DESC, (coalesce(\"password\", '') <> '') DESC, \"createdAt\" ASC LIMIT 1",
            nativeQuery = true)
    Optional<Rider> findFirstBySameNumber(@Param("digits") String lastTenDigits, @Param("phone") String phone);

    /** The number's last 10 digits (an Indian mobile number without +91 / 0), or null when it has fewer. */
    static String lastTenDigits(String phone) {
        String digits = phone == null ? "" : phone.replaceAll("[^0-9]", "");
        return digits.length() < 10 ? null : digits.substring(digits.length() - 10);
    }

    List<Rider> findAllByOrderByCreatedAtDesc();

    List<Rider> findByPartnerIdInOrderByCreatedAtDesc(Collection<String> partnerIds);

    List<Rider> findByPartnerIdOrderByCreatedAtDesc(String partnerId);

    List<Rider> findByPartnerId(String partnerId);

    /** app/admin/orders/page.tsx: findMany({ (where: { partnerId: { in } },) orderBy: { name: 'asc' } }) */
    List<Rider> findAllByOrderByNameAsc();

    List<Rider> findByPartnerIdInOrderByNameAsc(Collection<String> partnerIds);

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
