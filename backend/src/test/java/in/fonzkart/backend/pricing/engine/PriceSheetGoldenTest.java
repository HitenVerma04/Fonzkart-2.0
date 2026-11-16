package in.fonzkart.backend.pricing.engine;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.File;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * golden/price-sheet-cases.json: sheets and answers with the offer each must give. The phone prices with the same
 * file (mobile/packages/core/src/priceSheet.test.ts), so the live price on the phone and the booked price agree.
 * {@code -Dgolden.write=true} rewrites the expected prices from this implementation (after a deliberate change).
 */
class PriceSheetGoldenTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void everyCaseGivesItsPrice() throws Exception {
        JsonNode file;
        try (InputStream in = getClass().getResourceAsStream("/golden/price-sheet-cases.json")) {
            file = mapper.readTree(in);
        }
        List<String> mismatches = new ArrayList<>();
        for (JsonNode c : file.get("cases")) {
            PriceSheet sheet = mapper.treeToValue(file.get("sheets").get(c.get("sheet").asText()), PriceSheet.class);
            long price = SheetPricer.price(sheet, c.get("answers")).price();
            if (Boolean.getBoolean("golden.write")) {
                ((ObjectNode) c).put("price", price);
            } else if (c.get("price").asLong() != price) {
                mismatches.add(c.get("name").asText() + ": expected " + c.get("price").asLong() + ", got " + price);
            }
        }
        if (Boolean.getBoolean("golden.write")) {
            mapper.writerWithDefaultPrettyPrinter().writeValue(new File("src/test/resources/golden/price-sheet-cases.json"), file);
        }
        assertThat(mismatches).isEmpty();
        assertThat(((ArrayNode) file.get("cases")).size()).isGreaterThan(10);
    }
}
