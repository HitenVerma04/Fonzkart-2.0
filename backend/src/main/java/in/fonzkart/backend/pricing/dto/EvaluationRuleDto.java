package in.fonzkart.backend.pricing.dto;

import in.fonzkart.backend.pricing.entity.EvaluationRule;
import in.fonzkart.backend.shared.time.JsDates;

/** An "EvaluationRule" row as Prisma returns it. */
public record EvaluationRuleDto(String id, String category, String questionKey, String answerKey, String label,
                                int deductionAmount, double deductionPercent, String createdAt, String updatedAt) {

    public static EvaluationRuleDto from(EvaluationRule r) {
        return new EvaluationRuleDto(r.getId(), r.getCategory(), r.getQuestionKey(), r.getAnswerKey(), r.getLabel(),
                r.getDeductionAmount(), r.getDeductionPercent(), JsDates.toIsoString(r.getCreatedAt()),
                JsDates.toIsoString(r.getUpdatedAt()));
    }
}
