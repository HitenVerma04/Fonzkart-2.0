package in.fonzkart.backend.catalog.rules;

import static in.fonzkart.backend.shared.text.JsText.lower;
import static in.fonzkart.backend.shared.text.JsText.trim;

import in.fonzkart.backend.catalog.dto.ModelDto;
import in.fonzkart.backend.catalog.staticdata.CatalogStaticData;
import in.fonzkart.backend.catalog.staticdata.CatalogStaticData.CatalogModel2026;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Port of the model helpers in lib/catalog2026.ts:
 * getCanonicalModelKey(), resolveModelImage(), deduplicateModels().
 * Behaviour is verified against fixtures generated from the original TypeScript (see tests).
 */
@Component
public class CatalogModelRules {

    // JavaScript \b is an ASCII word boundary; explicit lookarounds reproduce it exactly on any JDK.
    private static final String WB_BEFORE = "(?<![A-Za-z0-9_])";
    private static final String WB_AFTER = "(?![A-Za-z0-9_])";

    private static final Pattern FIVE_G = Pattern.compile(WB_BEFORE + "5g" + WB_AFTER, Pattern.CASE_INSENSITIVE);
    private static final Pattern FOUR_G = Pattern.compile(WB_BEFORE + "4g" + WB_AFTER, Pattern.CASE_INSENSITIVE);
    private static final Pattern THREE_G = Pattern.compile(WB_BEFORE + "3g" + WB_AFTER, Pattern.CASE_INSENSITIVE);
    private static final Pattern PLUS = Pattern.compile("\\+");
    private static final Pattern BRAND_WORDS = Pattern.compile(WB_BEFORE
            + "(samsung|galaxy|vivo|xiaomi|redmi|realme|poco|apple|iphone|oppo|oneplus|iqoo|motorola|google|pixel)"
            + WB_AFTER, Pattern.CASE_INSENSITIVE);
    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9]", Pattern.CASE_INSENSITIVE);

    private static final String FALLBACK_IMAGE = "/models/samsung/Samsung_Galaxy_S25_Ultra.png";

    private final CatalogStaticData staticData;

    public CatalogModelRules(CatalogStaticData staticData) {
        this.staticData = staticData;
    }

    /** lib/catalog2026.ts → BRAND_FAMILY: Redmi and POCO are Xiaomi sub-brands. */
    private static final Map<String, String> BRAND_FAMILY = Map.of("redmi", "xiaomi", "poco", "xiaomi", "mi", "xiaomi");

    /** lib/catalog2026.ts → brandFamily(brandId) */
    public static String brandFamily(String brandId) {
        String b = trim(lower(brandId == null ? "" : brandId));
        return BRAND_FAMILY.getOrDefault(b, b);
    }

    /**
     * lib/catalog2026.ts → getModelIdentityKey(brandId, name): brand family + canonical name, so models are only
     * matched or merged within the same brand ("iPhone 14" and "Realme 14" both have the canonical name "14").
     */
    public static String modelIdentityKey(String brandId, String name) {
        String key = canonicalModelKey(name);
        return key.isEmpty() ? "" : brandFamily(brandId) + "|" + key;
    }

    /** lib/catalog2026.ts → getCanonicalModelKey(name) */
    public static String canonicalModelKey(String name) {
        if (name == null || name.isEmpty()) {
            return "";
        }
        String key = lower(name);
        key = FIVE_G.matcher(key).replaceAll("");
        key = FOUR_G.matcher(key).replaceAll("");
        key = THREE_G.matcher(key).replaceAll("");
        key = PLUS.matcher(key).replaceAll("plus");
        key = BRAND_WORDS.matcher(key).replaceAll("");
        key = NON_ALNUM.matcher(key).replaceAll("");
        return trim(key);
    }

    /** lib/catalog2026.ts → resolveModelImage(brandId, modelName, currentImg) */
    public String resolveModelImage(String brandId, String modelName, String currentImg) {
        String cleanBrand = trim(lower(brandId == null ? "" : brandId));
        String cleanName = trim(lower(modelName == null ? "" : modelName));
        String cKey = canonicalModelKey(modelName);

        // 1. Check 2026 Catalog first for the most accurate dedicated product render — of the same brand family
        // (a model without a brand may match any brand)
        String family = brandFamily(cleanBrand);
        for (CatalogModel2026 m : staticData.catalog2026Models()) {
            if ((family.isEmpty() || brandFamily(m.brandId()).equals(family))
                    && (trim(lower(m.name())).equals(cleanName) || canonicalModelKey(m.name()).equals(cKey))) {
                if (m.img() != null && !m.img().isEmpty()) {
                    return m.img();
                }
                break; // Array.find() returns the first match only
            }
        }

        // 2. Valid non-empty device photo (not SVG, not Wikimedia logo, not generic placeholder)
        if (currentImg != null
                && !trim(currentImg).isEmpty()
                && !currentImg.endsWith(".svg")
                && !currentImg.contains(".svg")
                && !currentImg.contains("wikimedia")
                && !currentImg.contains("Wikipedia")
                && !currentImg.contains("Logo")
                && !currentImg.contains("logo.png")) {
            return currentImg;
        }

        // 3. Brand default flagship device render so no model is ever blank
        String brandDefault = staticData.brandDefaultImages().get(cleanBrand);
        return brandDefault != null && !brandDefault.isEmpty() ? brandDefault : FALLBACK_IMAGE;
    }

    /** lib/catalog2026.ts → deduplicateModels(models). Insertion order is preserved like a JS Map. */
    public List<ModelDto> deduplicateModels(List<ModelDto> models) {
        Map<String, ModelDto> seen = new LinkedHashMap<>();
        for (ModelDto rawModel : models) {
            String resolvedImg = resolveModelImage(
                    rawModel.brandId() == null ? "" : rawModel.brandId(), rawModel.name(), rawModel.img());
            ModelDto model = rawModel.withImg(resolvedImg);

            String key = modelIdentityKey(model.brandId(), model.name());
            if (key.isEmpty()) {
                seen.put(model.name(), model);
                continue;
            }

            ModelDto existing = seen.get(key);
            if (existing == null) {
                seen.put(key, model);
            } else {
                int pExisting = priorityOrDefault(existing.priority());
                int pModel = priorityOrDefault(model.priority());
                if (pModel < pExisting) {
                    seen.put(key, model);
                } else if (pModel == pExisting) {
                    // Same priority: prefer the name containing '5G'
                    if (lower(model.name()).contains("5g") && !lower(existing.name()).contains("5g")) {
                        seen.put(key, model);
                    }
                }
            }
        }
        return new ArrayList<>(seen.values());
    }

    /** {@code priority ?? 100} */
    public static int priorityOrDefault(Integer priority) {
        return priority == null ? 100 : priority;
    }
}
