package in.fonzkart.backend.pricing.engine;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Finds max values that cannot be right, the mistakes that had to be spotted by hand before (iPhone 15 Pro below the
 * iPhone 15, a WiFi tablet above its 5G version, every Nothing phone at ₹15,000, laptops with no price):
 * <ul>
 *   <li><b>storage</b>: a bigger storage variant of a model priced below a smaller one;</li>
 *   <li><b>connectivity</b>: a 5G / cellular device priced below the same device with WiFi only;</li>
 *   <li><b>ladder</b>: within a generation, a Plus / Pro / Pro Max / Ultra priced below the model it is above;</li>
 *   <li><b>generation</b>: a newer generation priced below the older one (iPhone 16 below iPhone 15);</li>
 *   <li><b>placeholder</b>: four or more models of a brand at one identical price;</li>
 *   <li><b>launch</b>: a max value far from what the model's launch price and age say (or above the launch price);</li>
 *   <li><b>unpriced</b>: variants without a max value (the device cannot be quoted at all).</li>
 * </ul>
 * Where the right value can be worked out (the neighbouring variant, the launch-price rule) the finding carries it, so
 * an admin fixes it with one tap.
 */
public final class CatalogChecks {

    /** A catalog variant to check. {@code launchPrice}/{@code launchMonth}: its own or its model's (lowest variant). */
    public record Item(String variantId, String variantName, Integer basePrice, String modelId, String modelName,
                       String brandId, String category, Long launchPrice, String launchMonth, boolean variantLaunch) {
    }

    /** One problem. {@code variantId} is the variant to change when {@code suggested} is given. */
    public record Finding(String check, String key, String title, String detail, String variantId, Long current,
                          Long suggested, double confidence) {
    }

    private static final Pattern STORAGE = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*(gb|tb)", Pattern.CASE_INSENSITIVE);
    private static final Pattern GENERATION = Pattern.compile("^(.*?)(\\d{1,3})\\s*(.*)$");

    private CatalogChecks() {
    }

    /**
     * @param ruleValue the launch-price rule's max value for (launch price, launch month, category, brand), or null
     */
    public static List<Finding> run(List<Item> items, RuleValue ruleValue) {
        List<Finding> out = new ArrayList<>();
        Map<String, List<Item>> byModel = new LinkedHashMap<>();
        for (Item i : items) {
            byModel.computeIfAbsent(i.modelId(), k -> new ArrayList<>()).add(i);
        }
        unpriced(items, out);
        storage(byModel, out);
        connectivity(items, byModel, out);
        ladderAndGeneration(byModel, out);
        placeholders(byModel, out);
        launch(items, ruleValue, out);
        return out;
    }

    /** The launch-price rule, given to the checks so they stay free of dates and settings. */
    @FunctionalInterface
    public interface RuleValue {
        Long value(long launchPrice, String launchMonth, String category, String brandId);
    }

    // ------------------------------------------------------------------------------------------------ checks

    private static void unpriced(List<Item> items, List<Finding> out) {
        Map<String, List<Item>> byCategory = new LinkedHashMap<>();
        for (Item i : items) {
            if (i.basePrice() == null || i.basePrice() <= 0) {
                byCategory.computeIfAbsent(i.category(), k -> new ArrayList<>()).add(i);
            }
        }
        byCategory.forEach((cat, list) -> out.add(new Finding("unpriced", "unpriced:" + cat,
                list.size() + " " + cat + " variants have no max value",
                "They cannot be quoted. Add their launch price (they are then priced and kept current automatically) or a max value. "
                        + "First ones: " + names(list, 6), null, null, null, 0.9)));
    }

