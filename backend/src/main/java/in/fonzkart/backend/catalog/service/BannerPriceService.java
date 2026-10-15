package in.fonzkart.backend.catalog.service;

import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.time.JsDates;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * The "highest price" figures of the website's home-page banner (lib/banner-prices.ts → fetchAllBannerPrices,
 * saveBannerPriceItem), kept in "DeviceDisplayPrice". The website also kept a backup JSON file inside its own
 * container; the database is the one source here, so the website and the apps always show the same figures.
 */
@Service
public class BannerPriceService {

    public record BannerPrice(String id, String categoryKey, String categoryName, String displayPrice) {
    }

    /** DEFAULT_HERO_PRICES: added when missing, so the banner always has its five categories. */
    public static final List<BannerPrice> DEFAULTS = List.of(
            new BannerPrice("price-phones", "phones", "Smartphones", "₹1,29,000+"),
            new BannerPrice("price-laptops", "laptops", "Laptops", "₹1,49,000+"),
            new BannerPrice("price-tablets", "tablets", "Tablets", "₹1,20,000+"),
            new BannerPrice("price-watches", "watches", "Smartwatches", "₹65,000+"),
            new BannerPrice("price-cameras", "cameras", "Cameras", "₹1,85,000+"));

    private static final Logger log = LoggerFactory.getLogger(BannerPriceService.class);

    private final StaffAccess staffAccess;
    private final JdbcTemplate jdbc;

    public BannerPriceService(StaffAccess staffAccess, JdbcTemplate jdbc) {
        this.staffAccess = staffAccess;
        this.jdbc = jdbc;
    }

    /** fetchAllBannerPrices(): the rows by category name, with any missing default category added (and saved). */
    public List<BannerPrice> all() {
        List<BannerPrice> rows = new ArrayList<>(query());
        if (rows.isEmpty()) {
            for (BannerPrice d : DEFAULTS) {
                upsert(d.categoryKey(), d.categoryName(), d.displayPrice());
            }
            return query();
        }
        Set<String> keys = new HashSet<>();
        rows.forEach(r -> keys.add(r.categoryKey()));
        for (BannerPrice d : DEFAULTS) {
            if (!keys.contains(d.categoryKey())) {
                try {
                    String id = Cuid.next();
                    LocalDateTime now = JsDates.nowUtc();
                    jdbc.update("INSERT INTO \"DeviceDisplayPrice\" (id, \"categoryKey\", \"categoryName\", \"displayPrice\", \"createdAt\", \"updatedAt\") "
                            + "VALUES (?, ?, ?, ?, ?, ?)", id, d.categoryKey(), d.categoryName(), d.displayPrice(), now, now);
                    rows.add(new BannerPrice(id, d.categoryKey(), d.categoryName(), d.displayPrice()));
                } catch (RuntimeException e) {
                    // added at the same moment by another request
                }
            }
        }
        return rows;
    }

    /** getDeviceDisplayPrices(): the same list, for administrators. */
    public List<BannerPrice> forAdmin(Optional<SessionPayload> session) {
        staffAccess.requireRole(session, StaffAccess.ADMINS);
        return all();
    }

    /**
     * updateDeviceDisplayPrice(id, displayPrice, categoryKey?, categoryName?): a database id (longer than 10 characters)
     * updates that row; otherwise the category key (given, or of the default with this id/key) is created or updated.
     */
    public Map<String, Object> save(Optional<SessionPayload> session, String identifier, String displayPrice,
                                    String categoryKey, String categoryName) {
        staffAccess.requireRole(session, StaffAccess.ADMINS);
        String price = displayPrice == null ? "" : JsText.trim(displayPrice);
        BannerPrice fallback = DEFAULTS.stream()
                .filter(d -> d.id().equals(identifier) || d.categoryKey().equals(identifier)
                        || (JsText.truthy(categoryKey) && d.categoryKey().equals(categoryKey)))
                .findFirst().orElse(null);
        try {
            String key = JsText.truthy(categoryKey) ? categoryKey : fallback == null ? null : fallback.categoryKey();
            if (identifier != null && identifier.length() > 10) {
                jdbc.update("UPDATE \"DeviceDisplayPrice\" SET \"displayPrice\" = ?, \"updatedAt\" = ? WHERE id = ?",
                        price, JsDates.nowUtc(), identifier);
            } else if (key != null) {
                String name = JsText.truthy(categoryName) ? categoryName : fallback != null ? fallback.categoryName() : key;
                upsert(key, name, price);
            }
        } catch (RuntimeException e) {
            log.warn("[BannerPrices] DB update failed: {}", e.getMessage());
        }
        BannerPrice item = query().stream()
                .filter(r -> r.id().equals(identifier) || r.categoryKey().equals(identifier)
                        || (JsText.truthy(categoryKey) && r.categoryKey().equals(categoryKey)))
                .findFirst().orElse(null);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        m.put("item", item);
        return m;
    }

    private void upsert(String key, String name, String price) {
        LocalDateTime now = JsDates.nowUtc();
        jdbc.update("INSERT INTO \"DeviceDisplayPrice\" (id, \"categoryKey\", \"categoryName\", \"displayPrice\", \"createdAt\", \"updatedAt\") "
                + "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (\"categoryKey\") DO UPDATE SET \"displayPrice\" = EXCLUDED.\"displayPrice\", "
                + "\"updatedAt\" = EXCLUDED.\"updatedAt\"", Cuid.next(), key, name, price, now, now);
    }

    private List<BannerPrice> query() {
        return jdbc.query("SELECT id, \"categoryKey\", \"categoryName\", \"displayPrice\" FROM \"DeviceDisplayPrice\" ORDER BY \"categoryName\" ASC",
                (rs, i) -> new BannerPrice(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4)));
    }
}
