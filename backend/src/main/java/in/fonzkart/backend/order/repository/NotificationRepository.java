package in.fonzkart.backend.order.repository;

import in.fonzkart.backend.order.entity.Notification;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * Notification queries of actions/notifications.ts. A staff member receives notifications addressed to them
 * (userId), to their role (role) and system-wide ones (no userId, role or riderId); executives only their own
 * (riderId); customers only their own (userId).
 */
public interface NotificationRepository extends JpaRepository<Notification, String> {

    String ADDRESSED_TO_STAFF = "(n.userId = :userId OR n.role = :role OR (n.userId IS NULL AND n.role IS NULL AND n.riderId IS NULL))";

    @Query("SELECT n FROM Notification n WHERE " + ADDRESSED_TO_STAFF + " ORDER BY n.createdAt DESC")
    List<Notification> findForStaff(@Param("userId") String userId, @Param("role") String role, Pageable page);

    @Query("SELECT n FROM Notification n WHERE n.userId = :userId ORDER BY n.createdAt DESC")
    List<Notification> findForUser(@Param("userId") String userId, Pageable page);

    @Query("SELECT n FROM Notification n WHERE n.riderId = :riderId ORDER BY n.createdAt DESC")
    List<Notification> findForRider(@Param("riderId") String riderId, Pageable page);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.id = :id AND " + ADDRESSED_TO_STAFF)
    int markReadForStaff(@Param("id") String id, @Param("userId") String userId, @Param("role") String role);

    /** Only the caller's own and role notifications; shared system-wide ones stay as they are. */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Notification n SET n.isRead = true WHERE (n.userId = :userId OR n.role = :role) AND n.isRead = false")
    int markAllReadForStaff(@Param("userId") String userId, @Param("role") String role);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.id = :id AND n.userId = :userId")
    int markReadForUser(@Param("id") String id, @Param("userId") String userId);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.userId = :userId AND n.isRead = false")
    int markAllReadForUser(@Param("userId") String userId);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.id = :id AND n.riderId = :riderId")
    int markReadForRider(@Param("id") String id, @Param("riderId") String riderId);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.riderId = :riderId AND n.isRead = false")
    int markAllReadForRider(@Param("riderId") String riderId);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM Notification n WHERE n.userId = :userId")
    int deleteByUserId(@Param("userId") String userId);
}