    private static void storage(Map<String, List<Item>> byModel, List<Finding> out) {
        for (List<Item> variants : byModel.values()) {
            Map<String, List<Item>> byLink = new LinkedHashMap<>();
            for (Item v : variants) {
                if (priced(v) && storageGb(v.variantName()) > 0) {
                    byLink.computeIfAbsent(link(v.variantName()), k -> new ArrayList<>()).add(v);
                }
            }
            for (List<Item> list : byLink.values()) {
                list.sort(Comparator.comparingDouble(v -> storageGb(v.variantName())));
                for (int k = 1; k < list.size(); k++) {
                    Item smaller = list.get(k - 1);
                    Item bigger = list.get(k);
                    if (storageGb(bigger.variantName()) > storageGb(smaller.variantName()) && bigger.basePrice() < smaller.basePrice()) {
                        long suggested = roundUp(smaller.basePrice() * 1.04);
                        out.add(new Finding("storage", "storage:" + bigger.variantId(),
                                bigger.modelName() + " " + bigger.variantName() + " is priced below " + smaller.variantName(),
                                "₹" + bigger.basePrice() + " for " + bigger.variantName() + " but ₹" + smaller.basePrice() + " for "
                                        + smaller.variantName() + ". More storage should be worth at least as much.",
                                bigger.variantId(), (long) bigger.basePrice(), suggested, 0.85));
                    }
                }
            }
        }
    }

    private static void connectivity(List<Item> items, Map<String, List<Item>> byModel, List<Finding> out) {
        // Same model: "8GB/128GB WiFi" vs "8GB/128GB 5G"
        for (List<Item> variants : byModel.values()) {
            Map<String, Item> wifi = new LinkedHashMap<>();
            Map<String, Item> cell = new LinkedHashMap<>();
            for (Item v : variants) {
                if (!priced(v)) {
                    continue;
                }
                String l = link(v.variantName());
                String base = stripLink(v.variantName());
                if (l.equals("wifi")) {
                    wifi.put(base, v);
                } else if (l.equals("cell")) {
                    cell.put(base, v);
                }
            }
            cell.forEach((base, c) -> compareLink(wifi.get(base), c, out));
        }
        // Separate models: "Tab S10 FE Plus WiFi Only" vs "Tab S10 FE Plus 5G", matched variant by variant
        Map<String, List<Item>> byPlainName = new LinkedHashMap<>();
        for (Item i : items) {
            byPlainName.computeIfAbsent(i.brandId() + "|" + i.category() + "|" + stripLink(i.modelName()), k -> new ArrayList<>()).add(i);
        }
        for (List<Item> group : byPlainName.values()) {
            Map<String, Item> wifi = new LinkedHashMap<>();
            Map<String, Item> cell = new LinkedHashMap<>();
            for (Item v : group) {
                if (!priced(v)) {
                    continue;
                }
                String l = link(v.modelName());
                if (l.equals("wifi")) {
                    wifi.put(stripLink(v.variantName()), v);
                } else if (l.equals("cell")) {
                    cell.put(stripLink(v.variantName()), v);
                }
            }
            cell.forEach((variant, c) -> compareLink(wifi.get(variant), c, out));
        }
    }

    private static void compareLink(Item wifi, Item cell, List<Finding> out) {
        if (wifi == null || cell == null || cell.basePrice() >= wifi.basePrice()) {
            return;
        }
        out.add(new Finding("connectivity", "connectivity:" + cell.variantId(),
                cell.modelName() + " " + cell.variantName() + " is priced below its WiFi-only version",
                "₹" + cell.basePrice() + " with 5G / cellular but ₹" + wifi.basePrice() + " for " + wifi.modelName() + " "
                        + wifi.variantName() + " (WiFi only). Cellular models launch higher and resell higher.",
                cell.variantId(), (long) cell.basePrice(), roundUp(wifi.basePrice() * 1.08), 0.85));
    }

