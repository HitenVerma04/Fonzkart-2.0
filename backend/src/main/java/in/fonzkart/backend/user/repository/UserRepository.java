package in.fonzkart.backend.user.repository;

import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.user.entity.User;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * User queries equivalent to the Prisma calls in lib/store.ts and actions/*.ts.
 * Each method is its own transaction, like each Prisma call in the original (no multi-step transactions).
 */
public interface UserRepository extends JpaRepository<User, String> {

    /**
     * lib/store.ts → db.findUserByEmail(): prisma.user.findFirst({ where: { email: { equals, mode: 'insensitive' } } }).
     * <p>
     * PRESERVED BEHAVIOUR (security finding): Prisma 5.21 generates {@code "email" ILIKE $1} WITHOUT escaping, so
     * '%' and '_' in the input act as wildcards and the first matching row is returned. Kept identical on purpose;
     * fixing it requires an explicit decision (see backend/README.md).
     */
    @Query(value = "SELECT * FROM \"User\" WHERE \"email\" ILIKE :email LIMIT 1", nativeQuery = true)
    Optional<User> findFirstByEmailInsensitive(@Param("email") String email);

    /** db.findUserByEmail(email): the input is trimmed and lower-cased first. */
    default Optional<User> findUserByEmail(String email) {
        return findFirstByEmailInsensitive(JsText.lower(JsText.trim(email)));
    }

    /** prisma.user.findFirst({ where: { phone } }) */
    @Query(value = "SELECT * FROM \"User\" WHERE \"phone\" = :phone LIMIT 1", nativeQuery = true)
    Optional<User> findFirstByPhone(@Param("phone") String phone);

    /** prisma.user.findUnique({ where: { phone } }) */
    Optional<User> findByPhone(String phone);

    List<User> findByRole(String role);

    List<User> findByRoleOrderByNameAsc(String role);

    List<User> findByRoleOrderByCreatedAtDesc(String role);

    List<User> findAllByOrderByCreatedAtDesc();

    List<User> findByManagerIdAndRole(String managerId, String role);

    List<User> findByManagerIdAndRoleOrderByNameAsc(String managerId, String role);

    /** A relationship manager's partners, by name. */
    List<User> findByRoleAndRelationshipManagerIdOrderByNameAsc(String role, String relationshipManagerId);

    @Query("SELECT u FROM User u WHERE u.role = :role AND (u.cityId IN :cityIds OR u.managerId = :managerId) ORDER BY u.name ASC")
    List<User> findPartnersForZonalHead(@Param("role") String role, @Param("cityIds") Collection<String> cityIds,
                                        @Param("managerId") String managerId);

    /** Same filter without ordering (app/admin/riders/page.tsx has no orderBy). */
    @Query("SELECT u FROM User u WHERE u.role = :role AND (u.cityId IN :cityIds OR u.managerId = :managerId)")
    List<User> findPartnersForZonalHeadUnordered(@Param("role") String role, @Param("cityIds") Collection<String> cityIds,
                                                 @Param("managerId") String managerId);

    /** include: { users: true } on cities */
    List<User> findByCityIdIn(Collection<String> cityIds);

    // ---- Updates keyed by the exact (case-sensitive) email, like prisma.user.update({ where: { email } }).
    // ---- They return the number of rows changed; 0 means Prisma would have thrown P2025.

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.role = :role, u.updatedAt = :now WHERE u.email = :email")
    int updateRoleByEmail(@Param("email") String email, @Param("role") String role, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.passwordHash = :hash, u.updatedAt = :now WHERE u.email = :email")
    int updatePasswordByEmail(@Param("email") String email, @Param("hash") String passwordHash,
                              @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.resetToken = :token, u.resetTokenExpiry = :expiry, u.updatedAt = :now WHERE u.email = :email")
    int setResetTokenByEmail(@Param("email") String email, @Param("token") String token,
                             @Param("expiry") LocalDateTime expiry, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.resetToken = NULL, u.resetTokenExpiry = NULL, u.updatedAt = :now WHERE u.email = :email")
    int clearResetTokenByEmail(@Param("email") String email, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.name = :name, u.phone = :phone, u.updatedAt = :now WHERE u.email = :email")
    int updateProfileByEmail(@Param("email") String email, @Param("name") String name, @Param("phone") String phone,
                             @Param("now") LocalDateTime now);

    // ---- Updates keyed by id, like prisma.user.update({ where: { id } }).

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.role = :role, u.updatedAt = :now WHERE u.id = :id")
    int updateRoleById(@Param("id") String id, @Param("role") String role, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.managerId = :managerId, u.updatedAt = :now WHERE u.id = :id")
    int updateManagerById(@Param("id") String id, @Param("managerId") String managerId, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.relationshipManagerId = :rmId, u.updatedAt = :now WHERE u.id = :id")
    int updateRelationshipManagerById(@Param("id") String id, @Param("rmId") String relationshipManagerId,
                                      @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.role = :role, u.managerId = :managerId, u.updatedAt = :now WHERE u.id = :id")
    int updateRoleAndManagerById(@Param("id") String id, @Param("role") String role,
                                 @Param("managerId") String managerId, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.role = :role, u.managerId = :managerId, u.cityId = :cityId, u.updatedAt = :now WHERE u.id = :id")
    int updateRoleManagerAndCityById(@Param("id") String id, @Param("role") String role,
                                     @Param("managerId") String managerId, @Param("cityId") String cityId,
                                     @Param("now") LocalDateTime now);

    /** app/admin/cities/actions.ts → updatePartnerPincodes */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.pincodes = :pincodes, u.updatedAt = :now WHERE u.id = :id")
    int updatePincodesById(@Param("id") String id, @Param("pincodes") String[] pincodes, @Param("now") LocalDateTime now);

    /** app/admin/cities/actions.ts → removePartnerFromCity: { cityId: null, pincodes: [] } */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.cityId = NULL, u.pincodes = :empty, u.updatedAt = :now WHERE u.id = :id")
    int clearCityAndPincodesById(@Param("id") String id, @Param("empty") String[] empty, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.cityId = :cityId, u.managerId = :managerId, u.updatedAt = :now WHERE u.id = :id")
    int updateCityAndManagerById(@Param("id") String id, @Param("cityId") String cityId,
                                 @Param("managerId") String managerId, @Param("now") LocalDateTime now);
}
