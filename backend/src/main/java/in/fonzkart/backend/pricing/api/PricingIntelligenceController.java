package in.fonzkart.backend.pricing.api;

import com.fasterxml.jackson.databind.JsonNode;
import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.pricing.data.PricingData;
import in.fonzkart.backend.pricing.service.MaxValueService;
import in.fonzkart.backend.pricing.service.PricingIntelligenceService;
import in.fonzkart.backend.pricing.service.PricingLearningService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The pricing engine's admin API (administrators only): overview, suggestions, resales, repair costs, max values. */
@RestController
@RequestMapping("/api/pricing/engine")
public class PricingIntelligenceController {

    private final PricingIntelligenceService intelligence;
    private final PricingLearningService learning;
    private final MaxValueService maxValues;
    private final SessionService sessions;

    public PricingIntelligenceController(PricingIntelligenceService intelligence, PricingLearningService learning,
                                         MaxValueService maxValues, SessionService sessions) {
        this.intelligence = intelligence;
        this.learning = learning;
        this.maxValues = maxValues;
        this.sessions = sessions;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview(HttpServletRequest request) {
        return intelligence.overview(sessions.getSession(request));
    }

    /** Revalues the auto max values and looks for suggestions now (it also runs every night). */
    @PostMapping("/run")
    public PricingLearningService.RunResult run(HttpServletRequest request) {
        return learning.runNow(sessions.getSession(request));
    }

    /** ?status=open (default) | applied | dismissed | resolved | all */
    @GetMapping("/suggestions")
    public List<PricingData.Recommendation> suggestions(HttpServletRequest request, @RequestParam(required = false) String status) {
        return intelligence.recommendations(sessions.getSession(request), status);
    }

    /** Body {@code {"action": "apply" | "dismiss"}}. */
    @PostMapping("/suggestions/{id}")
    public Map<String, Object> decide(HttpServletRequest request, @PathVariable String id, @RequestBody JsonNode body) {
        return learning.decide(sessions.getSession(request), id, body == null ? null : body.path("action").asText(null));
    }

    @GetMapping("/sales")
    public List<PricingData.Sale> sales(HttpServletRequest request) {
        return intelligence.sales(sessions.getSession(request));
    }

    @PostMapping("/sales")
    public Map<String, Object> recordSale(HttpServletRequest request, @RequestBody JsonNode body) {
        return intelligence.recordSale(sessions.getSession(request), body);
    }

    @DeleteMapping("/sales/{id}")
    public Map<String, Object> deleteSale(HttpServletRequest request, @PathVariable String id) {
        return intelligence.deleteSale(sessions.getSession(request), id);
    }

    @GetMapping("/repair-costs")
    public List<PricingData.RepairCost> repairCosts(HttpServletRequest request, @RequestParam(required = false) String category) {
        return intelligence.repairCosts(sessions.getSession(request), category);
    }

    /** One row or {@code {"rows": [...]}}. */
    @PutMapping("/repair-costs")
    public Map<String, Object> saveRepairCosts(HttpServletRequest request, @RequestBody JsonNode body) {
        return intelligence.saveRepairCosts(sessions.getSession(request), body);
    }

    @DeleteMapping("/repair-costs/{id}")
    public Map<String, Object> deleteRepairCost(HttpServletRequest request, @PathVariable String id) {
        return intelligence.deleteRepairCost(sessions.getSession(request), id);
    }

    /** A device's price explained: sheet, repair estimates, launch reference, resale evidence. */
    @GetMapping("/explain")
    public Map<String, Object> explain(HttpServletRequest request, @RequestParam(required = false) String device,
                                       @RequestParam(required = false) String variant) {
        return intelligence.explain(sessions.getSession(request), device, variant);
    }

    /** How a variant's max value is kept, with its history. */
    @GetMapping("/variants/{id}")
    public Map<String, Object> variant(HttpServletRequest request, @PathVariable String id) {
        intelligence.requireAdmin(sessions.getSession(request));
        return maxValues.explain(id, YearMonth.now(ZoneId.of("Asia/Kolkata")));
    }

    /** Body {@code {launchPrice, launchMonth: "YYYY-MM", mode: "auto" | "manual"}}. */
    @PutMapping("/variants/{id}")
    public Map<String, Object> setVariant(HttpServletRequest request, @PathVariable String id, @RequestBody JsonNode body) {
        return maxValues.setLaunch(sessions.getSession(request), id, body, YearMonth.now(ZoneId.of("Asia/Kolkata")));
    }
}
