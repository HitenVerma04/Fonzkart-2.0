package in.fonzkart.backend.catalog.repository;

import in.fonzkart.backend.catalog.entity.Brand;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** Catalog is read-only in this backend: every call runs in a PostgreSQL READ ONLY transaction. */
@Transactional(readOnly = true)
public interface BrandRepository extends JpaRepository<Brand, String> {

    /** prisma.brand.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }] }) */
    List<Brand> findAllByOrderByPriorityAscNameAsc();

    /**
     * prisma.brand.findMany({ where: { OR: [{ categories: { hasSome } }, { categories: { equals: [] } }] },
     * orderBy: [{ priority: 'asc' }, { name: 'asc' }] }) — the second OR branch only when includeEmpty.
     * {@code hasSome} (array overlap) is expressed as EXISTS over unnest(...) with an IN list, because
     * collection parameters are reliably expanded by Hibernate only inside IN (...).
     */
    @Query(value = """
            SELECT * FROM "Brand"
            WHERE EXISTS (SELECT 1 FROM unnest("categories") AS c(value) WHERE c.value IN (:categories))
               OR (:includeEmpty AND "categories" = CAST('{}' AS text[]))
            ORDER BY "priority" ASC, "name" ASC
            """, nativeQuery = true)
    List<Brand> findByAnyCategory(@Param("categories") Collection<String> categories,
                                  @Param("includeEmpty") boolean includeEmpty);
}
