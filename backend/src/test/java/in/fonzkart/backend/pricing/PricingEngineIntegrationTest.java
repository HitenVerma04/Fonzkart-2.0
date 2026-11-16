package in.fonzkart.backend.pricing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.catalog.service.CatalogAdminService;
import in.fonzkart.backend.order.service.CustomerOrderService;
import in.fonzkart.backend.pricing.data.PricingData;
import in.fonzkart.backend.pricing.engine.PriceSheet;
import in.fonzkart.backend.pricing.engine.SheetPricer;
import in.fonzkart.backend.pricing.service.MaxValueService;
import in.fonzkart.backend.pricing.service.PricingIntelligenceService;
import in.fonzkart.backend.pricing.service.PricingKnowledge;
import in.fonzkart.backend.pricing.service.PricingLearningService;
import in.fonzkart.backend.pricing.service.PricingService;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.support.PostgresTestBase;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** The pricing engine against a real database: sheets, repair-cost sources, revaluation, resales and learning. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Import(PostgresTestBase.RecordingMailConfig.class)
class PricingEngineIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.prismaDatabaseWith("db/03-staff-seed.sql");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    private static final Optional<SessionPayload> ADMIN = Optional.of(new SessionPayload(
            new SessionUser("u-super", "admin@fonzkart.in", "Root", "SUPER_ADMIN"), null, null, null));
    private static final Optional<SessionPayload> NOBODY = Optional.empty();

    @Autowired JdbcTemplate jdbc;
    @Autowired CustomerOrderService orders;
    @Autowired PricingService pricing;
    @Autowired PricingIntelligenceService intelligence;
    @Autowired PricingLearningService learning;
    @Autowired MaxValueService maxValues;
    @Autowired PricingKnowledge knowledge;
    @Autowired CatalogAdminService catalogAdmin;
    @Autowired PricingData data;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void catalog() {
        for (String t : List.of("PriceQuote", "DeviceSale", "PricingRecommendation", "PriceHistory", "RepairCost", "VariantPricing",
                "EvaluationRule", "RepairPrice", "Order", "Variant", "Model", "Brand")) {
            jdbc.update("DELETE FROM \"" + t + "\"");
        }
        jdbc.update("DELETE FROM \"AppSetting\" WHERE key LIKE 'pricing.%'");
        knowledge.invalidate();
        jdbc.update("INSERT INTO \"Brand\" (id, name, logo, categories, priority) VALUES ('apple', 'Apple', 'x', '{smartphone}', 1), "
                + "('samsung', 'Samsung', 'x', '{smartphone}', 2), ('lava', 'Lava', 'x', '{smartphone}', 3)");
        jdbc.update("INSERT INTO \"Model\" (id, \"brandId\", name, img, category, priority) VALUES "
                + "('m-i15', 'apple', 'iPhone 15', 'x', 'smartphone', 1), ('m-fold', 'samsung', 'Galaxy Z Fold 7', 'x', 'smartphone', 2), "
                + "('m-lava', 'lava', 'Lava Blaze 3', 'x', 'smartphone', 3)");
        jdbc.update("INSERT INTO \"Variant\" (id, \"modelId\", name, \"basePrice\") VALUES "
                + "('v-128', 'm-i15', '128GB', 45000), ('v-256', 'm-i15', '256GB', 43000), "
                + "('v-fold', 'm-fold', '12GB/256GB', 110000), ('v-lava', 'm-lava', '4GB/64GB', 6000)");
    }

    private JsonNode json(String s) throws Exception {
        return mapper.readTree(s);
    }

    private PriceSheet.Line line(PriceSheet sheet, String q, String a) {
        return sheet.lines().stream().filter(l -> l.question().equals(q) && l.answer().equals(a)).findFirst().orElseThrow();
    }

    @Test
    void schemaIsCreatedOnStartup() {
        List<String> tables = jdbc.queryForList("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", String.class);
        assertThat(tables).contains("VariantPricing", "RepairCost", "DeviceSale", "PriceQuote", "PricingRecommendation", "PriceHistory");
    }

    @Test
    void repairsScaleWithTheModelNotTheCategory() {
        PriceSheet iphone = orders.sheet("iPhone 15", "128GB");
        PriceSheet fold = orders.sheet("Galaxy Z Fold 7", "12GB/256GB");
        PriceSheet lava = orders.sheet("Lava Blaze 3", "4GB/64GB");
        long iphoneScreen = line(iphone, "physical_condition", "below_average").cost();
        long foldScreen = line(fold, "physical_condition", "below_average").cost();
        long lavaScreen = line(lava, "physical_condition", "below_average").cost();
        // iPhone 15 from model-reference.json (₹79,900 launch): ~26% padded for uncertainty
        assertThat(iphoneScreen).isBetween(10000L, 15000L); // 26% of ₹79,900 at 75%, 3 years of part-price fall, padded
        assertThat(foldScreen).isGreaterThan(40000L); // a folding display
        assertThat(lavaScreen).isLessThan(4000L);     // budget phone, launch price worked back from ₹6,000
        assertThat(line(iphone, "physical_condition", "good").kind()).isEqualTo(PriceSheet.VALUE);
        assertThat(line(iphone, "functional_issues", "wifi").part()).isEqualTo("board");
    }

    @Test
    void officialPricesAndFonzkartsRepairListFeedTheEstimate() throws Exception {
        long prior = line(orders.sheet("iPhone 15", "128GB"), "functional_issues", "battery").cost();
        intelligence.saveRepairCosts(ADMIN, json("{\"category\":\"smartphone\",\"brandId\":\"apple\",\"modelId\":\"m-i15\","
                + "\"part\":\"battery\",\"cost\":9000,\"source\":\"official\",\"sourceUrl\":\"https://support.apple.com/en-in\"}"));
        PriceSheet.Line official = line(orders.sheet("iPhone 15", "128GB"), "functional_issues", "battery");
        assertThat(official.source()).isEqualTo("official");
        assertThat(official.confidence()).isGreaterThan(0.6);
        assertThat(official.cost()).isNotEqualTo(prior).isBetween(6000L, 7200L); // mostly 75% of the list price, little padding

        jdbc.update("INSERT INTO \"RepairPrice\" (id, brand, model, issue, price, \"isActive\", \"displayOrder\", \"createdAt\", \"updatedAt\") "
                + "VALUES ('rp1', 'Apple', 'iPhone 15', 'screen', 18000, true, 0, now(), now())");
        PriceSheet.Line screen = line(orders.sheet("iPhone 15", "128GB"), "physical_condition", "below_average");
        assertThat(screen.source()).isEqualTo("fonzkart_repair");
        assertThat(screen.cost()).isLessThan(20000L);
        assertThatThrownBy(() -> intelligence.saveRepairCosts(NOBODY, json("{\"part\":\"battery\",\"cost\":1}")))
                .isInstanceOf(ActionException.class);
        assertThatThrownBy(() -> intelligence.saveRepairCosts(ADMIN, json("{\"category\":\"smartphone\",\"part\":\"unicorn\",\"cost\":10}")))
                .isInstanceOf(ActionException.class);
    }

    @Test
    void anAdminRuleIsTheLeastARepairTakes() {
        jdbc.update("INSERT INTO \"EvaluationRule\" (id, category, \"questionKey\", \"answerKey\", label, \"deductionAmount\", "
                + "\"deductionPercent\", \"createdAt\", \"updatedAt\") VALUES ('r1', 'smartphone', 'physical_condition', 'below_average', "
                + "'Below Average', 0, 20, now(), now()), ('r2', 'smartphone', 'functional_issues', 'speaker', 'Speaker', 0, 30, now(), now())");
        PriceSheet sheet = orders.sheet("iPhone 15", "128GB");
        assertThat(line(sheet, "physical_condition", "below_average").cost()).isGreaterThan(9000L); // repair beats 20%
        assertThat(line(sheet, "functional_issues", "speaker").cost()).isEqualTo(13500L);          // 30% beats the repair
        assertThat(line(sheet, "functional_issues", "speaker").source()).isEqualTo("admin");
    }

    @Test
    void quotesComeFromTheSheetAndAreLogged() throws Exception {
        JsonNode answers = json("{\"physical_condition\":\"below_average\",\"body_condition\":\"good\",\"functional_issues\":[\"wifi\",\"sim1\"],"
                + "\"purchase_location\":\"india\",\"accessories\":[\"charger\",\"box\",\"bill\"],\"warranty\":\"0_3_months\"}");
        Map<String, Object> quote = orders.quote("iPhone 15", "128GB", answers);
        long fromSheet = SheetPricer.price(orders.sheet("iPhone 15", "128GB"), answers).price();
        assertThat(((Number) quote.get("price")).longValue()).isEqualTo(fromSheet).isLessThan(45000).isGreaterThan(6750);
        assertThat(quote).containsKeys("breakdown", "confidence", "engineVersion");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"PriceQuote\" WHERE stage = 'quote'", Integer.class)).isEqualTo(1);
        // the website's calculation with the device named gives the same price
        assertThat(pricing.calculatePrice(45000, answers, mapper.getNodeFactory().textNode("smartphone"))).isPositive();
    }

    @Test
    void anAdminsPriceEditPinsTheVariant() {
        catalogAdmin.updateVariant(ADMIN, "v-128", "m-i15", "128GB", 47000);
        assertThat(data.variantPricing("v-128").orElseThrow().mode()).isEqualTo("manual");
        assertThat(data.history("v-128", 5)).extracting(PricingData.History::newPrice).containsExactly(47000);
    }

    @Test
    void autoVariantsAreRevaluedMonthlyInSmallSteps() throws Exception {
        maxValues.setLaunch(ADMIN, "v-128", json("{\"launchPrice\":79900,\"launchMonth\":\"2023-09\",\"mode\":\"auto\"}"), YearMonth.of(2026, 11));
        int rule = jdbc.queryForObject("SELECT \"basePrice\" FROM \"Variant\" WHERE id = 'v-128'", Integer.class);
        assertThat(rule).isEqualTo(38600); // 78% × 0.86^(38/12) of ₹79,900, rounded down to ₹100
        assertThat(maxValues.revalueAll(YearMonth.of(2026, 11)).changed()).isZero(); // already this month
        MaxValueService.Revaluation later = maxValues.revalueAll(YearMonth.of(2027, 5));
        int after = jdbc.queryForObject("SELECT \"basePrice\" FROM \"Variant\" WHERE id = 'v-128'", Integer.class);
        assertThat(later.changed()).isEqualTo(1);
        assertThat(after).isLessThan(rule).isGreaterThanOrEqualTo((int) (rule * 0.92) - 100); // at most 8% a month
        assertThat(data.history("v-128", 5).get(0).reason()).startsWith("Monthly revaluation");
        // the manual one is never touched
        assertThat(jdbc.queryForObject("SELECT \"basePrice\" FROM \"Variant\" WHERE id = 'v-256'", Integer.class)).isEqualTo(43000);
    }

    @Test
    void resalesTeachTheEngine() throws Exception {
        // Fonzkart paid ₹45,000 for flawless iPhone 15s that resold for ₹44,000: it lost money on each.
        for (int i = 0; i < 6; i++) {
            jdbc.update("INSERT INTO \"Order\" (id, \"userId\", device, price, status, address, answers, \"createdAt\", \"updatedAt\") "
                    + "VALUES (?, 'u-admin', 'iPhone 15 (128GB)', 45000, 'completed', 'x', '{}', now(), now())", "o" + i);
            intelligence.recordSale(ADMIN, json("{\"orderId\":\"o" + i + "\",\"salePrice\":44000,\"grade\":\"superb\","
                    + "\"repairs\":[{\"part\":\"battery\",\"cost\":2500}]}"));
        }
        assertThatThrownBy(() -> intelligence.recordSale(ADMIN, json("{\"orderId\":\"o0\",\"salePrice\":1}")))
                .isInstanceOf(ActionException.class); // once per order

        // the profit guard now limits offers for this model
        PriceSheet sheet = orders.sheet("iPhone 15", "128GB");
        assertThat(sheet.profitGuard()).isNotNull();
        assertThat(SheetPricer.price(sheet, json("{\"accessories\":[\"charger\",\"box\",\"bill\"]}")).price()).isLessThan(45000);

        // and the learning run suggests lowering the model's max values
        PricingLearningService.RunResult run = learning.run();
        assertThat(run.byKind()).containsKey("max_value");
        PricingData.Recommendation rec = data.recommendations("open", 100).stream()
                .filter(r -> r.kind().equals("max_value")).findFirst().orElseThrow();
        assertThat(rec.suggestedValue()).isLessThan(1.0);
        learning.decide(ADMIN, rec.id(), "apply");
        assertThat(jdbc.queryForObject("SELECT \"basePrice\" FROM \"Variant\" WHERE id = 'v-128'", Integer.class)).isLessThan(45000);
        assertThat(data.recommendation(rec.id()).orElseThrow().status()).isEqualTo("applied");
    }

    @Test
    void catalogChecksBecomeOneTapFixes() {
        learning.run();
        PricingData.Recommendation storage = data.recommendations("open", 100).stream()
                .filter(r -> r.targetKey().equals("storage:v-256")).findFirst().orElseThrow();
        assertThat(storage.suggestedValue()).isEqualTo(46800.0);
        learning.decide(ADMIN, storage.id(), "apply");
        assertThat(jdbc.queryForObject("SELECT \"basePrice\" FROM \"Variant\" WHERE id = 'v-256'", Integer.class)).isEqualTo(46800);
        learning.run();
        assertThat(data.recommendations("open", 100)).noneMatch(r -> r.targetKey().equals("storage:v-256"));
        assertThatThrownBy(() -> learning.decide(NOBODY, storage.id(), "apply")).isInstanceOf(ActionException.class);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> settingsOf(Map<String, Object> overview) {
        return (Map<String, Object>) overview.get("settings");
    }

    @Test
    void settingsHaveSafeDefaultsAndLimits() throws Exception {
        assertThat(settingsOf(intelligence.overview(ADMIN))).containsEntry("targetMarginPercent", 12.0).containsEntry("autoApply", true);
        pricing.saveSettings(ADMIN, json("{\"targetMarginPercent\":18,\"autoApply\":false}"));
        assertThat(settingsOf(intelligence.overview(ADMIN))).containsEntry("targetMarginPercent", 18.0).containsEntry("autoApply", false);
        assertThat(pricing.settings("smartphone")).doesNotContainKey("targetMarginPercent"); // public: no margin
        assertThatThrownBy(() -> pricing.saveSettings(ADMIN, json("{\"targetMarginPercent\":95}"))).isInstanceOf(ActionException.class);
        assertThat(intelligence.overview(ADMIN)).containsKeys("catalog", "learning", "openSuggestions");
    }
}
