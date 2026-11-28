package in.fonzkart.backend.pricing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.pricing.data.PricingData;
import in.fonzkart.backend.pricing.rules.MaxValueRule;
import in.fonzkart.backend.shared.time.JsDates;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Sets phone max values to the used-phone market: catalog/market-prices.json holds, for each catalog variant, the
 * average of the Cashify and Cashkr "up to" prices for a flawless phone. Applied once per version on startup:
 * <ul>
 *   <li>each listed variant gets the market price (kept in its price history);</li>
 *   <li>a variant of the same model that neither platform lists moves by the same ratio as its listed siblings, so a
 *       model's storage sizes stay in step;</li>
 *   <li>an auto variant (launch price known) keeps following the monthly revaluation from the market price: its
 *       market factor becomes market price ÷ the rule's price. Where the market is further from the rule than the
 *       factor may go, the variant becomes manual so the revaluation does not pull it back off the market.</li>
 * </ul>
 * This replaces admin-set prices too: the market price is what the admins asked the max values to follow.
 */
@Service
public class MarketPriceImport {

    public static final String VERSION_KEY = "catalog.marketPrices.version";
    public static final String RESULT_KEY = "catalog.marketPrices.lastResult";
    static final String PATH = "catalog/market-prices.json";
    private static final Logger LOG = LoggerFactory.getLogger(MarketPriceImport.class);

    /** What one run did. */
    public record Result(String version, boolean applied, int repriced, int siblingsRepriced, int factorsSet, int madeManual,
                         int notInCatalog) {
    }

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final PricingData data;

    public MarketPriceImport(JdbcTemplate jdbc, ObjectMapper mapper, PricingData data) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.data = data;
    }

    public Result apply(YearMonth now) {
        return apply(read(), now);
    }

    public Result apply(JsonNode file, YearMonth now) {
        String version = file.path("version").asText("");
        if (version.isEmpty() || jdbc.queryForList("SELECT value FROM \"AppSetting\" WHERE key = ?", String.class, VERSION_KEY).contains(version)) {
            return new Result(version, false, 0, 0, 0, 0, 0);
        }
        String reason = "Market average of Cashify and Cashkr (" + file.path("collected").asText(version) + ")";
        Map<String, PricingData.CatalogVariant> catalog = new LinkedHashMap<>();
        Map<String, List<PricingData.CatalogVariant>> byModel = new HashMap<>();
        for (PricingData.CatalogVariant v : data.catalogVariants()) {
            catalog.put(v.variantId(), v);
            byModel.computeIfAbsent(v.modelId(), k -> new ArrayList<>()).add(v);
        }
        Map<String, PricingData.VariantPricing> pricing = data.allVariantPricing();
        LocalDateTime at = JsDates.nowUtc();

        Map<String, Long> market = new LinkedHashMap<>();
        int notInCatalog = 0;
        for (JsonNode row : file.path("variants")) {
            long price = row.path("price").asLong();
            if (price <= 0) {
                continue;
            }
            if (catalog.containsKey(row.path("id").asText())) {
                market.put(row.path("id").asText(), price);
            } else {
                notInCatalog++;
            }
        }
        // Unlisted siblings: the median ratio of the listed variants of their model.
        Map<String, Long> siblings = new LinkedHashMap<>();
        for (List<PricingData.CatalogVariant> variants : byModel.values()) {
            List<Double> ratios = new ArrayList<>();
            for (PricingData.CatalogVariant v : variants) {
                if (market.containsKey(v.variantId()) && v.basePrice() != null && v.basePrice() > 0) {
                    ratios.add(market.get(v.variantId()) / (double) v.basePrice());
                }
            }
            if (ratios.isEmpty()) {
                continue;
            }
            double ratio = median(ratios);
            for (PricingData.CatalogVariant v : variants) {
                if (!market.containsKey(v.variantId()) && v.basePrice() != null && v.basePrice() > 0) {
                    siblings.put(v.variantId(), Math.round(v.basePrice() * ratio / 10) * 10);
                }
            }
        }

        int repriced = 0;
        int factorsSet = 0;
        int madeManual = 0;
        Map<String, Long> all = new LinkedHashMap<>(market);
        all.putAll(siblings);
        for (Map.Entry<String, Long> e : all.entrySet()) {
            PricingData.CatalogVariant v = catalog.get(e.getKey());
            long price = e.getValue();
            boolean listed = market.containsKey(v.variantId());
            if (v.basePrice() == null || v.basePrice() != price) {
                data.setBasePrice(v.variantId(), v.basePrice(), (int) price,
                        listed ? reason : reason + ", same change as the model's other storage sizes", "engine");
                repriced++;
            }
            PricingData.VariantPricing vp = pricing.get(v.variantId());
            if (vp == null || !vp.auto() || !vp.hasLaunch()) {
                continue;
            }
            long rule = MaxValueRule.suggest(vp.launchPrice(), YearMonth.parse(vp.launchMonth()), v.category(), v.brandId(), now).maxValue();
            double factor = rule <= 0 ? 0 : price / (double) rule;
            if (factor >= MaxValueService.MIN_FACTOR && factor <= MaxValueService.MAX_FACTOR) {
                data.setMarketFactor(v.variantId(), Math.round(factor * 1000) / 1000.0);
                data.markRevalued(v.variantId(), at);
                factorsSet++;
            } else {
                data.setMode(v.variantId(), "manual");
                madeManual++;
            }
        }
        Result result = new Result(version, true, repriced - siblingsChanged(siblings, catalog), siblingsChanged(siblings, catalog),
                factorsSet, madeManual, notInCatalog);
        save(VERSION_KEY, version);
        try {
            save(RESULT_KEY, mapper.writeValueAsString(result));
        } catch (IOException e) {
            LOG.warn("[pricing] market price result not recorded", e);
        }
        LOG.info("[pricing] market prices {}: {} listed and {} sibling variants re-priced, {} market factors set, {} made manual, {} not in this catalog",
                version, result.repriced(), result.siblingsRepriced(), factorsSet, madeManual, notInCatalog);
        return result;
    }

    private static int siblingsChanged(Map<String, Long> siblings, Map<String, PricingData.CatalogVariant> catalog) {
        int n = 0;
        for (Map.Entry<String, Long> e : siblings.entrySet()) {
            Integer old = catalog.get(e.getKey()).basePrice();
            if (old == null || old.longValue() != e.getValue()) {
                n++;
            }
        }
        return n;
    }

    static double median(List<Double> values) {
        List<Double> s = new ArrayList<>(values);
        s.sort(Double::compare);
        int m = s.size() / 2;
        return s.size() % 2 == 1 ? s.get(m) : (s.get(m - 1) + s.get(m)) / 2;
    }

    private void save(String key, String value) {
        jdbc.update("INSERT INTO \"AppSetting\" (key, value, \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                key, value, JsDates.nowUtc());
    }

    private JsonNode read() {
        try (InputStream in = new ClassPathResource(PATH).getInputStream()) {
            return mapper.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
