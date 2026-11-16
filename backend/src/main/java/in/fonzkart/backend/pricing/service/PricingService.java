package in.fonzkart.backend.pricing.service;

import com.fasterxml.jackson.databind.JsonNode;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.session.SessionPayload;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.catalog.dto.VariantWithModelDto;
import in.fonzkart.backend.order.service.CustomerOrderService;
import in.fonzkart.backend.pricing.data.PricingData;
import in.fonzkart.backend.pricing.engine.PriceSheet;
import in.fonzkart.backend.pricing.engine.SheetPricer;
import in.fonzkart.backend.pricing.dto.EvaluationRuleDto;
import in.fonzkart.backend.pricing.entity.EvaluationRule;
import in.fonzkart.backend.pricing.repository.EvaluationRuleRepository;
import in.fonzkart.backend.pricing.rules.JsValues;
import in.fonzkart.backend.pricing.rules.PriceCalculator;
import in.fonzkart.backend.pricing.rules.PricingDefaults;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Pricing: the offer for a device (its {@link PriceSheet}, priced by {@link SheetPricer}), the admins' rules (one per
 * answer, in place of its built-in share; the least a repair answer takes) and the pricing settings. Rule reads and writes were ported from actions/admin.ts +
 * lib/store.ts (getEvaluationRules, upsertEvaluationRule); inputs are taken as JSON and, where the original threw,
 * an {@link ActionException} (HTTP 500) is raised.
 */
@Service
public class PricingService {

    /** "AppSetting" key of the lowest offer, in percent of the max value. */
    public static final String MIN_OFFER_KEY = "pricing.minOfferPercent";
    /** The highest lowest offer an admin can set (it would hide most of the deductions above it). */
    public static final double MAX_MIN_OFFER_PERCENT = 90;

    /** A priced device: the offer, the sheet it came from and how it was reached. */
    public record Quote(long price, PriceSheet sheet, SheetPricer.Result result) {
    }

    private final EvaluationRuleRepository rules;
    private final StaffAccess access;
    private final JdbcTemplate jdbc;
    private final PriceSheetService sheets;
    private final PricingSettings pricingSettings;
    private final PricingData data;
    private final ObjectMapper mapper;

    public PricingService(EvaluationRuleRepository rules, StaffAccess access, JdbcTemplate jdbc, PriceSheetService sheets,
                          PricingSettings pricingSettings, PricingData data, ObjectMapper mapper) {
        this.rules = rules;
        this.access = access;
        this.jdbc = jdbc;
        this.sheets = sheets;
        this.pricingSettings = pricingSettings;
        this.data = data;
        this.mapper = mapper;
    }

    /**
     * The offer for a max value and answers when the device itself is not known (the website's pickup re-check): repairs
     * are then scaled by a launch price worked back from the max value. Prefer {@link #quote}.
     *
     * @param basePrice the variant's max value
     * @param answers   the questionnaire answers; JSON missing node when not given
     * @param category  the category; JSON missing node → 'smartphone'
     * @return the offer in rupees
     */
    public double calculatePrice(double basePrice, JsonNode answers, JsonNode category) {
        String cat = categoryValue(category);
        if (!(basePrice > 0) || Double.isInfinite(basePrice)) {
            return 0;
        }
        PriceSheet sheet = sheets.sheet(new PriceSheetService.Device(null, (long) Math.floor(basePrice), cat, null, null, null));
        return SheetPricer.price(sheet, answers == null ? JsValues.undefined() : answers).price();
    }

    /** The price sheet of a catalog variant (its model's repair costs, the admins' rules, the profit guard). */
    public PriceSheet sheetFor(VariantWithModelDto variant) {
        String cat = CustomerOrderService.sellCategory(variant.model() == null ? null : variant.model().category());
        long base = variant.basePrice() == null ? 0 : variant.basePrice();
        return sheets.sheet(new PriceSheetService.Device(variant.id(), base, cat,
                variant.model() == null ? null : variant.model().brandId(), variant.modelId(),
                variant.model() == null ? null : variant.model().name()));
    }

    /** The offer for a catalog variant and these answers, with its sheet and breakdown. */
    public Quote quote(VariantWithModelDto variant, JsonNode answers) {
        PriceSheet sheet = sheetFor(variant);
        SheetPricer.Result result = SheetPricer.price(sheet, answers == null ? JsValues.undefined() : answers);
        return new Quote(result.price(), sheet, result);
    }

    /** Keeps a priced quote (stage quote, order or inspection) for the audit trail and the learning. */
    public void logQuote(String stage, String orderId, VariantWithModelDto variant, Quote quote, JsonNode answers) {
        String answersText = null;
        String breakdown = null;
        try {
            answersText = answers == null ? null : mapper.writeValueAsString(answers);
            breakdown = mapper.writeValueAsString(quote.result().breakdown());
        } catch (Exception ignored) {
            // the quote is logged without them
        }
        data.logQuote(stage, orderId, variant.id(), variant.model() == null ? variant.name() : variant.model().name() + " (" + variant.name() + ")",
                quote.sheet().category(), quote.sheet().maxValue(), quote.price(), quote.result().confidence(),
                quote.sheet().engineVersion(), answersText, breakdown);
    }

    /** The lowest offer, in percent of the max value: the admins' setting, or the default until they set one. */
    public double minOfferPercent() {
        return pricingSettings.minOfferPercent();
    }

