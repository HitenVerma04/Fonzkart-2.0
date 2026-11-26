package in.fonzkart.backend.shop;

import in.fonzkart.backend.shared.time.JsDates;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * More kinds of screen guard for every phone. Once per {@link #VERSION}, each phone that has a tempered glass guard
 * also gets a Gorilla Glass 5 unbreakable guard, a matte guard and a privacy guard, priced from its tempered glass guard
 * and using the same picture. A kind the phone already has is left alone, so admins' own guards and edits are kept.
 */
@Service
public class ScreenGuardKinds {

    /** "AppSetting" key holding the version last applied. */
    public static final String VERSION_KEY = "shop.guardKinds.version";
    public static final String VERSION = "2026-11-26";
    private static final Logger LOG = LoggerFactory.getLogger(ScreenGuardKinds.class);

    /** A kind added next to tempered glass: its type, the name after the model, and rupees added to the tempered price and MRP. */
    record Kind(String type, String name, int extra) {
    }

    static final List<Kind> KINDS = List.of(
            new Kind("unbreakable", "Gorilla Glass 5 Unbreakable Guard", 500),
            new Kind("matte", "Matte Screen Guard", 100),
            new Kind("privacy", "Privacy Screen Guard", 200));

    public record Result(String version, boolean applied, int added) {
    }

    private final JdbcTemplate jdbc;

    public ScreenGuardKinds(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public Result apply() {
        List<String> applied = jdbc.queryForList("SELECT value FROM \"AppSetting\" WHERE key = ?", String.class, VERSION_KEY);
        if (applied.contains(VERSION)) {
            return new Result(VERSION, false, 0);
        }
        LocalDateTime now = JsDates.nowUtc();
        int added = 0;
        List<Map<String, Object>> tempered = jdbc.queryForList("SELECT id, brand, model, \"imageUrl\", mrp, price, "
                + "\"isActive\", \"displayOrder\" FROM \"ScreenGuard\" WHERE \"guardType\" = 'tempered' ORDER BY \"displayOrder\", name");
        for (Map<String, Object> g : tempered) {
            String id = (String) g.get("id");
            String brand = (String) g.get("brand");
            String model = (String) g.get("model");
            int mrp = ((Number) g.get("mrp")).intValue();
            int price = ((Number) g.get("price")).intValue();
            for (Kind kind : KINDS) {
                Integer has = jdbc.queryForObject("SELECT count(*) FROM \"ScreenGuard\" WHERE lower(brand) = lower(?) "
                        + "AND lower(model) = lower(?) AND \"guardType\" = ?", Integer.class, brand, model, kind.type());
                if (has != null && has > 0) {
                    continue;
                }
                String name = model + " " + kind.name();
                if (name.length() > ShopService.MAX_NAME) {
                    name = name.substring(0, ShopService.MAX_NAME).trim();
                }
                added += jdbc.update("INSERT INTO \"ScreenGuard\" (id, name, \"guardType\", brand, model, \"imageUrl\", mrp, "
                                + "price, \"isActive\", \"displayOrder\", \"createdAt\", \"updatedAt\") "
                                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING",
                        id + "-" + kind.type(), name, kind.type(), brand, model, g.get("imageUrl"),
                        Math.min(mrp + kind.extra(), ShopService.MAX_PRICE), Math.min(price + kind.extra(), ShopService.MAX_PRICE),
                        g.get("isActive"), g.get("displayOrder"), now, now);
            }
        }
        jdbc.update("INSERT INTO \"AppSetting\" (key, value, \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                VERSION_KEY, VERSION, now);
        LOG.info("[shop] guard kinds {}: {} guards added", VERSION, added);
        return new Result(VERSION, true, added);
    }
}
