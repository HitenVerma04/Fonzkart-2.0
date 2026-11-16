package in.fonzkart.backend.pricing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.pricing.rules.MaxValueRule;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.time.JsDates;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Applies catalog/launch-prices.json once per version: models missing from the catalog are added (with the given id,
 * picture and order), each listed variant gets the max value {@link MaxValueRule} gives for its launch price and age
 * (added when missing), and the variants a model names in "replaces" (placeholders such as "Base Variant") are removed.
 * Nothing else is touched, and a version already applied is skipped, so later edits by the admins stay.
 */
@Service
public class LaunchPriceImport {

    /** "AppSetting" key holding the version of launch-prices.json last applied. */
    public static final String VERSION_KEY = "catalog.launchPrices.version";
    private static final Logger LOG = LoggerFactory.getLogger(LaunchPriceImport.class);

    /** What one run did. */
    public record Result(String version, boolean applied, int modelsAdded, int variantsAdded, int variantsRepriced,
                         int variantsRemoved, List<String> skipped) {
    }

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public LaunchPriceImport(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    /** Applies the bundled file as of {@code now} (the month max values are worked out for). */
    @Transactional
    public Result apply(YearMonth now) {
        return apply(read("catalog/launch-prices.json"), now);
    }

    @Transactional
    public Result apply(JsonNode file, YearMonth now) {
        String version = file.path("version").asText("");
        List<String> applied = jdbc.queryForList("SELECT value FROM \"AppSetting\" WHERE key = ?", String.class, VERSION_KEY);
        if (version.isEmpty() || applied.contains(version)) {
            return new Result(version, false, 0, 0, 0, 0, List.of());
        }
        int modelsAdded = 0;
        int variantsAdded = 0;
        int variantsRepriced = 0;
        int variantsRemoved = 0;
        List<String> skipped = new ArrayList<>();
        for (JsonNode m : file.path("models")) {
            String brand = m.path("brandId").asText();
            String category = m.path("category").asText();
            String name = m.path("name").asText();
            YearMonth launched = YearMonth.parse(m.path("launched").asText());
            if (jdbc.queryForList("SELECT id FROM \"Brand\" WHERE id = ?", String.class, brand).isEmpty()) {
                skipped.add(name + " (no brand " + brand + ")");
                continue;
            }
            List<String> found = jdbc.queryForList(
                    "SELECT id FROM \"Model\" WHERE \"brandId\" = ? AND category = ? AND lower(name) = lower(?) ORDER BY id LIMIT 1",
                    String.class, brand, category, name);
            String modelId;
            if (!found.isEmpty()) {
                modelId = found.get(0);
            } else if (m.hasNonNull("img")) {
                modelId = m.hasNonNull("id") && jdbc.queryForList("SELECT id FROM \"Model\" WHERE id = ?", String.class,
                        m.get("id").asText()).isEmpty() ? m.get("id").asText() : Cuid.next();
                jdbc.update("INSERT INTO \"Model\" (id, \"brandId\", name, img, category, priority) VALUES (?, ?, ?, ?, ?, ?)",
                        modelId, brand, name, m.get("img").asText(), category, m.path("priority").asInt(100));
                modelsAdded++;
            } else {
                skipped.add(name + " (not in the catalog)"); // a re-pricing entry for a model this database does not have
                continue;
            }
            List<String> listed = new ArrayList<>();
            for (JsonNode v : m.path("variants")) {
                String variant = v.path("name").asText();
                listed.add(variant.toLowerCase(java.util.Locale.ROOT));
                long price = MaxValueRule.suggest(v.path("launchPrice").asDouble(), launched, category, brand, now).maxValue();
                List<String> existing = jdbc.queryForList(
                        "SELECT id FROM \"Variant\" WHERE \"modelId\" = ? AND lower(name) = lower(?)", String.class, modelId, variant);
                if (existing.isEmpty()) {
                    jdbc.update("INSERT INTO \"Variant\" (id, \"modelId\", name, \"basePrice\") VALUES (?, ?, ?, ?)",
                            Cuid.next(), modelId, variant, price);
                    variantsAdded++;
                } else {
                    variantsRepriced += jdbc.update("UPDATE \"Variant\" SET \"basePrice\" = ? WHERE id = ?", price, existing.get(0));
                }
            }
            // Placeholder variants the listed ones replace (orders keep the device name as text, so nothing points at them).
            for (JsonNode r : m.path("replaces")) {
                String placeholder = r.asText();
                if (!listed.isEmpty() && !listed.contains(placeholder.toLowerCase(java.util.Locale.ROOT))) {
                    variantsRemoved += jdbc.update("DELETE FROM \"Variant\" WHERE \"modelId\" = ? AND lower(name) = lower(?)", modelId, placeholder);
                }
            }
        }
        jdbc.update("INSERT INTO \"AppSetting\" (key, value, \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                VERSION_KEY, version, JsDates.nowUtc());
        Result result = new Result(version, true, modelsAdded, variantsAdded, variantsRepriced, variantsRemoved, skipped);
        LOG.info("[catalog] launch prices {}: {} models added, {} variants added, {} variants re-priced, {} placeholder variants removed{}",
                version, modelsAdded, variantsAdded, variantsRepriced, variantsRemoved, skipped.isEmpty() ? "" : "; skipped " + skipped);
        return result;
    }

    /** The bundled catalog/launch-prices.json. */
    public JsonNode bundled() {
        return read("catalog/launch-prices.json");
    }

    private JsonNode read(String path) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return mapper.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
