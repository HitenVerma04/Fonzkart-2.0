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
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
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
 * A listed model matches every catalog model of that brand and name under any name of its category (watch /
 * smartwatch...). Nothing else is touched, a version already applied is skipped, and a price an admin set by hand
 * (the pricing engine's "manual" mode) is kept even by a new version, so later edits by the admins stay.
 */
@Service
public class LaunchPriceImport {

    /** "AppSetting" key holding the version of launch-prices.json last applied. */
    public static final String VERSION_KEY = "catalog.launchPrices.version";
    /** "AppSetting" key holding what the last applied version did (JSON of {@link Result}). */
    public static final String RESULT_KEY = "catalog.launchPrices.lastResult";
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
        Set<String> pinned = pinnedVariants();
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
            // Every catalog model of that name: the catalog keeps a category under more than one name (watch /
            // smartwatch, tv / smarttv) and may hold the same model twice; pricing only one of them left the other at
            // its old price.
            List<String> found = jdbc.queryForList(
                    "SELECT id FROM \"Model\" WHERE \"brandId\" = ? AND lower(category) IN (" + placeholders(aliases(category).size())
                            + ") AND lower(trim(name)) = lower(trim(?)) ORDER BY id",
                    String.class, params(brand, aliases(category), name));
            List<String> modelIds = new ArrayList<>(found);
            if (modelIds.isEmpty()) {
                if (!m.hasNonNull("img")) {
                    skipped.add(name + " (not in the catalog)"); // a re-pricing entry for a model this database does not have
                    continue;
                }
                String modelId = m.hasNonNull("id") && jdbc.queryForList("SELECT id FROM \"Model\" WHERE id = ?", String.class,
                        m.get("id").asText()).isEmpty() ? m.get("id").asText() : Cuid.next();
                jdbc.update("INSERT INTO \"Model\" (id, \"brandId\", name, img, category, priority) VALUES (?, ?, ?, ?, ?, ?)",
                        modelId, brand, name, m.get("img").asText(), category, m.path("priority").asInt(100));
                modelIds.add(modelId);
                modelsAdded++;
            }
            for (String modelId : modelIds) {
                List<String> listed = new ArrayList<>();
                for (JsonNode v : m.path("variants")) {
                    String variant = v.path("name").asText();
                    listed.add(variant.toLowerCase(Locale.ROOT));
                    long price = MaxValueRule.suggest(v.path("launchPrice").asDouble(), launched, category, brand, now).maxValue();
                    List<String> existing = jdbc.queryForList(
                            "SELECT id FROM \"Variant\" WHERE \"modelId\" = ? AND lower(trim(name)) = lower(trim(?))", String.class, modelId, variant);
                    if (existing.isEmpty()) {
                        jdbc.update("INSERT INTO \"Variant\" (id, \"modelId\", name, \"basePrice\") VALUES (?, ?, ?, ?)",
                                Cuid.next(), modelId, variant, price);
                        variantsAdded++;
                    }
                    for (String variantId : existing) {
                        if (pinned.contains(variantId)) {
                            continue; // an admin set this price by hand: it stays
                        }
                        variantsRepriced += jdbc.update("UPDATE \"Variant\" SET \"basePrice\" = ? WHERE id = ?", price, variantId);
                    }
                }
                // Placeholder variants the listed ones replace (orders keep the device name as text, so nothing points at them).
                for (JsonNode r : m.path("replaces")) {
                    String placeholder = r.asText();
                    if (!listed.isEmpty() && !listed.contains(placeholder.toLowerCase(Locale.ROOT))) {
                        variantsRemoved += jdbc.update("DELETE FROM \"Variant\" WHERE \"modelId\" = ? AND lower(name) = lower(?)", modelId, placeholder);
                    }
                }
            }
        }
        Result result = new Result(version, true, modelsAdded, variantsAdded, variantsRepriced, variantsRemoved, skipped);
        saveSetting(VERSION_KEY, version);
        try {
            // What the last run did, for anyone checking without the server logs.
            saveSetting(RESULT_KEY, mapper.writeValueAsString(result));
        } catch (IOException e) {
            LOG.warn("[catalog] launch price result not recorded", e);
        }
        LOG.info("[catalog] launch prices {}: {} models added, {} variants added, {} variants re-priced, {} placeholder variants removed{}",
                version, modelsAdded, variantsAdded, variantsRepriced, variantsRemoved, skipped.isEmpty() ? "" : "; skipped " + skipped);
        return result;
    }

    /** The category names the catalog may store a category under (as the catalog API reads them). */
    static List<String> aliases(String category) {
        String c = category == null ? "" : category.trim().toLowerCase(Locale.ROOT);
        return switch (c) {
            case "smartphone", "mobile" -> List.of("smartphone", "mobile");
            case "watch", "smartwatch" -> List.of("watch", "smartwatch");
            case "tablet", "ipad" -> List.of("tablet", "ipad");
            case "smarttv", "tv" -> List.of("smarttv", "tv");
            default -> List.of(c);
        };
    }

    private static String placeholders(int n) {
        return String.join(", ", java.util.Collections.nCopies(n, "?"));
    }

    private static Object[] params(String brand, List<String> categories, String name) {
        List<Object> all = new ArrayList<>();
        all.add(brand);
        all.addAll(categories);
        all.add(name);
        return all.toArray();
    }

    /** Variants whose price an admin set by hand (the pricing engine's "manual" mode); none before its table exists. */
    private Set<String> pinnedVariants() {
        // Checked first rather than caught: a failed statement would abort the import's transaction.
        Boolean exists = jdbc.queryForObject("SELECT to_regclass('\"VariantPricing\"') IS NOT NULL", Boolean.class);
        if (!Boolean.TRUE.equals(exists)) {
            return Set.of();
        }
        return new HashSet<>(jdbc.queryForList("SELECT \"variantId\" FROM \"VariantPricing\" WHERE mode = 'manual'", String.class));
    }

    private void saveSetting(String key, String value) {
        jdbc.update("INSERT INTO \"AppSetting\" (key, value, \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                key, value, JsDates.nowUtc());
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
