package in.fonzkart.backend.order.repository;

import in.fonzkart.backend.user.entity.User;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** The user lookups of the order workflow (lib/order-workflow.ts, lib/order-access.ts, lib/store.ts → addOrder). */
@Transactional(readOnly = true)
public interface OrderPeopleRepository extends Repository<User, String> {

    /**
     * partnerForPincode(): findFirst({ where: { role: 'PARTNER', pincodes: { has: pincode } },
     * orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
     */
    @Query(value = "SELECT * FROM \"User\" WHERE \"role\" = 'PARTNER' AND :pincode = ANY(\"pincodes\") "
            + "ORDER BY \"createdAt\" ASC, \"id\" ASC LIMIT 1", nativeQuery = true)
    Optional<User> findPartnerForPincode(@Param("pincode") String pincode);

    /** findMany({ where: { role: { in: roles } } }) */
    @Query("SELECT u FROM User u WHERE u.role IN :roles")
    List<User> findByRoleIn(@Param("roles") Collection<String> roles);

    /** findMany({ where: { role: 'PARTNER', cityId: { in: cityIds } } }) */
    @Query("SELECT u FROM User u WHERE u.role = 'PARTNER' AND u.cityId IN :cityIds")
    List<User> findPartnersInCities(@Param("cityIds") Collection<String> cityIds);

    /** findMany({ where: { role: 'PARTNER', relationshipManagerId } }) */
    @Query("SELECT u FROM User u WHERE u.role = 'PARTNER' AND u.relationshipManagerId = :rmId")
    List<User> findPartnersOfRelationshipManager(@Param("rmId") String relationshipManagerId);

    /** findMany({ where: { role: 'PARTNER' (, id in ids) }, orderBy: { name: 'asc' } }) */
    @Query("SELECT u FROM User u WHERE u.role = 'PARTNER' ORDER BY u.name ASC")
    List<User> findAllPartnersByName();

    @Query("SELECT u FROM User u WHERE u.role = 'PARTNER' AND u.id IN :ids ORDER BY u.name ASC")
    List<User> findPartnersByIdsByName(@Param("ids") Collection<String> ids);

    @Query("SELECT u FROM User u WHERE u.id IN :ids")
    List<User> findByIdIn(@Param("ids") Collection<String> ids);
}
