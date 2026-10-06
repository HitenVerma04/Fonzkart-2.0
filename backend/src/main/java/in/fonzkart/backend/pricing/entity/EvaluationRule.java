package in.fonzkart.backend.pricing.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * Maps the existing Prisma table {@code "EvaluationRule"} (prisma/schema.prisma → model EvaluationRule): a price
 * deduction for one answer to one questionnaire question of a category. Unique on (category, questionKey, answerKey).
 * Written only through {@link in.fonzkart.backend.pricing.repository.EvaluationRuleRepository} statements.
 */
@Entity
@Table(name = "EvaluationRule")
public class EvaluationRule {

    @Id
    private String id;

    private String category;

    private String questionKey;

    private String answerKey;

    private String label;

    private int deductionAmount;

    private double deductionPercent;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    protected EvaluationRule() {
    }

    public String getId() {
        return id;
    }

    public String getCategory() {
        return category;
    }

    public String getQuestionKey() {
        return questionKey;
    }

    public String getAnswerKey() {
        return answerKey;
    }

    public String getLabel() {
        return label;
    }

    public int getDeductionAmount() {
        return deductionAmount;
    }

    public double getDeductionPercent() {
        return deductionPercent;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
