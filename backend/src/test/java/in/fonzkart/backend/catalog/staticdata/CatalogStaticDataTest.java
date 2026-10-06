package in.fonzkart.backend.catalog.staticdata;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.catalog.dto.BrandDto;
import org.junit.jupiter.api.Test;

class CatalogStaticDataTest {

    private final CatalogStaticData data = new CatalogStaticData(new ObjectMapper());

    @Test
    void loadsCatalog2026ExactlyAsGeneratedFromTypeScript() {
        assertThat(data.catalog2026Models()).hasSize(66);
        var first = data.catalog2026Models().get(0);
        assertThat(first.id()).isEqualTo("galaxy-s26-ultra-5g");
        assertThat(first.brandId()).isEqualTo("samsung");
        assertThat(first.priority()).isEqualTo(10);
        assertThat(first.variants()).extracting(CatalogStaticData.CatalogVariant2026::basePrice)
                .containsExactly(78540, 82500);
    }

    @Test
    void loadsDefaultCoreBrandsFromLibStore() {
        assertThat(data.defaultCoreBrands()).extracting(BrandDto::id).containsExactly(
                "apple", "samsung", "xiaomi", "vivo", "oneplus", "realme", "poco", "oppo", "google",
                "motorola", "nothing", "iqoo");
        assertThat(data.defaultCoreBrands()).extracting(BrandDto::priority)
                .containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
    }

    @Test
    void loadsBrandDefaultImages() {
        assertThat(data.brandDefaultImages()).hasSize(11).containsKey("samsung").containsKey("google");
    }
}