    /** Pro below base / newer below older, by the cheapest variant of each model. */
    private static void ladderAndGeneration(Map<String, List<Item>> byModel, List<Finding> out) {
        record Model(Item cheapest, int generation, int rank) {
        }
        Map<String, List<Model>> byFamily = new LinkedHashMap<>();
        for (List<Item> variants : byModel.values()) {
            Item cheapest = variants.stream().filter(CatalogChecks::priced).min(Comparator.comparingInt(Item::basePrice)).orElse(null);
            if (cheapest == null) {
                continue;
            }
            String name = stripLink(cheapest.modelName().toLowerCase(Locale.ROOT).replace("+", " plus "))
                    .replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
            Matcher m = GENERATION.matcher(name);
            if (!m.matches()) {
                continue;
            }
            String series = m.group(1).trim();
            int generation = Integer.parseInt(m.group(2));
            String suffix = m.group(3).trim();
            int rank = rank(suffix);
            if (rank < 0) {
                continue; // FE, mini, Lite, e...: not on the ladder
            }
            byFamily.computeIfAbsent(cheapest.brandId() + "|" + cheapest.category() + "|" + series, k -> new ArrayList<>())
                    .add(new Model(cheapest, generation, rank));
        }
        for (List<Model> family : byFamily.values()) {
            for (Model a : family) {
                for (Model b : family) {
                    if (a == b) {
                        continue;
                    }
                    // ladder: same generation, b is above a, but cheaper
                    if (a.generation() == b.generation() && b.rank() > a.rank() && b.cheapest().basePrice() < a.cheapest().basePrice()) {
                        out.add(new Finding("ladder", "ladder:" + b.cheapest().modelId(),
                                b.cheapest().modelName() + " is priced below " + a.cheapest().modelName(),
                                "Its cheapest variant is ₹" + b.cheapest().basePrice() + ", the " + a.cheapest().modelName()
                                        + "'s ₹" + a.cheapest().basePrice() + ". The higher model of a generation should be worth more.",
                                null, (long) b.cheapest().basePrice(), null, 0.75));
                    }
                    // generation: same rank, b newer, but cheaper
                    if (a.rank() == b.rank() && b.generation() == a.generation() + 1 && b.cheapest().basePrice() < a.cheapest().basePrice()) {
                        out.add(new Finding("generation", "generation:" + b.cheapest().modelId(),
                                b.cheapest().modelName() + " is priced below the older " + a.cheapest().modelName(),
                                "₹" + b.cheapest().basePrice() + " against ₹" + a.cheapest().basePrice() + " for the generation before it.",
                                null, (long) b.cheapest().basePrice(), null, 0.6));
                    }
                }
            }
        }
    }

    private static void placeholders(Map<String, List<Item>> byModel, List<Finding> out) {
        Map<String, List<Item>> byPrice = new LinkedHashMap<>();
        for (List<Item> variants : byModel.values()) {
            Integer only = null;
            boolean same = true;
            for (Item v : variants) {
                if (!priced(v)) {
                    same = false;
                    break;
                }
                if (only == null) {
                    only = v.basePrice();
                } else if (!only.equals(v.basePrice())) {
                    same = false;
                    break;
                }
            }
            if (same && only != null) {
                Item first = variants.get(0);
                byPrice.computeIfAbsent(first.brandId() + "|" + first.category() + "|" + only, k -> new ArrayList<>()).add(first);
            }
        }
        byPrice.forEach((key, list) -> {
            if (list.size() >= 4) {
                Item first = list.get(0);
                out.add(new Finding("placeholder", "placeholder:" + key,
                        list.size() + " " + first.brandId() + " " + first.category() + " models are all ₹" + first.basePrice(),
                        "Identical prices across different models are usually placeholders: " + names(list, 8)
                                + ". Add their launch prices to price them automatically.", null, (long) first.basePrice(), null, 0.7));
            }
        });
    }

