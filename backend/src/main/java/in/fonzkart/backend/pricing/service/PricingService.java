package in.fonzkart.backend.pricing.service;

import com.fasterxml.jackson.databind.JsonNode;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.pricing.dto.EvaluationRuleDto;
import in.fonzkart.backend.pricing.entity.EvaluationRule;
import in.fonzkart.backend.pricing.repository.EvaluationRuleRepository;
import in.fonzkart.backend.pricing.rules.JsValues;
import in.fonzkart.backend.pricing.rules.JsValues.JsTypeError;
import in.fonzkart.backend.pricing.rules.PriceCalculator;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Pricing and evaluation rules, ported from actions/priceCalculation.ts (calculatePrice) and actions/admin.ts +
 * lib/store.ts (getEvaluationRules, upsertEvaluationRule). Inputs are taken as JSON so the original's JavaScript
 * handling of missing / null / wrongly-typed values is reproduced; where the original throws, an
 * {@link ActionException} (HTTP 500) is raised.
 */
@Service
public class PricingService {

    private final EvaluationRuleRepository rules;
    private final StaffAccess access;

    public PricingService(EvaluationRuleRepository rules, StaffAccess access) {
        this.rules = rules;
        this.access = access;
    }

    /**
     * calculatePrice(basePrice, answers, category = 'smartphone').
     *
     * @param basePrice the variant's base price (callers always pass a number)
     * @param answers   the questionnaire answers; JSON missing node when not given
     * @param category  the category; JSON missing node → 'smartphone' (JavaScript default parameter)
     * @return the price; NaN where the original yields NaN
     */
    public double calculatePrice(double basePrice, JsonNode answers, JsonNode category) {
        String cat = categoryValue(category);
        try {
            return PriceCalculator.calculate(basePrice, answers == null ? JsValues.undefined() : answers, cat,
                    rules.findByCategoryUnordered(cat));
        } catch (JsTypeError e) {
            throw new ActionException(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
        }
    }

    /** getEvaluationRules(category) — no access check in the original; no category means all rules. */
    public List<EvaluationRuleDto> getEvaluationRules(String category) {
        List<EvaluationRule> list = category == null ? rules.findAllUnordered() : rules.findByCategoryUnordered(category);
        return list.stream().map(EvaluationRuleDto::from).toList();
    }

    /**
     * upsertEvaluationRule(data) — administrators only (SUPER_ADMIN, ADMIN); Prisma upsert on (category, questionKey, answerKey) with
     * {@code create: data} and {@code update: { deductionAmount, deductionPercent, label }}. Behaviour verified against
     * Prisma 5.21:
     * <ul>
     *   <li>Prisma validates the create arguments on every call, so {@code label} is required even when the rule
     *       already exists; deductionAmount / deductionPercent default to 0 on create and are left unchanged on
     *       update when not given.</li>
     *   <li>deductionAmount is truncated toward zero (2.7 → 2, -2.7 → -2); values outside 32-bit integer range,
     *       null and non-numbers are rejected. deductionPercent must be a number.</li>
     * </ul>
     */
    public Map<String, Object> upsertEvaluationRule(Optional<SessionPayload> session, JsonNode data) {
        access.requireRole(session, StaffAccess.ADMINS); // pricing rules: administrators only
        if (data == null || !data.isObject()) {
            throw invalid("data");
        }
        String category = requiredString(data, "category");
        String questionKey = requiredString(data, "questionKey");
        String answerKey = requiredString(data, "answerKey");
        String label = requiredString(data, "label");
        Optional<Integer> amount = optionalInt(data, "deductionAmount");
        Optional<Double> percent = optionalDouble(data, "deductionPercent");
        LocalDateTime now = JsDates.nowUtc();

        Optional<EvaluationRule> existing = rules.findByCategoryAndQuestionKeyAndAnswerKey(category, questionKey, answerKey);
        if (existing.isPresent()) {
            rules.update(existing.get().getId(), amount.isPresent(), amount.orElse(0), percent.isPresent(),
                    percent.orElse(0.0), true, label, now);
        } else {
            rules.insert(Cuid.next(), category, questionKey, answerKey, label, amount.orElse(0), percent.orElse(0.0), now);
        }
        return Map.of("success", true);
    }

    /** category === undefined → 'smartphone'; null or non-string → Prisma rejects the query. */
    private static String categoryValue(JsonNode category) {
        if (category == null || category.isMissingNode()) {
            return "smartphone";
        }
        if (!category.isTextual()) {
            throw invalid("category");
        }
        return category.textValue();
    }

    private static String requiredString(JsonNode data, String field) {
        JsonNode v = data.get(field);
        if (v == null || !v.isTextual()) {
            throw invalid(field);
        }
        return v.textValue();
    }

    /** Prisma Int: a JSON number truncated toward zero, within 32-bit range. */
    private static Optional<Integer> optionalInt(JsonNode data, String field) {
        JsonNode v = data.get(field);
        if (v == null) {
            return Optional.empty();
        }
        if (!v.isNumber()) {
            throw invalid(field);
        }
        double truncated = v.isIntegralNumber() ? v.asDouble() : (v.asDouble() < 0 ? Math.ceil(v.asDouble()) : Math.floor(v.asDouble()));
        if (Double.isNaN(truncated) || truncated > Integer.MAX_VALUE || truncated < Integer.MIN_VALUE) {
            throw invalid(field);
        }
        return Optional.of((int) truncated);
    }

    private static Optional<Double> optionalDouble(JsonNode data, String field) {
        JsonNode v = data.get(field);
        if (v == null) {
            return Optional.empty();
        }
        if (!v.isNumber()) {
            throw invalid(field);
        }
        return Optional.of(v.asDouble());
    }

    private static ActionException invalid(String field) {
        return new ActionException(HttpStatus.INTERNAL_SERVER_ERROR, "Invalid value for " + field);
    }
}
