package in.fonzkart.backend.catalog.repository;

import in.fonzkart.backend.catalog.entity.DeviceModel;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** Catalog is read-only in this backend: every call runs in a PostgreSQL READ ONLY transaction. */
@Transactional(readOnly = true)
public interface DeviceModelRepository extends JpaRepository<DeviceModel, String>,
        JpaSpecificationExecutor<DeviceModel> {

    /**
     * prisma.model.findMany({ where: { name: { contains: query, mode: 'insensitive' } }, take: 10,
     * orderBy: [{ priority: 'asc' }, { name: 'asc' }] }).
     * The caller passes the ILIKE pattern ('%' + query + '%').
     */
    @Query(value = """
            SELECT * FROM "Model"
            WHERE "name" ILIKE :pattern
            ORDER BY "priority" ASC, "name" ASC
            LIMIT 10
            """, nativeQuery = true)
    List<DeviceModel> searchByNameTop10(@Param("pattern") String pattern);
}
