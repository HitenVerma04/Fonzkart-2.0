package in.fonzkart.backend.pricing.api;

import com.fasterxml.jackson.databind.JsonNode;
import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.pricing.dto.EvaluationRuleDto;
import in.fonzkart.backend.pricing.rules.JsValues;
import in.fonzkart.backend.pricing.service.PricingService;
import in.fonzkart.backend.shared.web.ActionException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
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

    public PricingController(PricingService pricing, SessionService sessions) {
        this.pricing = pricing;
        this.sessions = sessions;
    }

    /**
     * actions/priceCalculation.ts → calculatePrice(basePrice, answers, category?).
     * Body {@code {"basePrice": number, "answers": {...}, "category": "smartphone"}}; response: the price (a JSON
     * number; null where the original yields NaN). No access check, as in the original.
     */
    @PostMapping("/calculate")
    public Double calculate(@RequestBody JsonNode body) {
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
}