    /**
     * What the admins' pricing screens show: the lowest offer and the built-in share of every answer (percent of the
     * max value), with each question's cap. Public, like the rules themselves.
     */
    public Map<String, Object> settings(String category) {
        String cat = category == null || category.isBlank() ? "smartphone" : category;
        List<Map<String, Object>> defaults = new ArrayList<>();
        Map<String, Double> caps = new LinkedHashMap<>();
        PricingDefaults.forCategory(cat).forEach((question, q) -> {
            caps.put(question, q.capPercent());
            q.answers().forEach((answer, percent) -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("questionKey", question);
                row.put("answerKey", answer);
                row.put("percent", percent);
                defaults.add(row);
            });
        });
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("category", cat);
        result.put("minOfferPercent", minOfferPercent());
        result.put("defaultMinOfferPercent", PriceCalculator.DEFAULT_MIN_OFFER_PERCENT);
        result.put("defaults", defaults);
        result.put("caps", caps);
        // the margin, logistics cost and auto-apply switch are for admins only (GET /api/pricing/engine/overview)
        result.put("engineVersion", PriceSheetService.ENGINE_VERSION);
        return result;
    }

    /**
     * Saves pricing settings (administrators only): any of {@code targetMarginPercent} (0–60), {@code logisticsCost}
     * (rupees, 0–5000) and {@code autoApply} (true / false).
     */
    public Map<String, Object> saveSettings(Optional<SessionPayload> session, JsonNode body) {
        access.requireRole(session, StaffAccess.ADMINS);
        if (body == null || !body.isObject()) {
            throw new ActionException(HttpStatus.BAD_REQUEST, "Nothing to save.");
        }
        for (String[] field : new String[][]{{"targetMarginPercent", PricingSettings.TARGET_MARGIN}, {"logisticsCost", PricingSettings.LOGISTICS}}) {
            JsonNode v = body.get(field[0]);
            if (v == null) {
                continue;
            }
            double[] range = PricingSettings.RANGES.get(field[1]);
            if (!v.isNumber() || !Double.isFinite(v.asDouble()) || v.asDouble() < range[0] || v.asDouble() > range[1]) {
                throw new ActionException(HttpStatus.BAD_REQUEST, "Set " + (field[0].equals("logisticsCost") ? "the cost per pickup" : "the margin")
                        + " between " + (long) range[0] + " and " + (long) range[1] + ".");
            }
            data.putSetting(field[1], BigDecimal.valueOf(v.asDouble()).stripTrailingZeros().toPlainString());
        }
        JsonNode auto = body.get("autoApply");
        if (auto != null) {
            if (!auto.isBoolean()) {
                throw new ActionException(HttpStatus.BAD_REQUEST, "autoApply must be true or false.");
            }
            data.putSetting(PricingSettings.AUTO_APPLY, Boolean.toString(auto.booleanValue()));
        }
        Map<String, Object> m = new LinkedHashMap<>(pricingSettings.all());
        m.put("success", true);
        return m;
    }

    /** Sets the lowest offer (administrators only): body {@code {"minOfferPercent": 0..90}}. */
    public Map<String, Object> setMinOfferPercent(Optional<SessionPayload> session, JsonNode data) {
        access.requireRole(session, StaffAccess.ADMINS);
        JsonNode v = data == null ? null : data.get("minOfferPercent");
        if (v == null || !v.isNumber() || Double.isNaN(v.asDouble()) || v.asDouble() < 0 || v.asDouble() > MAX_MIN_OFFER_PERCENT) {
            throw new ActionException(HttpStatus.BAD_REQUEST, "Set the lowest offer between 0% and 90% of the max value.");
        }
        String value = BigDecimal.valueOf(v.asDouble()).stripTrailingZeros().toPlainString();
        jdbc.update("INSERT INTO \"AppSetting\" (key, value, \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                MIN_OFFER_KEY, value, JsDates.nowUtc());
        return Map.of("success", true, "minOfferPercent", Double.parseDouble(value));
    }

    /** Removes an admin's rule (administrators only), so the answer takes its built-in share again. */
    public Map<String, Object> deleteRule(Optional<SessionPayload> session, String category, String questionKey, String answerKey) {
        access.requireRole(session, StaffAccess.ADMINS);
        if (category == null || category.isBlank() || questionKey == null || questionKey.isBlank()
                || answerKey == null || answerKey.isBlank()) {
            throw new ActionException(HttpStatus.BAD_REQUEST, "Say which rule to remove.");
        }
        rules.findByCategoryAndQuestionKeyAndAnswerKey(category, questionKey, answerKey)
                .ifPresent(r -> rules.deleteById(r.getId()));
        return Map.of("success", true);
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

    /**
     * The sell category to price with: none → 'smartphone'; a model's stored category (mobile, smartwatch, tv, ...) is
     * mapped as the apps' quote maps it ({@link CustomerOrderService#sellCategory}), so the website's executive
     * re-check and the apps use the same built-in shares and rules. Not a string → rejected.
     */
    private static String categoryValue(JsonNode category) {
        if (category == null || category.isMissingNode()) {
            return "smartphone";
        }
        if (!category.isTextual()) {
            throw invalid("category");
        }
        return CustomerOrderService.sellCategory(category.textValue());
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
