package in.fonzkart.backend.catalog.api;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import in.fonzkart.backend.catalog.dto.BrandDto;
import in.fonzkart.backend.catalog.service.BrandCatalogService;
import in.fonzkart.backend.catalog.service.ModelCatalogService;
import in.fonzkart.backend.catalog.service.VariantCatalogService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CatalogController.class)
class CatalogControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private BrandCatalogService brandService;
    @MockitoBean
    private ModelCatalogService modelService;
    @MockitoBean
    private VariantCatalogService variantService;

    @Test
    void brandsReturnPrismaShapedJson() throws Exception {
        when(brandService.getBrands("tv")).thenReturn(List.of(
                new BrandDto("samsung", "Samsung", "logo.svg", List.of("tv"), 2)));

        mvc.perform(get("/api/catalog/brands").param("category", "tv"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("samsung"))
                .andExpect(jsonPath("$[0].categories[0]").value("tv"))
                .andExpect(jsonPath("$[0].priority").value(2));
    }

    @Test
    void unknownBrandIs404() throws Exception {
        when(brandService.getBrand("nope")).thenReturn(Optional.empty());
        mvc.perform(get("/api/catalog/brands/nope")).andExpect(status().isNotFound());
    }

    @Test
    void modelsPassBrandAndCategoryThrough() throws Exception {
        when(modelService.getModels("apple", "tablet")).thenReturn(List.of());
        mvc.perform(get("/api/catalog/models").param("brandId", "apple").param("category", "tablet"))
                .andExpect(status().isOk());
        verify(modelService).getModels("apple", "tablet");
    }

    @Test
    void variantLookupMissIs404() throws Exception {
        when(variantService.findVariantByName("x (y)")).thenReturn(Optional.empty());
        mvc.perform(get("/api/catalog/variants/lookup").param("deviceName", "x (y)"))
                .andExpect(status().isNotFound());
    }
}
