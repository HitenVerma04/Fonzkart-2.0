package in.fonzkart.backend.catalog.api;

import in.fonzkart.backend.auth.session.SessionService;
import in.fonzkart.backend.catalog.service.BannerPriceService;
import in.fonzkart.backend.catalog.service.BannerPriceService.BannerPrice;
import in.fonzkart.backend.catalog.service.CatalogAdminService;
import in.fonzkart.backend.catalog.service.CatalogAdminService.ModelPriority;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Catalog and landing-page editing (actions/admin.ts): brands, models, variants and the banner's display prices.
 * Administrators only, except reading the banner prices, which the home page shows to everyone.
 */
@RestController
public class CatalogAdminController {

    public record BrandRequest(String name, String logo, String category, Integer priority) {
    }

    public record ModelRequest(String brandId, String name, String img, String category, Integer priority) {
    }

    public record VariantRequest(String modelId, String name, Integer basePrice) {
    }

    public record BannerPriceRequest(String displayPrice, String categoryKey, String categoryName) {
    }

    private final CatalogAdminService catalog;
    private final BannerPriceService banner;
    private final SessionService sessions;

    public CatalogAdminController(CatalogAdminService catalog, BannerPriceService banner, SessionService sessions) {
        this.catalog = catalog;
        this.banner = banner;
        this.sessions = sessions;
    }

    // ---- brands
    @PostMapping("/api/catalog/admin/brands")
    public Map<String, Object> addBrand(HttpServletRequest request, @RequestBody BrandRequest r) {
        return catalog.addBrand(sessions.getSession(request), r.name(), r.logo(), r.category(), r.priority());
    }

    @PutMapping("/api/catalog/admin/brands/{id}")
    public Map<String, Object> updateBrand(HttpServletRequest request, @PathVariable String id, @RequestBody BrandRequest r) {
        return catalog.updateBrand(sessions.getSession(request), id, r.name(), r.logo(), r.priority());
    }

    @DeleteMapping("/api/catalog/admin/brands/{id}")
    public Map<String, Object> deleteBrand(HttpServletRequest request, @PathVariable String id,
                                           @RequestParam(required = false) String category) {
        return catalog.deleteBrand(sessions.getSession(request), id, category);
    }

    // ---- models
    @PostMapping("/api/catalog/admin/models")
    public Map<String, Object> addModel(HttpServletRequest request, @RequestBody ModelRequest r) {
        return catalog.addModel(sessions.getSession(request), r.brandId(), r.name(), r.img(), r.category(), r.priority());
    }

    @PutMapping("/api/catalog/admin/models/{id}")
    public Map<String, Object> updateModel(HttpServletRequest request, @PathVariable String id, @RequestBody ModelRequest r) {
        return catalog.updateModel(sessions.getSession(request), id, r.brandId(), r.name(), r.img(), r.category(), r.priority());
    }

    /** reorderModels(items): body {@code [{id, priority}]} */
    @PutMapping("/api/catalog/admin/models/order")
    public Map<String, Object> reorderModels(HttpServletRequest request, @RequestBody List<ModelPriority> items) {
        return catalog.reorderModels(sessions.getSession(request), items);
    }

    @DeleteMapping("/api/catalog/admin/models/{id}")
    public Map<String, Object> deleteModel(HttpServletRequest request, @PathVariable String id) {
        return catalog.deleteModel(sessions.getSession(request), id);
    }

    // ---- variants
    @PostMapping("/api/catalog/admin/variants")
    public Map<String, Object> addVariant(HttpServletRequest request, @RequestBody VariantRequest r) {
        return catalog.addVariant(sessions.getSession(request), r.modelId(), r.name(), r.basePrice());
    }

    @PutMapping("/api/catalog/admin/variants/{id}")
    public Map<String, Object> updateVariant(HttpServletRequest request, @PathVariable String id, @RequestBody VariantRequest r) {
        return catalog.updateVariant(sessions.getSession(request), id, r.modelId(), r.name(), r.basePrice());
    }

    @DeleteMapping("/api/catalog/admin/variants/{id}")
    public Map<String, Object> deleteVariant(HttpServletRequest request, @PathVariable String id) {
        return catalog.deleteVariant(sessions.getSession(request), id);
    }

    // ---- banner display prices (landing page)
    /** The home page banner's prices (public, as on the home page). */
    @GetMapping("/api/content/banner-prices")
    public List<BannerPrice> bannerPrices() {
        return banner.all();
    }

    /** getDeviceDisplayPrices() (admin page) */
    @GetMapping("/api/content/banner-prices/admin")
    public List<BannerPrice> bannerPricesForAdmin(HttpServletRequest request) {
        return banner.forAdmin(sessions.getSession(request));
    }

    /** updateDeviceDisplayPrice(id, displayPrice, categoryKey?, categoryName?) */
    @PutMapping("/api/content/banner-prices/{identifier}")
    public Map<String, Object> saveBannerPrice(HttpServletRequest request, @PathVariable String identifier,
                                               @RequestBody BannerPriceRequest r) {
        return banner.save(sessions.getSession(request), identifier, r.displayPrice(), r.categoryKey(), r.categoryName());
    }
}
