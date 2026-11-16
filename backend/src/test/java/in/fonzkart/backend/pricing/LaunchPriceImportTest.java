package in.fonzkart.backend.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.pricing.rules.MaxValueRule;
import in.fonzkart.backend.pricing.service.LaunchPriceImport;
import in.fonzkart.backend.support.PostgresTestBase;
import java.time.YearMonth;
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

/** catalog/launch-prices.json applied to a catalog: models added, listed variants priced by the rule, once per version. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@Import(PostgresTestBase.RecordingMailConfig.class)
class LaunchPriceImportTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.prismaDatabaseWith();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    private static final YearMonth NOW = YearMonth.of(2026, 11);

    @Autowired
    private LaunchPriceImport importer;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void addsModelsPricesListedVariantsAndRunsOncePerVersion() throws Exception {
        jdbc.update("INSERT INTO \"Brand\" (id, name, logo, categories, priority) VALUES ('apple', 'Apple', '/apple.png', '{smartphone,watch}', 1)");
        jdbc.update("INSERT INTO \"Model\" (id, \"brandId\", name, img, category, priority) VALUES ('w1', 'apple', 'Old Watch', '/w.png', 'watch', 10)");
        jdbc.update("INSERT INTO \"Variant\" (id, \"modelId\", name, \"basePrice\") VALUES ('w1-base', 'w1', 'Base', 1), ('w1-other', 'w1', 'Other', 7)");
        jdbc.update("INSERT INTO \"Model\" (id, \"brandId\", name, img, category, priority) VALUES ('n1', 'apple', 'Placeholder Phone', '/n.png', 'smartphone', 10)");
        jdbc.update("INSERT INTO \"Variant\" (id, \"modelId\", name, \"basePrice\") VALUES ('n1-base', 'n1', 'Base Variant', 15000)");

        JsonNode file = new ObjectMapper().readTree("""
                {"version": "t1", "models": [
                  {"id": "p1", "brandId": "apple", "category": "smartphone", "name": "New Phone", "launched": "2026-09",
                   "img": "/p.png", "priority": 5, "variants": [{"name": "256GB", "launchPrice": 164900}, {"name": "512GB", "launchPrice": 189900}]},
                  {"brandId": "apple", "category": "watch", "name": "old watch", "launched": "2025-09", "variants": [{"name": "Base", "launchPrice": 46900}]},
                  {"brandId": "apple", "category": "watch", "name": "Not In This Catalog", "launched": "2025-09", "variants": [{"name": "Base", "launchPrice": 1000}]},
                  {"brandId": "nobrand", "category": "smartphone", "name": "X", "launched": "2025-09", "img": "/x.png", "variants": [{"name": "Base", "launchPrice": 1000}]},
                  {"brandId": "apple", "category": "smartphone", "name": "Placeholder Phone", "launched": "2026-03", "replaces": ["Base Variant"],
                   "variants": [{"name": "8 GB/128 GB", "launchPrice": 31999}, {"name": "8 GB/256 GB", "launchPrice": 34999}]}
                ]}""");

        LaunchPriceImport.Result first = importer.apply(file, NOW);
        assertThat(first.applied()).isTrue();
        assertThat(first.modelsAdded()).isEqualTo(1);
        assertThat(first.variantsAdded()).isEqualTo(4);
        assertThat(first.variantsRepriced()).isEqualTo(1);
        assertThat(first.variantsRemoved()).isEqualTo(1);
        assertThat(first.skipped()).hasSize(2);
        assertThat(jdbc.queryForList("SELECT name FROM \"Variant\" WHERE \"modelId\" = 'n1' ORDER BY \"basePrice\"", String.class))
                .containsExactly("8 GB/128 GB", "8 GB/256 GB"); // the ₹15,000 placeholder is gone

        assertThat(price("p1", "256GB")).isEqualTo(125_400); // as MaxValueRuleTest
        assertThat(price("p1", "512GB")).isEqualTo(MaxValueRule.suggest(189_900, YearMonth.of(2026, 9), "smartphone", "apple", NOW).maxValue());
        assertThat(price("w1", "Base")).isEqualTo(MaxValueRule.suggest(46_900, YearMonth.of(2025, 9), "watch", "apple", NOW).maxValue());
        assertThat(price("w1", "Other")).isEqualTo(7); // not listed: untouched
        assertThat(jdbc.queryForObject("SELECT img FROM \"Model\" WHERE id = 'p1'", String.class)).isEqualTo("/p.png");

        // An admin's later edit stays: the same version is not applied again.
        jdbc.update("UPDATE \"Variant\" SET \"basePrice\" = 99 WHERE id = 'w1-base'");
        assertThat(importer.apply(file, NOW).applied()).isFalse();
        assertThat(price("w1", "Base")).isEqualTo(99);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"Model\" WHERE name = 'New Phone'", Integer.class)).isEqualTo(1);
    }

    @Test
    void pricesEveryCopyOfAModelUnderAnyCategoryNameButKeepsAnAdminsPrice() throws Exception {
        jdbc.update("INSERT INTO \"Brand\" (id, name, logo, categories, priority) VALUES ('tw', 'Test Watches', '/tw.png', '{watch}', 1)");
        // the same watch twice (one filed under "smartwatch", with a stray space in its name), and a third one an admin priced
        jdbc.update("INSERT INTO \"Model\" (id, \"brandId\", name, img, category, priority) VALUES "
                + "('dup-a', 'tw', 'Series X (GPS + Cellular)', '/a.png', 'watch', 10), "
                + "('dup-b', 'tw', 'Series X (GPS + Cellular) ', '/b.png', 'smartwatch', 10), "
                + "('pinned', 'tw', 'Series Y', '/c.png', 'watch', 10)");
        jdbc.update("INSERT INTO \"Variant\" (id, \"modelId\", name, \"basePrice\") VALUES "
                + "('dup-a-base', 'dup-a', 'Base', 15000), ('dup-b-base', 'dup-b', 'Base', 15000), ('pinned-base', 'pinned', 'Base', 12345)");
        jdbc.update("INSERT INTO \"VariantPricing\" (\"variantId\", mode, \"updatedAt\") VALUES ('pinned-base', 'manual', now())");

        JsonNode file = new ObjectMapper().readTree("""
                {"version": "t2", "models": [
                  {"brandId": "tw", "category": "watch", "name": "Series X (GPS + Cellular)", "launched": "2024-09", "variants": [{"name": "Base", "launchPrice": 56900}]},
                  {"brandId": "tw", "category": "watch", "name": "Series Y", "launched": "2024-09", "variants": [{"name": "Base", "launchPrice": 46900}]}
                ]}""");
        LaunchPriceImport.Result result = importer.apply(file, NOW);

        long expected = MaxValueRule.suggest(56_900, YearMonth.of(2024, 9), "watch", "tw", NOW).maxValue();
        assertThat(price("dup-a", "Base")).isEqualTo(expected);
        assertThat(price("dup-b", "Base")).isEqualTo(expected);
        assertThat(price("pinned", "Base")).isEqualTo(12345);
        assertThat(result.variantsRepriced()).isEqualTo(2);
        assertThat(result.skipped()).isEmpty();
        assertThat(jdbc.queryForObject("SELECT value FROM \"AppSetting\" WHERE key = ?", String.class, LaunchPriceImport.RESULT_KEY))
                .contains("\"version\":\"t2\"").contains("\"variantsRepriced\":2");
    }

    @Test
    void theBundledFileIsValid() {
        LaunchPriceImport.Result result = importer.apply(YearMonth.of(2026, 11));
        assertThat(result.version()).isNotBlank();
    }

    private long price(String modelId, String variant) {
        return jdbc.queryForObject("SELECT \"basePrice\" FROM \"Variant\" WHERE \"modelId\" = ? AND name = ?", Long.class, modelId, variant);
    }
}
