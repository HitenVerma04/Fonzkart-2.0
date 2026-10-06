package in.fonzkart.backend.pricing.repository;

import in.fonzkart.backend.pricing.entity.EvaluationRule;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * "EvaluationRule" queries equivalent to lib/store.ts → getEvaluationRules / upsertEvaluationRule.
 * Reads have no ORDER BY, exactly like the original findMany: rules are applied in the order the database returns
 * them.
 */
public interface EvaluationRuleRepository extends JpaRepository<EvaluationRule, String> {

    /** prisma.evaluationRule.findMany({ where: { category } }) */
    @Transactional(readOnly = true)
    @Query(value = "SELECT * FROM \"EvaluationRule\" WHERE \"category\" = :category", nativeQuery = true)
    List<EvaluationRule> findByCategoryUnordered(@Param("category") String category);

    /** prisma.evaluationRule.findMany({ where: { category: undefined } }) — no filter */
    @Transactional(readOnly = true)
    @Query(value = "SELECT * FROM \"EvaluationRule\"", nativeQuery = true)
    List<EvaluationRule> findAllUnordered();

    @Transactional(readOnly = true)
    Optional<EvaluationRule> findByCategoryAndQuestionKeyAndAnswerKey(String category, String questionKey, String answerKey);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            INSERT INTO "EvaluationRule" ("id", "category", "questionKey", "answerKey", "label", "deductionAmount",
                                          "deductionPercent", "createdAt", "updatedAt")
            VALUES (:id, :category, :questionKey, :answerKey, :label, :amount, :percent, :now, :now)
            """, nativeQuery = true)
    int insert(@Param("id") String id, @Param("category") String category, @Param("questionKey") String questionKey,
               @Param("answerKey") String answerKey, @Param("label") String label, @Param("amount") int deductionAmount,
               @Param("percent") double deductionPercent, @Param("now") LocalDateTime now);

    /** Update of the upsert: only the fields that were given (Prisma skips undefined fields); always updatedAt. */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE "EvaluationRule" SET
                "deductionAmount" = CASE WHEN :setAmount THEN :amount ELSE "deductionAmount" END,
                "deductionPercent" = CASE WHEN :setPercent THEN :percent ELSE "deductionPercent" END,
                "label" = CASE WHEN :setLabel THEN :label ELSE "label" END,
                "updatedAt" = :now
            WHERE "id" = :id
            """, nativeQuery = true)
    int update(@Param("id") String id, @Param("setAmount") boolean setAmount, @Param("amount") int deductionAmount,
               @Param("setPercent") boolean setPercent, @Param("percent") double deductionPercent,
               @Param("setLabel") boolean setLabel, @Param("label") String label, @Param("now") LocalDateTime now);
}
