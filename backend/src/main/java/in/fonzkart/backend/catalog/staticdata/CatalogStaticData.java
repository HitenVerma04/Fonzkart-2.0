package in.fonzkart.backend.catalog.staticdata;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.catalog.dto.BrandDto;
import in.fonzkart.backend.catalog.dto.ModelDto;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Static catalog data that the Next.js app keeps in code and merges with database rows at read time:
 * <ul>
 *   <li>{@code catalog/catalog-2026.json} — generated verbatim from lib/catalog2026.ts → CATALOG_2026_MODELS</li>
 *   <li>{@code catalog/brand-default-images.json} — lib/catalog2026.ts → BRAND_DEFAULT_IMAGES</li>
 *   <li>{@code catalog/default-core-brands.json} — lib/store.ts → getBrands() → DEFAULT_CORE_BRANDS</li>
 * </ul>
 * If the TypeScript sources change, these files must be regenerated (see backend/README.md).
 */
@Component
public class CatalogStaticData {

    public record CatalogVariant2026(String id, String name, Integer basePrice) {
    }

    public record CatalogModel2026(String id, String brandId, String name, String img, String category,
                                   Integer priority, List<CatalogVariant2026> variants) {

        /** The model without variants, as merged into getModels()/searchModels() results. */
        public ModelDto toModelDto() {
            return new ModelDto(id, brandId, name, img, category, priority);
        }
    }

    private final List<CatalogModel2026> catalog2026Models;
    private final Map<String, String> brandDefaultImages;
    private final List<BrandDto> defaultCoreBrands;

    public CatalogStaticData(ObjectMapper objectMapper) {
        this.catalog2026Models = Collections.unmodifiableList(
                read(objectMapper, "catalog/catalog-2026.json", new TypeReference<List<CatalogModel2026>>() {
                }));
        this.brandDefaultImages = Collections.unmodifiableMap(
                read(objectMapper, "catalog/brand-default-images.json", new TypeReference<LinkedHashMap<String, String>>() {
                }));
        this.defaultCoreBrands = Collections.unmodifiableList(
                read(objectMapper, "catalog/default-core-brands.json", new TypeReference<List<BrandDto>>() {
                }));
    }

    public List<CatalogModel2026> catalog2026Models() {
        return catalog2026Models;
    }

    public Map<String, String> brandDefaultImages() {
        return brandDefaultImages;
    }

    public List<BrandDto> defaultCoreBrands() {
        return defaultCoreBrands;
    }

    private static <T> T read(ObjectMapper objectMapper, String path, TypeReference<T> type) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return objectMapper.readValue(in, type);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to load static catalog data: " + path, e);
        }
    }
}
