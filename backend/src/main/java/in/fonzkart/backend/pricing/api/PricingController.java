package in.fonzkart.backend.pricing.api;

import com.fasterxml.jackson.databind.JsonNode;
import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.order.service.CustomerOrderService;
import in.fonzkart.backend.pricing.dto.EvaluationRuleDto;
import in.fonzkart.backend.pricing.engine.PriceSheet;
import in.fonzkart.backend.pricing.rules.JsValues;
import in.fonzkart.backend.pricing.rules.MaxValueRule;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import in.fonzkart.backend.pricing.service.PricingService;
import in.fonzkart.backend.shared.web.ActionException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pricing engine and evaluation rules. Same contract as the other migrated actions: 200 = the original's return
 * value, 401/403 = the original threw an auth error, 400 = the request is not what any caller sends, 500 = the
 * original threw.
 */
@RestController
@RequestMapping("/api/pricing")
public class PricingController {

    private final PricingService pricing;
    private final SessionService sessions;
    private final CustomerOrderService orders;

    public PricingController(PricingService pricing, SessionService sessions, CustomerOrderService orders) {
        this.pricing = pricing;
        this.sessions = sessions;
        this.orders = orders;
    }

    /**
     * The price sheet of a device ({@code device} as the apps name the model, {@code variant} its variant): what every
     * answer takes off, so the apps show the offer change at once as the customer answers. Public, like the quote.
     */
    @GetMapping("/sheet")
    public PriceSheet sheet(@RequestParam(required = false) String device, @RequestParam(required = false) String variant) {
        return orders.sheet(device, variant);
    }

    /**
     * The offer for a max value and answers. Body {@code {"basePrice": number, "answers": {...}, "category":
     * "smartphone"}}, optionally with {@code device} and {@code variant}: then the device is priced from its own sheet
     * (its model's repair costs), exactly as its quote. Response: the offer in rupees. No access check: the website
     * shows offers before anyone signs in.
     */
    @PostMapping("/calculate")
    public Double calculate(@RequestBody JsonNode body) {
        if (body != null && body.isObject() && body.path("device").isTextual() && body.path("variant").isTextual()) {
            var found = orders.findDevice(body.get("device").asText(), body.get("variant").asText());
            if (found.isPresent()) {
                JsonNode given = body.has("answers") && body.get("answers").isObject() ? body.get("answers") : JsValues.undefined();
                return (double) pricing.quote(found.get(), given).price();
            }
        }
        if (body == null || !body.isObject() || body.get("basePrice") == null || !body.get("basePrice").isNumber()) {
            throw new ActionException(HttpStatus.BAD_REQUEST, "basePrice must be a number");
        }
        JsonNode answers = body.has("answers") ? body.get("answers") : JsValues.undefined();
        JsonNode category = body.has("category") ? body.get("category") : JsValues.undefined();
        return pricing.calculatePrice(body.get("basePrice").asDouble(), answers, category);
    }

    /** actions/admin.ts → getEvaluationRules(category) (also app/admin/category/[slug]/page.tsx). No access check. */
    @GetMapping("/rules")
    public List<EvaluationRuleDto> rules(@RequestParam(required = false) String category) {
        return pricing.getEvaluationRules(category);
    }

    /**
     * actions/admin.ts → upsertEvaluationRule(data) (administrators only). Body {@code {category, questionKey, answerKey,
     * label, deductionAmount, deductionPercent}}; response {@code {"success": true}}.
     */
    @PutMapping("/rules")
    public Map<String, Object> upsertRule(HttpServletRequest request, @RequestBody JsonNode body) {
        return pricing.upsertEvaluationRule(sessions.getSession(request), body);
    }

    /** Removes a rule (administrators only), so the answer takes its built-in share again. */
    @DeleteMapping("/rules")
    public Map<String, Object> deleteRule(HttpServletRequest request, @RequestParam(required = false) String category,
                                          @RequestParam(required = false) String questionKey,
                                          @RequestParam(required = false) String answerKey) {
        return pricing.deleteRule(sessions.getSession(request), category, questionKey, answerKey);
    }

    /** The lowest offer and the built-in share of every answer of a category, for the admins' pricing screens. */
    @GetMapping("/settings")
    public Map<String, Object> settings(@RequestParam(required = false) String category) {
        return pricing.settings(category);
    }

    /**
     * The max value MaxValueRule suggests for a variant: {@code launchPrice} in rupees, {@code launched} as YYYY-MM,
     * the category and the brand id. Response {@code {maxValue, ageMonths, keptPercent, tier}}. No access check: it is
     * arithmetic on what the caller sends.
     */
    @GetMapping("/max-value")
    public Map<String, Object> maxValue(@RequestParam(required = false) Double launchPrice,
                                        @RequestParam(required = false) String launched,
                                        @RequestParam(required = false) String category,
                                        @RequestParam(required = false) String brand) {
        if (launchPrice == null || !(launchPrice > 0) || launchPrice > 10_000_000) {
            throw new ActionException(HttpStatus.BAD_REQUEST, "Enter the launch price in rupees.");
        }
        YearMonth month;
        try {
            month = YearMonth.parse(launched == null ? "" : launched.trim());
        } catch (DateTimeParseException e) {
            throw new ActionException(HttpStatus.BAD_REQUEST, "Enter the launch month as YYYY-MM, e.g. 2025-09.");
        }
        MaxValueRule.Suggestion s = MaxValueRule.suggest(launchPrice, month, category, brand, YearMonth.now(ZoneId.of("Asia/Kolkata")));
        return Map.of("maxValue", s.maxValue(), "ageMonths", s.ageMonths(), "keptPercent", s.keptPercent(), "tier", s.tier());
    }

    /**
     * Saves pricing settings (administrators only). Body: any of {@code minOfferPercent} (0–90), {@code
     * targetMarginPercent} (0–60), {@code logisticsCost} (rupees), {@code autoApply} (true / false).
     */
    @PutMapping("/settings")
    public Map<String, Object> saveSettings(HttpServletRequest request, @RequestBody JsonNode body) {
        boolean others = body != null && (body.has("targetMarginPercent") || body.has("logisticsCost") || body.has("autoApply"));
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        if (!others || body.has("minOfferPercent")) {
            result.putAll(pricing.setMinOfferPercent(sessions.getSession(request), body));
        }
        if (others) {
            result.putAll(pricing.saveSettings(sessions.getSession(request), body));
        }
        return result;
    }
}
