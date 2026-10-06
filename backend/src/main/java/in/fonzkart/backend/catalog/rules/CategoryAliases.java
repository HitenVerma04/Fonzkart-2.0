package in.fonzkart.backend.catalog.rules;

import java.util.ArrayList;
import java.util.List;

/**
 * Category alias rules hardcoded in lib/store.ts (getBrands / getModels).
 * Note the original code treats brand and model categories slightly differently; both are kept as-is.
 */
public final class CategoryAliases {

    private CategoryAliases() {
    }

    /**
     * lib/store.ts → getBrands(): categories passed to {@code hasSome}.
     * The category is NOT lower-cased here (matches the original).
     */
    public static List<String> brandCategories(String category) {
        List<String> categories = new ArrayList<>();
        categories.add(category);
        if (category.equals("watch") || category.equals("smartwatch")) {
            categories.add("watch");
            categories.add("smartwatch");
        }
        if (category.equals("smartphone") || category.equals("mobile")) {
            categories.add("smartphone");
            categories.add("mobile");
        }
        if (category.equals("tablet") || category.equals("ipad")) {
            categories.add("tablet");
            categories.add("ipad");
        }
        if (category.equals("smarttv") || category.equals("tv")) {
            categories.add("smarttv");
            categories.add("tv");
        }
        return categories;
    }

    /** lib/store.ts → getBrands(): brands with an empty category list also match, only for exactly 'smartphone'. */
    public static boolean brandIncludesUncategorised(String category) {
        return category.equals("smartphone");
    }

    /**
     * lib/store.ts → getModels(): allowed values for Model.category, given an already lower-cased category.
     */
    public static List<String> modelCategories(String lowerCategory) {
        return switch (lowerCategory) {
            case "smartphone", "mobile" -> List.of("smartphone", "mobile", "");
            case "watch", "smartwatch" -> List.of("watch", "smartwatch");
            case "tablet", "ipad" -> List.of("tablet", "ipad");
            case "smarttv", "tv" -> List.of("smarttv", "tv");
            default -> List.of(lowerCategory);
        };
    }
}
