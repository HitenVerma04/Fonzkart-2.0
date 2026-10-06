package in.fonzkart.backend.catalog.rules;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.catalog.dto.ModelDto;
import in.fonzkart.backend.catalog.staticdata.CatalogStaticData;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Parity tests: expected values were produced by running the ORIGINAL TypeScript helpers in
 * lib/catalog2026.ts and the sort comparator from lib/store.ts under Node.js
 * (fixture: src/test/resources/golden/golden-catalog-rules.json).
 */
class CatalogRulesGoldenTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static JsonNode golden;
    private static CatalogModelRules rules;

    @BeforeAll
    static void load() throws IOException {
        try (InputStream in = CatalogRulesGoldenTest.class.getResourceAsStream("/golden/golden-catalog-rules.json")) {
            golden = MAPPER.readTree(in);
        }
        rules = new CatalogModelRules(new CatalogStaticData(MAPPER));
    }

    @Test
    void canonicalModelKeyMatchesTypeScript() {
        assertThat(golden.get("canonicalKeys")).isNotEmpty();
        for (JsonNode c : golden.get("canonicalKeys")) {
            String input = c.get("input").asText();
            assertThat(CatalogModelRules.canonicalModelKey(input))
                    .as("getCanonicalModelKey(%s)", input)
                    .isEqualTo(c.get("expected").asText());
        }
    }

    @Test
    void resolveModelImageMatchesTypeScript() {
        assertThat(golden.get("resolveImage")).isNotEmpty();
        for (JsonNode c : golden.get("resolveImage")) {
            String img = c.get("img").isNull() ? null : c.get("img").asText();
            assertThat(rules.resolveModelImage(c.get("brandId").asText(), c.get("name").asText(), img))
                    .as("resolveModelImage(%s, %s, %s)", c.get("brandId"), c.get("name"), c.get("img"))
                    .isEqualTo(c.get("expected").asText());
        }
    }

    @Test
    void deduplicateModelsMatchesTypeScript() throws IOException {
        assertThat(golden.get("dedupe")).isNotEmpty();
        for (JsonNode c : golden.get("dedupe")) {
            List<ModelDto> input = toModels(c.get("input"));
            List<ModelDto> expected = toModels(c.get("expected"));
            assertThat(rules.deduplicateModels(input)).containsExactlyElementsOf(expected);
        }
    }

    @Test
    void priorityThenNameOrderingMatchesJavaScriptLocaleCompare() {
        record Item(String id, String name, Integer priority) {
        }
        assertThat(golden.get("sorting")).isNotEmpty();
        for (JsonNode c : golden.get("sorting")) {
            List<Item> items = new ArrayList<>();
            for (JsonNode i : c.get("input")) {
                items.add(new Item(i.get("id").asText(), i.get("name").asText(), i.get("priority").asInt()));
            }
            items.sort(CatalogOrdering.byPriorityThenName(Item::priority, Item::name));

            List<String> expectedIds = new ArrayList<>();
            c.get("expectedIds").forEach(id -> expectedIds.add(id.asText()));
            assertThat(items.stream().map(Item::id).toList()).containsExactlyElementsOf(expectedIds);
        }
    }

    private static List<ModelDto> toModels(JsonNode array) throws IOException {
        return MAPPER.readerForListOf(ModelDto.class).readValue(array);
    }
}
