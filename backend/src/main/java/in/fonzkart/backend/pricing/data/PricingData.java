package in.fonzkart.backend.pricing.data;

import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.time.JsDates;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads and writes of the pricing engine's tables (pricing/schema.sql) and the catalog, repair list and settings it
 * learns from. Reads <b>fail soft</b>: if a table is missing (a database the schema could not be created in), the
 * read returns nothing and the price is worked out without that data, so a quote never fails because of the engine.
 */
@Repository
public class PricingData {

    private static final Logger LOG = LoggerFactory.getLogger(PricingData.class);

    public record VariantPricing(String variantId, Integer launchPrice, String launchMonth, String mode,
                                 double marketFactor, LocalDateTime lastAutoAt) {
        public boolean auto() {
            return !"manual".equals(mode);
        }

        public boolean hasLaunch() {
            return launchPrice != null && launchPrice > 0 && launchMonth != null && !launchMonth.isBlank();
        }
    }

    /** A catalog variant with its model and brand. */
    public record CatalogVariant(String variantId, String variantName, Integer basePrice, String modelId,
                                 String modelName, String brandId, String category) {
    }

    public record RepairCost(String id, String category, String brandId, String modelId, String part, long cost,
                             String source, String sourceUrl, String note, LocalDateTime observedAt) {
        /** model, brand or category: how specific the row is. */
        public String scope() {
            return modelId != null && !modelId.isEmpty() ? "model" : brandId != null && !brandId.isEmpty() ? "brand" : "category";
        }
    }

    /** A price from Fonzkart's own repair price list ("RepairPrice"). */
    public record RepairListPrice(String issue, long price) {
    }

    public record Sale(String id, String orderId, String variantId, String modelId, String device, String category,
                       long purchasePrice, Long basePrice, long salePrice, long repairCost, String repairs, String channel,
                       String grade, String note, LocalDateTime soldAt, String createdBy) {
    }

    public record Recommendation(String id, String kind, String targetKey, String title, String detail,
                                 Double currentValue, Double suggestedValue, Double confidence, String evidence,
                                 String status, boolean autoApplied, LocalDateTime createdAt, LocalDateTime updatedAt,
                                 LocalDateTime decidedAt, String decidedBy) {
    }

    public record History(String variantId, Integer oldPrice, int newPrice, String reason, String actor,
                          LocalDateTime createdAt) {
    }

    private final JdbcTemplate jdbc;

