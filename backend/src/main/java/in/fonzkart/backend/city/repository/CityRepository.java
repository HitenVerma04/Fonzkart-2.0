package in.fonzkart.backend.city.repository;

import in.fonzkart.backend.city.entity.City;
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
 * "City" queries equivalent to the Prisma calls in app/admin/cities, app/admin/zonal-heads, app/admin/homepage,
 * app/page.tsx, actions/admin.ts and actions/orders.ts. Each write is a single statement (like each Prisma call),
 * sets updatedAt and returns the affected row count (0 = Prisma would have thrown P2025).
 */
public interface CityRepository extends JpaRepository<City, String> {

    Optional<City> findByName(String name);

    List<City> findByManagerId(String managerId);

    List<City> findByIsActiveTrueOrderByNameAsc();

    List<City> findByIsActiveTrueAndIdInOrderByNameAsc(Collection<String> ids);

    List<City> findAllByOrderByNameAsc();

    List<City> findByIdOrderByNameAsc(String id);

    /** orderBy: [{ isFeatured: 'desc' }, { displayOrder: 'asc' }, { name: 'asc' }], where isActive */
    List<City> findByIsActiveTrueOrderByIsFeaturedDescDisplayOrderAscNameAsc();

    /** prisma.city.findFirst({ where: { isActive: true, pincodes: { has: pincode } } }) */
    @Query(value = "SELECT EXISTS (SELECT 1 FROM \"City\" WHERE \"isActive\" = true AND :pincode = ANY(\"pincodes\"))",
            nativeQuery = true)
    boolean existsActiveWithPincode(@Param("pincode") String pincode);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE City c SET c.pincodes = :pincodes, c.updatedAt = :now WHERE c.id = :id")
    int updatePincodes(@Param("id") String id, @Param("pincodes") String[] pincodes, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE City c SET c.isActive = :active, c.updatedAt = :now WHERE c.id = :id")
    int updateActive(@Param("id") String id, @Param("active") boolean active, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE City c SET c.isActive = true, c.updatedAt = :now WHERE c.name = :name")
    int activateByName(@Param("name") String name, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE City c SET c.isFeatured = :featured, c.updatedAt = :now WHERE c.id = :id")
    int updateFeatured(@Param("id") String id, @Param("featured") boolean featured, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE City c SET c.displayOrder = :order, c.updatedAt = :now WHERE c.id = :id")
    int updateDisplayOrder(@Param("id") String id, @Param("order") int order, @Param("now") LocalDateTime now);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE City c SET c.managerId = :managerId, c.updatedAt = :now WHERE c.id = :id")
    int updateManager(@Param("id") String id, @Param("managerId") String managerId, @Param("now") LocalDateTime now);
}
