package in.fonzkart.backend.catalog.staticdata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * Drift guard: catalog-2026.json must stay in sync with lib/catalog2026.ts while the Next.js app still owns it.
 * Compares every model id and variant id (in order). Skipped when the TypeScript source is not available.
 * If this fails, regenerate the JSON as described in backend/README.md.
 */
class Catalog2026SyncTest {

    private static final Path TS_SOURCE = Path.of("..", "lib", "catalog2026.ts");
    private static final Pattern ID = Pattern.compile("\\bid:\\s*'([^']+)'");

    @Test
    void jsonMatchesTypeScriptSource() throws IOException {
        assumeTrue(Files.exists(TS_SOURCE), "lib/catalog2026.ts not found; skipping drift check");

        String ts = Files.readString(TS_SOURCE);
        String catalogBody = ts.substring(ts.indexOf("CATALOG_2026_MODELS"), ts.indexOf("export function get2026ModelsForBrand"));
        List<String> tsIds = new ArrayList<>();
        Matcher m = ID.matcher(catalogBody);
        while (m.find()) {
            tsIds.add(m.group(1));
        }

        List<String> jsonIds = new ArrayList<>();
        for (CatalogStaticData.CatalogModel2026 model : new CatalogStaticData(new ObjectMapper()).catalog2026Models()) {
            jsonIds.add(model.id());
            model.variants().forEach(v -> jsonIds.add(v.id()));
        }

        assertThat(jsonIds).as("model/variant ids in catalog-2026.json vs lib/catalog2026.ts")
                .containsExactlyElementsOf(tsIds);
    }
}
