package in.fonzkart.backend.pricing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.shared.time.JsDates;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Applies catalog/model-images.json once per version: a model gets its listed picture only while its picture is still
 * one the file names in "replaces" (a phone photo standing in for a watch, a path with no file behind it) or none the
 * catalog would show (empty, a logo: the catalog then shows the brand's flagship phone), and a brand its listed logo
 * the same way. Every copy of the model is fixed. A photo an admin sets afterwards is never overwritten.
 */
@Service
public class CatalogImageFix {

    /** "AppSetting" key holding the version of model-images.json last applied. */
    public static final String VERSION_KEY = "catalog.modelImages.version";
    private static final Logger LOG = LoggerFactory.getLogger(CatalogImageFix.class);
    /**
     * A stored picture the catalog does not show as a photo (CatalogModelRules.resolveModelImage): none, an SVG, a
     * logo. The catalog shows the brand's flagship phone instead, so these count as wrong pictures too.
     */
    static final String NO_PHOTO = "img IS NULL OR trim(img) = '' OR img LIKE '%.svg%' OR img LIKE '%wikimedia%' "
            + "OR img LIKE '%Wikipedia%' OR img LIKE '%Logo%' OR img LIKE '%logo.png%'";

    /** What one run did. */
    public record Result(String version, boolean applied, int modelsUpdated, int brandsUpdated) {
    }

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public CatalogImageFix(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    /** Applies the bundled file. */
    @Transactional
    public Result apply() {
        return apply(read());
    }

    @Transactional
    public Result apply(JsonNode file) {
        String version = file.path("version").asText("");
        List<String> applied = jdbc.queryForList("SELECT value FROM \"AppSetting\" WHERE key = ?", String.class, VERSION_KEY);
        if (version.isEmpty() || applied.contains(version)) {
            return new Result(version, false, 0, 0);
        }
        int models = 0;
        for (JsonNode m : file.path("models")) {
            List<String> replaces = texts(m.path("replaces"));
            if (replaces.isEmpty()) {
                continue;
            }
            List<String> categories = LaunchPriceImport.aliases(m.path("category").asText());
            List<Object> args = new ArrayList<>();
            args.add(m.path("img").asText());
            args.add(m.path("brandId").asText());
            args.addAll(categories);
            args.add(m.path("name").asText());
            args.addAll(replaces);
            models += jdbc.update("UPDATE \"Model\" SET img = ? WHERE \"brandId\" = ? AND lower(category) IN (" + marks(categories.size())
                    + ") AND lower(trim(name)) = lower(trim(?)) AND (img IN (" + marks(replaces.size()) + ") OR " + NO_PHOTO + ")",
                    args.toArray());
        }
        int brands = 0;
        for (JsonNode b : file.path("brands")) {
            List<String> replaces = texts(b.path("replaces"));
            if (replaces.isEmpty()) {
                continue;
            }
            List<Object> args = new ArrayList<>();
            args.add(b.path("logo").asText());
            args.add(b.path("id").asText());
            args.addAll(replaces);
            brands += jdbc.update("UPDATE \"Brand\" SET logo = ? WHERE id = ? AND logo IN (" + marks(replaces.size()) + ")", args.toArray());
        }
        jdbc.update("INSERT INTO \"AppSetting\" (key, value, \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                VERSION_KEY, version, JsDates.nowUtc());
        LOG.info("[catalog] model pictures {}: {} models and {} brands updated", version, models, brands);
        return new Result(version, true, models, brands);
    }

    private static List<String> texts(JsonNode array) {
        List<String> out = new ArrayList<>();
        for (JsonNode n : array) {
            out.add(n.asText());
        }
        return out;
    }

    private static String marks(int n) {
        return String.join(", ", java.util.Collections.nCopies(n, "?"));
    }

    private JsonNode read() {
        try (InputStream in = new ClassPathResource("catalog/model-images.json").getInputStream()) {
            return mapper.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
