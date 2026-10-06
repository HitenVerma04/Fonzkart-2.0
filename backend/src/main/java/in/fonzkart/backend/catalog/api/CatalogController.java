package in.fonzkart.backend.catalog.api;

import in.fonzkart.backend.catalog.dto.BrandDto;
import in.fonzkart.backend.catalog.dto.ModelDto;
import in.fonzkart.backend.catalog.dto.VariantDto;
import in.fonzkart.backend.catalog.dto.VariantWithModelDto;
import in.fonzkart.backend.catalog.service.BrandCatalogService;
import in.fonzkart.backend.catalog.service.ModelCatalogService;
import in.fonzkart.backend.catalog.service.VariantCatalogService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only catalog API. Each endpoint mirrors an existing Next.js server function; like the originals,
 * these reads require no authentication.
 */
@RestController
@RequestMapping("/api/catalog")
public class CatalogController {

    private final BrandCatalogService brandService;
    private final ModelCatalogService modelService;
    private final VariantCatalogService variantService;

    public CatalogController(BrandCatalogService brandService, ModelCatalogService modelService,
                             VariantCatalogService variantService) {
        this.brandService = brandService;
        this.modelService = modelService;
        this.variantService = variantService;
    }

    /** actions/catalog.ts → fetchBrands(category?); actions/admin.ts → getBrands(); lib/store.ts → db.getBrands() */
    @GetMapping("/brands")
    public List<BrandDto> getBrands(@RequestParam(required = false) String category) {
        return brandService.getBrands(category);
    }

    /** lib/store.ts → db.getBrand(id). 404 where the original returns null. */
    @GetMapping("/brands/{id}")
    public ResponseEntity<BrandDto> getBrand(@PathVariable String id) {
        return ResponseEntity.of(brandService.getBrand(id));
    }

    /** actions/catalog.ts → fetchModels(brandId, category?); actions/admin.ts → getModels(brandId?) */
    @GetMapping("/models")
    public List<ModelDto> getModels(@RequestParam(required = false) String brandId,
                                    @RequestParam(required = false) String category) {
        return modelService.getModels(brandId, category);
    }

    /** actions/catalog.ts → searchGlobalModels(query) */
    @GetMapping("/models/search")
    public List<ModelDto> searchModels(@RequestParam(required = false) String query) {
        return modelService.searchGlobalModels(query);
    }

    /** actions/catalog.ts → fetchVariants(modelId); actions/admin.ts → getVariants(modelId?) */
    @GetMapping("/variants")
    public List<VariantDto> getVariants(@RequestParam(required = false) String modelId) {
        return variantService.getVariants(modelId);
    }

    /** actions/catalog.ts → findVariantByName(deviceName). 404 where the original returns null. */
    @GetMapping("/variants/lookup")
    public ResponseEntity<VariantWithModelDto> findVariantByName(@RequestParam String deviceName) {
        return ResponseEntity.of(variantService.findVariantByName(deviceName));
    }
}
