package in.fonzkart.backend.catalog.service;

import static in.fonzkart.backend.shared.text.JsText.lower;
import static in.fonzkart.backend.shared.text.JsText.trim;
import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.catalog.dto.ModelDto;
import in.fonzkart.backend.catalog.dto.VariantDto;
import in.fonzkart.backend.catalog.dto.VariantWithModelDto;
import in.fonzkart.backend.catalog.entity.Variant;
import in.fonzkart.backend.catalog.repository.DeviceModelRepository;
import in.fonzkart.backend.catalog.repository.VariantRepository;
import in.fonzkart.backend.catalog.rules.CatalogModelRules;
import in.fonzkart.backend.catalog.staticdata.CatalogStaticData;
import in.fonzkart.backend.catalog.staticdata.CatalogStaticData.CatalogModel2026;
import in.fonzkart.backend.catalog.staticdata.CatalogStaticData.CatalogVariant2026;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Port of lib/store.ts → db.getVariants() and actions/catalog.ts → findVariantByName(). */
@Service
public class VariantCatalogService {

    private static final Logger log = LoggerFactory.getLogger(VariantCatalogService.class);

    /**
     * JavaScript /(.+)\s\((.+)\)/ — unanchored, greedy. Character classes spell out the JS meaning of
     * '.' (anything but a line terminator) and '\s' (Unicode whitespace), which differ slightly in Java.
     */
    private static final String JS_DOT = "[^\\n\\r\\u2028\\u2029]";
    private static final String JS_SPACE = "[\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]";
    private static final Pattern DEVICE_NAME = Pattern.compile(
            "(" + JS_DOT + "+)" + JS_SPACE + "\\((" + JS_DOT + "+)\\)");
    private static final Pattern NON_ALNUM_LOWER = Pattern.compile("[^a-z0-9]");

    private final VariantRepository variantRepository;
    private final DeviceModelRepository modelRepository;
    private final CatalogStaticData staticData;

    public VariantCatalogService(VariantRepository variantRepository, DeviceModelRepository modelRepository,
                                 CatalogStaticData staticData) {
        this.variantRepository = variantRepository;
        this.modelRepository = modelRepository;
        this.staticData = staticData;
    }

    /** db.getVariants(modelId?) — DB variants by base price; falls back to 2026 catalog variants. */
    public List<VariantDto> getVariants(String modelId) {
        List<VariantDto> dbVariants = new ArrayList<>();
        try {
            List<Variant> rows = truthy(modelId)
                    ? variantRepository.findByModelIdOrderByBasePriceAsc(modelId)
                    : variantRepository.findAllByOrderByBasePriceAsc();
            dbVariants = rows.stream().map(VariantDto::from).toList();
        } catch (RuntimeException e) {
            log.error("DB getVariants error:", e);
        }

        if (truthy(modelId) && dbVariants.isEmpty()) {
            String wanted = trim(lower(modelId));
            for (CatalogModel2026 target : staticData.catalog2026Models()) {
                if (target.id().equals(modelId) || trim(lower(target.name())).equals(wanted)) {
                    if (target.variants() != null) {
                        List<VariantDto> fallback = new ArrayList<>();
                        for (CatalogVariant2026 v : target.variants()) {
                            fallback.add(new VariantDto(v.id(), target.id(), v.name(), v.basePrice()));
                        }
                        return fallback;
                    }
                    break; // Array.find() returns the first match only
                }
            }
        }
        return dbVariants;
    }

    /**
     * actions/catalog.ts → findVariantByName(deviceName). deviceName is usually "Model Name (Variant Name)".
     * Returns empty when the original returns null.
     */
    public Optional<VariantWithModelDto> findVariantByName(String deviceName) {
        Matcher match = DEVICE_NAME.matcher(deviceName);
        if (!match.find()) {
            return Optional.empty();
        }
        String name = trim(match.group(1));
        String variant = trim(match.group(2));

        try {
            Optional<Variant> found = variantRepository.findFirstByNameAndModelNameInsensitive(variant, name);
            if (found.isPresent()) {
                Variant v = found.get();
                ModelDto model = modelRepository.findById(v.getModelId()).map(ModelDto::from).orElse(null);
                return Optional.of(new VariantWithModelDto(v.getId(), v.getModelId(), v.getName(), v.getBasePrice(), model));
            }
        } catch (RuntimeException e) {
            log.error("findVariantByName DB error:", e);
        }

        // Fallback to 2026 catalog
        String lowerName = trim(lower(name));
        String nameKey = CatalogModelRules.canonicalModelKey(name);
        CatalogModel2026 targetModel = null;
        for (CatalogModel2026 m : staticData.catalog2026Models()) {
            if (trim(lower(m.name())).equals(lowerName) || CatalogModelRules.canonicalModelKey(m.name()).equals(nameKey)) {
                targetModel = m;
                break;
            }
        }
        if (targetModel != null) {
            String lowerVariant = trim(lower(variant));
            String variantAlnum = NON_ALNUM_LOWER.matcher(lower(variant)).replaceAll("");
            for (CatalogVariant2026 v : targetModel.variants()) {
                if (trim(lower(v.name())).equals(lowerVariant)
                        || NON_ALNUM_LOWER.matcher(lower(v.name())).replaceAll("").equals(variantAlnum)) {
                    return Optional.of(new VariantWithModelDto(v.id(), targetModel.id(), v.name(), v.basePrice(),
                            targetModel.toModelDto()));
                }
            }
        }
        return Optional.empty();
    }
}
