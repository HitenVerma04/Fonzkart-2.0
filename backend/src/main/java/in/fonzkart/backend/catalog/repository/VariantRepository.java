package in.fonzkart.backend.catalog.repository;

import in.fonzkart.backend.catalog.entity.Variant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** Catalog is read-only in this backend: every call runs in a PostgreSQL READ ONLY transaction. */
@Transactional(readOnly = true)
public interface VariantRepository extends JpaRepository<Variant, String> {

    /** prisma.variant.findMany({ where: { modelId }, orderBy: { basePrice: 'asc' } }) */
    List<Variant> findByModelIdOrderByBasePriceAsc(String modelId);

    /** prisma.variant.findMany({ orderBy: { basePrice: 'asc' } }) */
    List<Variant> findAllByOrderByBasePriceAsc();

    /**
     * prisma.variant.findFirst({ where: { name: { equals: variant, mode: 'insensitive' },
     * model: { name: { equals: name, mode: 'insensitive' } } } }).
     */
    @Query(value = """
            SELECT v.* FROM "Variant" v
            WHERE v."name" ILIKE :variantName
              AND v."modelId" IN (SELECT m."id" FROM "Model" m WHERE m."name" ILIKE :modelName)
            LIMIT 1
            """, nativeQuery = true)
    Optional<Variant> findFirstByNameAndModelNameInsensitive(@Param("variantName") String variantName,
                                                            @Param("modelName") String modelName);
}