    private static void launch(List<Item> items, RuleValue rule, List<Finding> out) {
        if (rule == null) {
            return;
        }
        for (Item i : items) {
            if (!priced(i) || i.launchPrice() == null || i.launchPrice() <= 0 || i.launchMonth() == null || !i.variantLaunch()) {
                continue;
            }
            Long value = rule.value(i.launchPrice(), i.launchMonth(), i.category(), i.brandId());
            if (value == null || value <= 0) {
                continue;
            }
            double off = (i.basePrice() - value) / (double) value;
            if (i.basePrice() >= i.launchPrice() * 0.95) {
                out.add(new Finding("launch", "launch:" + i.variantId(), i.modelName() + " " + i.variantName() + " is priced near its launch price",
                        "Max value ₹" + i.basePrice() + " against a launch price of ₹" + i.launchPrice() + ". The rule says ₹" + value + ".",
                        i.variantId(), (long) i.basePrice(), value, 0.8));
            } else if (Math.abs(off) > 0.3) {
                out.add(new Finding("launch", "launch:" + i.variantId(), i.modelName() + " " + i.variantName() + " is "
                        + Math.round(Math.abs(off) * 100) + "% " + (off > 0 ? "above" : "below") + " what its launch price and age say",
                        "Max value ₹" + i.basePrice() + "; launched " + i.launchMonth() + " at ₹" + i.launchPrice() + ", the rule says ₹"
                                + value + ".", i.variantId(), (long) i.basePrice(), value, 0.6));
            }
        }
    }

    // ------------------------------------------------------------------------------------------------ parsing

    /** The storage in GB: the largest "128GB" / "1TB" in the name (RAM is the smaller number). */
    static double storageGb(String name) {
        Matcher m = STORAGE.matcher(name == null ? "" : name);
        double best = 0;
        while (m.find()) {
            double v = Double.parseDouble(m.group(1)) * (m.group(2).equalsIgnoreCase("tb") ? 1024 : 1);
            best = Math.max(best, v);
        }
        return best;
    }

    /** "wifi", "cell" (5G, LTE, cellular, 4G) or "" . */
    static String link(String name) {
        String n = " " + (name == null ? "" : name.toLowerCase(Locale.ROOT)).replaceAll("[^a-z0-9]+", " ") + " ";
        if (n.contains(" wifi ") && !n.contains(" cellular ")) {
            return "wifi";
        }
        if (n.contains(" 5g ") || n.contains(" lte ") || n.contains(" cellular ") || n.contains(" 4g ")) {
            return "cell";
        }
        return "";
    }

    static String stripLink(String name) {
        return (" " + (name == null ? "" : name.toLowerCase(Locale.ROOT)).replaceAll("[()+,/]", " ") + " ")
                .replaceAll(" (wifi only|wifi|wi fi|5g|lte|4g|gps only|gps|cellular|only) ", " ")
                .replaceAll(" (wifi only|wifi|wi fi|5g|lte|4g|gps only|gps|cellular|only) ", " ")
                .replaceAll("\\s+", " ").trim();
    }

    /** Position on a generation's ladder; -1 for a side model (FE, mini, Lite, e, Neo...). */
    static int rank(String suffix) {
        return switch (suffix) {
            case "" -> 0;
            case "plus" -> 1;
            case "pro" -> 2;
            case "pro plus" -> 3;
            case "pro max", "ultra", "pro xl" -> 4;
            default -> -1;
        };
    }

    private static boolean priced(Item i) {
        return i.basePrice() != null && i.basePrice() > 0;
    }

    private static long roundUp(double v) {
        return (long) (Math.ceil(v / 100 - 1e-9) * 100); // 30,000 × 1.08 is 32,400.000000000004
    }

    private static String names(List<Item> list, int max) {
        StringBuilder sb = new StringBuilder();
        for (int k = 0; k < Math.min(max, list.size()); k++) {
            if (k > 0) {
                sb.append(", ");
            }
            sb.append(list.get(k).modelName());
        }
        if (list.size() > max) {
            sb.append(" and ").append(list.size() - max).append(" more");
        }
        return sb.toString();
    }

}
