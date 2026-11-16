package in.fonzkart.backend.pricing.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class CatalogChecksTest {

    private static CatalogChecks.Item v(String id, String variant, Integer price, String modelId, String model, String brand, String cat) {
        return new CatalogChecks.Item(id, variant, price, modelId, model, brand, cat, null, null, false);
    }

    private static List<CatalogChecks.Finding> run(List<CatalogChecks.Item> items) {
        return CatalogChecks.run(items, (p, m, c, b) -> 50000L);
    }

    @Test
    void biggerStoragePricedBelowSmaller() {
        List<CatalogChecks.Finding> f = run(List.of(
                v("a", "128GB", 40000, "m", "iPhone 15", "apple", "smartphone"),
                v("b", "256GB", 38000, "m", "iPhone 15", "apple", "smartphone")));
        assertThat(f).extracting(CatalogChecks.Finding::check).containsExactly("storage");
        assertThat(f.get(0).variantId()).isEqualTo("b");
        assertThat(f.get(0).suggested()).isEqualTo(41600);
    }

    @Test
    void wifiTabletAboveItsCellularModel() {
        List<CatalogChecks.Finding> f = run(List.of(
                v("w", "8GB/128GB", 30000, "mw", "Galaxy Tab S10 FE Plus WiFi Only", "samsung", "tablet"),
                v("c", "8GB/128GB", 27000, "mc", "Galaxy Tab S10 FE Plus 5G", "samsung", "tablet")));
        assertThat(f).extracting(CatalogChecks.Finding::check).containsExactly("connectivity");
        assertThat(f.get(0).variantId()).isEqualTo("c");
        assertThat(f.get(0).suggested()).isEqualTo(32400);
    }

    @Test
    void proBelowBaseAndNewerBelowOlder() {
        List<CatalogChecks.Finding> f = run(List.of(
                v("a", "128GB", 42000, "i15", "iPhone 15", "apple", "smartphone"),
                v("b", "128GB", 39000, "i15p", "iPhone 15 Pro", "apple", "smartphone"),
                v("c", "128GB", 36000, "i16", "iPhone 16", "apple", "smartphone")));
        assertThat(f).extracting(CatalogChecks.Finding::key).contains("ladder:i15p", "generation:i16");
    }

    @Test
    void sideModelsAreNotOnTheLadder() {
        List<CatalogChecks.Finding> f = run(List.of(
                v("a", "128GB", 42000, "s24", "Galaxy S24", "samsung", "smartphone"),
                v("b", "128GB", 30000, "s24fe", "Galaxy S24 FE", "samsung", "smartphone"),
                v("c", "128GB", 30000, "i16e", "iPhone 16e", "apple", "smartphone"),
                v("d", "128GB", 45000, "i16", "iPhone 16", "apple", "smartphone")));
        assertThat(f).isEmpty();
    }

    @Test
    void placeholderPricesAndUnpricedVariants() {
        List<CatalogChecks.Item> items = new ArrayList<>();
        for (String m : List.of("Nothing Phone 4a", "Nothing Phone 4a Pro", "CMF Phone 1", "CMF Phone 2 Pro")) {
            items.add(v(m, "8GB/128GB", 15000, m, m, "nothing", "smartphone"));
        }
        items.add(v("l1", "i5 16GB", null, "lap", "ThinkPad E14", "lenovo", "laptop"));
        List<CatalogChecks.Finding> f = run(items);
        assertThat(f).extracting(CatalogChecks.Finding::check).contains("placeholder", "unpriced");
    }

    @Test
    void farFromTheLaunchRule() {
        CatalogChecks.Item item = new CatalogChecks.Item("x", "256GB", 90000, "m", "Galaxy S25", "samsung", "smartphone",
                80999L, "2025-01", true);
        List<CatalogChecks.Finding> f = CatalogChecks.run(List.of(item), (p, m, c, b) -> 50000L);
        assertThat(f).extracting(CatalogChecks.Finding::check).containsExactly("launch");
        assertThat(f.get(0).suggested()).isEqualTo(50000);
    }

    @Test
    void parsing() {
        assertThat(CatalogChecks.storageGb("12GB/256GB")).isEqualTo(256);
        assertThat(CatalogChecks.storageGb("1TB")).isEqualTo(1024);
        assertThat(CatalogChecks.link("Galaxy Tab S10 FE Plus WiFi Only")).isEqualTo("wifi");
        assertThat(CatalogChecks.link("iPad Air (WiFi + Cellular)")).isEqualTo("cell");
        assertThat(CatalogChecks.stripLink("Galaxy Tab S10 FE Plus WiFi Only")).isEqualTo("galaxy tab s10 fe plus");
    }
}
