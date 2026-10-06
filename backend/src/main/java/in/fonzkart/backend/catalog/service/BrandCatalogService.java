package in.fonzkart.backend.catalog.service;

import static in.fonzkart.backend.shared.text.JsText.lower;
import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.catalog.dto.BrandDto;
import in.fonzkart.backend.catalog.repository.BrandRepository;
import in.fonzkart.backend.catalog.rules.CatalogOrdering;
import in.fonzkart.backend.catalog.rules.CategoryAliases;
import in.fonzkart.backend.catalog.staticdata.CatalogStaticData;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Port of lib/store.ts → db.getBrands() and db.getBrand(). */
@Service
public class BrandCatalogService {

    private static final Logger log = LoggerFactory.getLogger(BrandCatalogService.class);

    private final BrandRepository brandRepository;
    private final CatalogStaticData staticData;

    public BrandCatalogService(BrandRepository brandRepository, CatalogStaticData staticData) {
        this.brandRepository = brandRepository;
        this.staticData = staticData;
    }

    /** db.getBrands(category?) — DB brands plus missing DEFAULT_CORE_BRANDS, sorted by priority then name. */
    public List<BrandDto> getBrands(String category) {
        List<BrandDto> dbBrands = new ArrayList<>();
        try {
            if (truthy(category)) {
                dbBrands = brandRepository.findByAnyCategory(
                                CategoryAliases.brandCategories(category),
                                CategoryAliases.brandIncludesUncategorised(category))
                        .stream().map(BrandDto::from).toList();
            } else {
                dbBrands = brandRepository.findAllByOrderByPriorityAscNameAsc()
                        .stream().map(BrandDto::from).toList();
            }
        } catch (RuntimeException e) {
            // Original behaviour: log and continue with core brands only.
            log.error("DB getBrands error:", e);
        }

        Set<String> existingBrandIds = new HashSet<>();
        for (BrandDto b : dbBrands) {
            existingBrandIds.add(lower(b.id()));
        }

        List<BrandDto> allBrands = new ArrayList<>(dbBrands);
        for (BrandDto core : staticData.defaultCoreBrands()) {
            if (existingBrandIds.contains(lower(core.id()))) {
                continue;
            }
            if (truthy(category) && !core.categories().contains(category) && !category.equals("smartphone")) {
                continue;
            }
            allBrands.add(core);
        }

        allBrands.sort(CatalogOrdering.byPriorityThenName(BrandDto::priority, BrandDto::name));
        return allBrands;
    }

    /** db.getBrand(id) — prisma.brand.findUnique({ where: { id } }). */
    public Optional<BrandDto> getBrand(String id) {
        return brandRepository.findById(id).map(BrandDto::from);
    }
}
