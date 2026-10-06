package in.fonzkart.backend.catalog.service;

import static in.fonzkart.backend.shared.text.JsText.lower;
import static in.fonzkart.backend.shared.text.JsText.trim;
import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.catalog.dto.ModelDto;
import in.fonzkart.backend.catalog.entity.DeviceModel;
import in.fonzkart.backend.catalog.repository.DeviceModelRepository;
import in.fonzkart.backend.catalog.rules.CatalogModelRules;
import in.fonzkart.backend.catalog.rules.CatalogOrdering;
import in.fonzkart.backend.catalog.rules.CategoryAliases;
import in.fonzkart.backend.catalog.staticdata.CatalogStaticData;
import in.fonzkart.backend.catalog.staticdata.CatalogStaticData.CatalogModel2026;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

/** Port of lib/store.ts → db.getModels() and db.searchModels(). */
@Service
public class ModelCatalogService {

    private static final Logger log = LoggerFactory.getLogger(ModelCatalogService.class);

    private static final Sort PRIORITY_THEN_NAME = Sort.by(Sort.Order.asc("priority"), Sort.Order.asc("name"));

    private final DeviceModelRepository modelRepository;
    private final CatalogStaticData staticData;
    private final CatalogModelRules rules;

    public ModelCatalogService(DeviceModelRepository modelRepository, CatalogStaticData staticData,
                               CatalogModelRules rules) {
        this.modelRepository = modelRepository;
        this.staticData = staticData;
        this.rules = rules;
    }

    /**
     * db.getModels(brandId?, category?) — DB models merged with the 2026 catalog, de-duplicated and sorted.
     * <p>
     * Deliberate difference: the original also starts a fire-and-forget background task that INSERTs
     * missing 2026 catalog models/brands/variants into the database during this read. This backend is
     * read-only for the catalog (single-writer rule), so that side effect is not performed here.
     * The returned data is the same, because 2026 catalog models are merged into the response either way.
     */
    public List<ModelDto> getModels(String brandId, String category) {
        List<ModelDto> dbModels = new ArrayList<>();
        try {
            Specification<DeviceModel> spec = (root, query, cb) -> cb.conjunction();
            if (truthy(brandId)) {
                spec = spec.and((root, query, cb) -> cb.equal(root.get("brandId"), brandId));
            }
            if (truthy(category)) {
                List<String> allowed = CategoryAliases.modelCategories(lower(category));
                spec = allowed.size() == 1
                        ? spec.and((root, query, cb) -> cb.equal(root.get("category"), allowed.get(0)))
                        : spec.and((root, query, cb) -> root.get("category").in(allowed));
            }
            dbModels = modelRepository.findAll(spec, PRIORITY_THEN_NAME).stream().map(ModelDto::from).toList();
        } catch (RuntimeException e) {
            log.error("DB getModels error, using fallback catalog:", e);
        }

        // 2026 catalog models for this brand/category (lib/catalog2026.ts → get2026ModelsForBrand)
        List<CatalogModel2026> models2026 = get2026ModelsForBrand(brandId, category);

        // Map existing DB models to their 2026 catalog image when the DB image is missing/a logo.
        // new Map(entries): later duplicate keys overwrite earlier ones.
        Map<String, String> catalogMap = new HashMap<>();
        for (CatalogModel2026 m : staticData.catalog2026Models()) {
            catalogMap.put(CatalogModelRules.modelIdentityKey(m.brandId(), m.name()), m.img());
        }
        List<ModelDto> updatedDbModels = new ArrayList<>();
        for (ModelDto m : dbModels) {
            String catalogImg = catalogMap.get(CatalogModelRules.modelIdentityKey(m.brandId(), m.name()));
            if (truthy(catalogImg) && (!truthy(m.img()) || m.img().endsWith(".svg")
                    || m.img().contains("wikimedia") || m.img().contains("Logo"))) {
                updatedDbModels.add(m.withImg(catalogImg));
            } else {
                updatedDbModels.add(m);
            }
        }

        List<ModelDto> combined = new ArrayList<>();
        for (CatalogModel2026 m : models2026) {
            combined.add(m.toModelDto());
        }
        combined.addAll(updatedDbModels);

        List<ModelDto> deduplicated = rules.deduplicateModels(combined);
        deduplicated.sort(CatalogOrdering.byPriorityThenName(ModelDto::priority, ModelDto::name));
        return deduplicated;
    }

    /** actions/catalog.ts → searchGlobalModels(query): queries shorter than 2 characters return no results. */
    public List<ModelDto> searchGlobalModels(String query) {
        if (query == null || query.length() < 2) {
            return List.of();
        }
        return searchModels(query);
    }

    /** db.searchModels(query) — top 10 DB matches merged with 2026 catalog matches. */
    public List<ModelDto> searchModels(String query) {
        List<ModelDto> dbResults = new ArrayList<>();
        try {
            dbResults = modelRepository.searchByNameTop10("%" + query + "%")
                    .stream().map(ModelDto::from).toList();
        } catch (RuntimeException e) {
            log.error("DB searchModels error:", e);
        }

        String lowerQuery = trim(lower(query));
        List<ModelDto> combined = new ArrayList<>();
        for (CatalogModel2026 m : staticData.catalog2026Models()) {
            if (lower(m.name()).contains(lowerQuery)) {
                combined.add(m.toModelDto());
            }
        }
        combined.addAll(dbResults);

        List<ModelDto> deduplicated = rules.deduplicateModels(combined);
        deduplicated.sort(CatalogOrdering.byPriorityThenName(ModelDto::priority, ModelDto::name));
        return deduplicated.size() > 10 ? new ArrayList<>(deduplicated.subList(0, 10)) : deduplicated;
    }

    /** lib/catalog2026.ts → get2026ModelsForBrand(brandId?, category?) */
    List<CatalogModel2026> get2026ModelsForBrand(String brandId, String category) {
        List<CatalogModel2026> result = new ArrayList<>();
        for (CatalogModel2026 m : staticData.catalog2026Models()) {
            if (truthy(brandId) && !m.brandId().equals(brandId)) {
                continue;
            }
            if (truthy(category) && !category.equals("smartphone") && !category.equals("mobile")) {
                continue;
            }
            result.add(m);
        }
        return result;
    }
}