    public PricingData(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------------------------------------ settings

    public Optional<String> setting(String key) {
        return soft(() -> jdbc.queryForList("SELECT value FROM \"AppSetting\" WHERE key = ?", String.class, key)
                .stream().findFirst(), Optional.empty());
    }

    public void putSetting(String key, String value) {
        jdbc.update("INSERT INTO \"AppSetting\" (key, value, \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                key, value, JsDates.nowUtc());
    }

    // ------------------------------------------------------------------------------------------------ catalog

    public List<CatalogVariant> catalogVariants() {
        return soft(() -> jdbc.query("SELECT v.id, v.name, v.\"basePrice\", m.id AS mid, m.name AS mname, m.\"brandId\", m.category "
                + "FROM \"Variant\" v JOIN \"Model\" m ON m.id = v.\"modelId\" ORDER BY m.\"brandId\", m.name, v.name",
                (rs, i) -> catalogVariant(rs)), List.of());
    }

    public Optional<CatalogVariant> catalogVariant(String variantId) {
        return soft(() -> jdbc.query("SELECT v.id, v.name, v.\"basePrice\", m.id AS mid, m.name AS mname, m.\"brandId\", m.category "
                + "FROM \"Variant\" v JOIN \"Model\" m ON m.id = v.\"modelId\" WHERE v.id = ?",
                (rs, i) -> catalogVariant(rs), variantId).stream().findFirst(), Optional.empty());
    }

    public Optional<String> brandName(String brandId) {
        return soft(() -> jdbc.queryForList("SELECT name FROM \"Brand\" WHERE id = ?", String.class, brandId)
                .stream().findFirst(), Optional.empty());
    }

    /** Sets a variant's max value and records the change in its history. */
    public void setBasePrice(String variantId, Integer oldPrice, int newPrice, String reason, String actor) {
        jdbc.update("UPDATE \"Variant\" SET \"basePrice\" = ? WHERE id = ?", newPrice, variantId);
        recordHistory(variantId, oldPrice, newPrice, reason, actor);
    }

    public void recordHistory(String variantId, Integer oldPrice, int newPrice, String reason, String actor) {
        softRun(() -> jdbc.update("INSERT INTO \"PriceHistory\" (id, \"variantId\", \"oldPrice\", \"newPrice\", reason, actor, \"createdAt\") "
                + "VALUES (?, ?, ?, ?, ?, ?, ?)", Cuid.next(), variantId, oldPrice, newPrice, reason, actor, JsDates.nowUtc()));
    }

    public List<History> history(String variantId, int limit) {
        return soft(() -> jdbc.query("SELECT * FROM \"PriceHistory\" WHERE \"variantId\" = ? ORDER BY \"createdAt\" DESC LIMIT ?",
                (rs, i) -> new History(rs.getString("variantId"), (Integer) rs.getObject("oldPrice"), rs.getInt("newPrice"),
                        rs.getString("reason"), rs.getString("actor"), time(rs, "createdAt")), variantId, limit), List.of());
    }

    // ------------------------------------------------------------------------------------------------ variant pricing

    public Optional<VariantPricing> variantPricing(String variantId) {
        return soft(() -> jdbc.query("SELECT * FROM \"VariantPricing\" WHERE \"variantId\" = ?", (rs, i) -> variantPricing(rs), variantId)
                .stream().findFirst(), Optional.empty());
    }

    public Map<String, VariantPricing> allVariantPricing() {
        Map<String, VariantPricing> all = new HashMap<>();
        soft(() -> jdbc.query("SELECT * FROM \"VariantPricing\"", (rs, i) -> variantPricing(rs)), List.<VariantPricing>of())
                .forEach(v -> all.put(v.variantId(), v));
        return all;
    }

    /** The lowest launch price recorded for any variant of a model, with its launch month (repair costs go by the model). */
    public Optional<Map.Entry<Long, String>> modelLaunch(String modelId) {
        return soft(() -> jdbc.query("SELECT vp.\"launchPrice\" AS p, vp.\"launchMonth\" AS m FROM \"VariantPricing\" vp "
                + "JOIN \"Variant\" v ON v.id = vp.\"variantId\" WHERE v.\"modelId\" = ? AND vp.\"launchPrice\" > 0 "
                + "AND vp.\"launchMonth\" IS NOT NULL ORDER BY vp.\"launchPrice\" LIMIT 1",
                (rs, i) -> Map.entry(rs.getLong("p"), rs.getString("m")), modelId).stream().findFirst(), Optional.empty());
    }

    /** Records a variant's launch price and month (keeps its mode and market factor). */
    public void upsertLaunch(String variantId, int launchPrice, String launchMonth) {
        jdbc.update("INSERT INTO \"VariantPricing\" (\"variantId\", \"launchPrice\", \"launchMonth\", \"updatedAt\") VALUES (?, ?, ?, ?) "
                + "ON CONFLICT (\"variantId\") DO UPDATE SET \"launchPrice\" = EXCLUDED.\"launchPrice\", "
                + "\"launchMonth\" = EXCLUDED.\"launchMonth\", \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                variantId, launchPrice, launchMonth, JsDates.nowUtc());
    }

    /**
     * An admin set this variant's max value by hand: the monthly revaluation leaves it alone from now on, and the change
     * is kept in its history. In a transaction of its own, so that a problem here never undoes the admin's edit.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void pinManual(String variantId, Integer oldPrice, Integer newPrice, String actor) {
        setMode(variantId, "manual");
        if (newPrice != null) {
            jdbc.update("INSERT INTO \"PriceHistory\" (id, \"variantId\", \"oldPrice\", \"newPrice\", reason, actor, \"createdAt\") "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?)", Cuid.next(), variantId, oldPrice, newPrice, "Edited in the catalog", actor, JsDates.nowUtc());
        }
    }

    /** "auto" or "manual": an admin's own price is never changed by the monthly revaluation. */
    public void setMode(String variantId, String mode) {
        jdbc.update("INSERT INTO \"VariantPricing\" (\"variantId\", mode, \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (\"variantId\") DO UPDATE SET mode = EXCLUDED.mode, \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                variantId, mode, JsDates.nowUtc());
    }

    public void setMarketFactor(String variantId, double factor) {
        jdbc.update("INSERT INTO \"VariantPricing\" (\"variantId\", \"marketFactor\", \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (\"variantId\") DO UPDATE SET \"marketFactor\" = EXCLUDED.\"marketFactor\", \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                variantId, factor, JsDates.nowUtc());
    }

    public void markRevalued(String variantId, LocalDateTime at) {
        jdbc.update("UPDATE \"VariantPricing\" SET \"lastAutoAt\" = ? WHERE \"variantId\" = ?", at, variantId);
    }

    // ------------------------------------------------------------------------------------------------ repair costs

    /** The rows that can apply to a model: its own, its brand's and its category's. */
    public List<RepairCost> repairCostsFor(String category, String brandId, String modelId) {
        return soft(() -> jdbc.query("SELECT * FROM \"RepairCost\" WHERE category = ? AND (\"modelId\" = ? OR (\"modelId\" = '' AND "
                + "(\"brandId\" = ? OR \"brandId\" = '')))", (rs, i) -> repairCost(rs), category,
                nz(modelId), nz(brandId)), List.of());
    }

    public List<RepairCost> repairCosts(String category) {
        return soft(() -> category == null
                ? jdbc.query("SELECT * FROM \"RepairCost\" ORDER BY category, \"brandId\", \"modelId\", part", (rs, i) -> repairCost(rs))
                : jdbc.query("SELECT * FROM \"RepairCost\" WHERE category = ? ORDER BY \"brandId\", \"modelId\", part",
                (rs, i) -> repairCost(rs), category), List.of());
    }

    /** Adds or replaces the row for the same category, brand, model, part and source. */
    public void upsertRepairCost(String category, String brandId, String modelId, String part, long cost, String source,
                                 String sourceUrl, String note) {
        LocalDateTime now = JsDates.nowUtc();
        jdbc.update("INSERT INTO \"RepairCost\" (id, category, \"brandId\", \"modelId\", part, cost, source, \"sourceUrl\", note, "
                + "\"observedAt\", \"createdAt\", \"updatedAt\") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                + "ON CONFLICT (category, \"brandId\", \"modelId\", part, source) DO UPDATE SET cost = EXCLUDED.cost, "
                + "\"sourceUrl\" = EXCLUDED.\"sourceUrl\", note = EXCLUDED.note, \"observedAt\" = EXCLUDED.\"observedAt\", "
                + "\"updatedAt\" = EXCLUDED.\"updatedAt\"",
                Cuid.next(), category, nz(brandId), nz(modelId), part, cost, source, sourceUrl, note, now, now, now);
    }

    public int deleteRepairCost(String id) {
        return jdbc.update("DELETE FROM \"RepairCost\" WHERE id = ?", id);
    }

    /** Fonzkart's own repair prices for a phone (brand and model as the repair list names them). */
    public List<RepairListPrice> repairList(String brandName, String modelName) {
        if (brandName == null || modelName == null) {
            return List.of();
        }
        return soft(() -> jdbc.query("SELECT issue, price FROM \"RepairPrice\" WHERE \"isActive\" = true AND lower(brand) = lower(?) "
                + "AND lower(model) = lower(?)", (rs, i) -> new RepairListPrice(rs.getString("issue"), rs.getLong("price")),
                brandName.trim(), modelName.trim()), List.of());
    }

    // ------------------------------------------------------------------------------------------------ sales

    public List<Sale> sales() {
        return soft(() -> jdbc.query("SELECT * FROM \"DeviceSale\" ORDER BY \"soldAt\" DESC", (rs, i) -> sale(rs)), List.of());
    }

    public Optional<Sale> saleForOrder(String orderId) {
        return soft(() -> jdbc.query("SELECT * FROM \"DeviceSale\" WHERE \"orderId\" = ?", (rs, i) -> sale(rs), orderId)
                .stream().findFirst(), Optional.empty());
    }

    public String insertSale(Sale s) {
        String id = Cuid.next();
        jdbc.update("INSERT INTO \"DeviceSale\" (id, \"orderId\", \"variantId\", \"modelId\", device, category, \"purchasePrice\", "
                + "\"basePrice\", \"salePrice\", \"repairCost\", repairs, channel, grade, note, \"soldAt\", \"createdBy\", \"createdAt\") "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", id, s.orderId(), s.variantId(), s.modelId(), s.device(),
                s.category(), s.purchasePrice(), s.basePrice(), s.salePrice(), s.repairCost(), s.repairs(), s.channel(), s.grade(), s.note(),
                s.soldAt(), s.createdBy(), JsDates.nowUtc());
        return id;
    }

    public int deleteSale(String id) {
        return jdbc.update("DELETE FROM \"DeviceSale\" WHERE id = ?", id);
    }

    // ------------------------------------------------------------------------------------------------ quotes

    public void logQuote(String stage, String orderId, String variantId, String device, String category, Long basePrice,
                         long price, double confidence, String engineVersion, String answers, String breakdown) {
        softRun(() -> jdbc.update("INSERT INTO \"PriceQuote\" (id, stage, \"orderId\", \"variantId\", device, category, \"basePrice\", "
                + "price, confidence, \"engineVersion\", answers, breakdown, \"createdAt\") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                Cuid.next(), stage, orderId, variantId, device, category, basePrice == null ? null : basePrice.intValue(),
                price, confidence, engineVersion, answers, breakdown, JsDates.nowUtc()));
    }

    /** Quote counts per stage since a time (quote, order, inspection). */
    public Map<String, Long> quoteCounts(LocalDateTime since) {
        Map<String, Long> counts = new HashMap<>();
        soft(() -> jdbc.query("SELECT stage, count(*) AS n FROM \"PriceQuote\" WHERE \"createdAt\" >= ? GROUP BY stage",
                (rs, i) -> Map.entry(rs.getString("stage"), rs.getLong("n")), since), List.<Map.Entry<String, Long>>of())
                .forEach(e -> counts.put(e.getKey(), e.getValue()));
        return counts;
    }

    public List<Map<String, Object>> quotesForOrder(String orderId) {
        return soft(() -> jdbc.queryForList("SELECT stage, price, \"basePrice\", confidence, \"engineVersion\", breakdown, \"createdAt\" "
                + "FROM \"PriceQuote\" WHERE \"orderId\" = ? ORDER BY \"createdAt\"", orderId), List.of());
    }

    // ------------------------------------------------------------------------------------------------ recommendations

    public List<Recommendation> recommendations(String status, int limit) {
        return soft(() -> status == null
                ? jdbc.query("SELECT * FROM \"PricingRecommendation\" ORDER BY \"updatedAt\" DESC LIMIT ?", (rs, i) -> recommendation(rs), limit)
                : jdbc.query("SELECT * FROM \"PricingRecommendation\" WHERE status = ? ORDER BY confidence DESC NULLS LAST, \"updatedAt\" DESC LIMIT ?",
                (rs, i) -> recommendation(rs), status, limit), List.of());
    }

    public Optional<Recommendation> recommendation(String id) {
        return soft(() -> jdbc.query("SELECT * FROM \"PricingRecommendation\" WHERE id = ?", (rs, i) -> recommendation(rs), id)
                .stream().findFirst(), Optional.empty());
    }

    /** The open recommendation for (kind, target): updated when there is one, added otherwise. Returns its id. */
    public String upsertOpen(String kind, String targetKey, String title, String detail, Double current, Double suggested,
                             Double confidence, String evidence) {
        LocalDateTime now = JsDates.nowUtc();
        List<String> open = jdbc.queryForList("SELECT id FROM \"PricingRecommendation\" WHERE kind = ? AND \"targetKey\" = ? AND status = 'open'",
                String.class, kind, targetKey);
        if (!open.isEmpty()) {
            jdbc.update("UPDATE \"PricingRecommendation\" SET title = ?, detail = ?, \"currentValue\" = ?, \"suggestedValue\" = ?, "
                    + "confidence = ?, evidence = ?, \"updatedAt\" = ? WHERE id = ?", title, detail, current, suggested, confidence,
                    evidence, now, open.get(0));
            return open.get(0);
        }
        String id = Cuid.next();
        jdbc.update("INSERT INTO \"PricingRecommendation\" (id, kind, \"targetKey\", title, detail, \"currentValue\", \"suggestedValue\", "
                + "confidence, evidence, status, \"autoApplied\", \"createdAt\", \"updatedAt\") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', false, ?, ?)",
                id, kind, targetKey, title, detail, current, suggested, confidence, evidence, now, now);
        return id;
    }

    /** Whether a recommendation for (kind, target) was dismissed since {@code since} (it is then not raised again). */
    public boolean dismissedSince(String kind, String targetKey, LocalDateTime since) {
        return soft(() -> !jdbc.queryForList("SELECT id FROM \"PricingRecommendation\" WHERE kind = ? AND \"targetKey\" = ? "
                + "AND status = 'dismissed' AND \"decidedAt\" >= ?", String.class, kind, targetKey, since).isEmpty(), false);
    }

    public void decide(String id, String status, String by, boolean auto) {
        LocalDateTime now = JsDates.nowUtc();
        jdbc.update("UPDATE \"PricingRecommendation\" SET status = ?, \"decidedBy\" = ?, \"decidedAt\" = ?, \"autoApplied\" = ?, "
                + "\"updatedAt\" = ? WHERE id = ?", status, by, now, auto, now, id);
    }

    /** Open recommendations of these kinds that the latest run no longer raised: resolved. */
    public int resolveStale(List<String> kinds, List<String> keepIds) {
        int n = 0;
        for (Recommendation r : recommendations("open", 5000)) {
            if (kinds.contains(r.kind()) && !keepIds.contains(r.id())) {
                decide(r.id(), "resolved", "engine", false);
                n++;
            }
        }
        return n;
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private <T> T soft(Supplier<T> read, T fallback) {
        try {
            return read.get();
        } catch (DataAccessException e) {
            LOG.warn("[pricing] read failed, using no data: {}", e.getMostSpecificCause().getMessage());
            return fallback;
        }
    }

    private void softRun(Runnable write) {
        try {
            write.run();
        } catch (DataAccessException e) {
            LOG.warn("[pricing] write skipped: {}", e.getMostSpecificCause().getMessage());
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static Long longOrNull(ResultSet rs, String column) throws SQLException {
        long v = rs.getLong(column);
        return rs.wasNull() ? null : v;
    }

    private static LocalDateTime time(ResultSet rs, String column) throws SQLException {
        Timestamp t = rs.getTimestamp(column);
        return t == null ? null : t.toLocalDateTime();
    }

    private static CatalogVariant catalogVariant(ResultSet rs) throws SQLException {
        return new CatalogVariant(rs.getString("id"), rs.getString("name"), (Integer) rs.getObject("basePrice"),
                rs.getString("mid"), rs.getString("mname"), rs.getString("brandId"), rs.getString("category"));
    }

    private static VariantPricing variantPricing(ResultSet rs) throws SQLException {
        return new VariantPricing(rs.getString("variantId"), (Integer) rs.getObject("launchPrice"), rs.getString("launchMonth"),
                rs.getString("mode"), rs.getDouble("marketFactor"), time(rs, "lastAutoAt"));
    }

    private static RepairCost repairCost(ResultSet rs) throws SQLException {
        return new RepairCost(rs.getString("id"), rs.getString("category"), rs.getString("brandId"), rs.getString("modelId"),
                rs.getString("part"), rs.getLong("cost"), rs.getString("source"), rs.getString("sourceUrl"), rs.getString("note"),
                time(rs, "observedAt"));
    }

    private static Sale sale(ResultSet rs) throws SQLException {
        return new Sale(rs.getString("id"), rs.getString("orderId"), rs.getString("variantId"), rs.getString("modelId"),
                rs.getString("device"), rs.getString("category"), rs.getLong("purchasePrice"), (Long) longOrNull(rs, "basePrice"), rs.getLong("salePrice"),
                rs.getLong("repairCost"), rs.getString("repairs"), rs.getString("channel"), rs.getString("grade"),
                rs.getString("note"), time(rs, "soldAt"), rs.getString("createdBy"));
    }

    private static Recommendation recommendation(ResultSet rs) throws SQLException {
        return new Recommendation(rs.getString("id"), rs.getString("kind"), rs.getString("targetKey"), rs.getString("title"),
                rs.getString("detail"), (Double) rs.getObject("currentValue"), (Double) rs.getObject("suggestedValue"),
                (Double) rs.getObject("confidence"), rs.getString("evidence"), rs.getString("status"),
                rs.getBoolean("autoApplied"), time(rs, "createdAt"), time(rs, "updatedAt"), time(rs, "decidedAt"),
                rs.getString("decidedBy"));
    }

}
