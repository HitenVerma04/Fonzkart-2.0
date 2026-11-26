package in.fonzkart.backend.shop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.shared.time.JsDates;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.LocalDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Repair price ranges. {@link #ensureColumns()} adds "priceMax" (the top of a price range; empty for a fixed price) to
 * "RepairPrice" and "RepairBooking" when it is missing. {@link #apply()} applies repair/repair-prices.json once per
 * version: each phone's repairs get their range [lowest, highest]. Only repairs already on the list change (matched by
 * brand, model and repair, ignoring case); nothing is added or removed, and later edits by admins are kept.
 */
@Service
public class RepairPriceSheet {

    /** "AppSetting" key holding the version of repair-prices.json last applied. */
    public static final String VERSION_KEY = "repair.prices.version";
    private static final Logger LOG = LoggerFactory.getLogger(RepairPriceSheet.class);

    /** What one run did. */
    public record Result(String version, boolean applied, int updated) {
    }

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public RepairPriceSheet(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public void ensureColumns() {
        jdbc.execute("ALTER TABLE IF EXISTS \"RepairPrice\" ADD COLUMN IF NOT EXISTS \"priceMax\" INTEGER");
        jdbc.execute("ALTER TABLE IF EXISTS \"RepairBooking\" ADD COLUMN IF NOT EXISTS \"priceMax\" INTEGER");
    }

    @Transactional
    public Result apply() {
        return apply(read());
    }

    @Transactional
    public Result apply(JsonNode file) {
        String version = file.path("version").asText("");
        List<String> applied = jdbc.queryForList("SELECT value FROM \"AppSetting\" WHERE key = ?", String.class, VERSION_KEY);
        if (version.isEmpty() || applied.contains(version)) {
            return new Result(version, false, 0);
        }
        JsonNode issues = file.path("issues");
        LocalDateTime now = JsDates.nowUtc();
        int updated = 0;
        for (JsonNode phone : file.path("phones")) {
            String brand = phone.path("brand").asText("").trim();
            String model = phone.path("model").asText("").trim();
            JsonNode prices = phone.path("prices");
            for (int i = 0; i < issues.size() && i < prices.size(); i++) {
                int low = prices.get(i).path(0).asInt(0);
                int high = prices.get(i).path(1).asInt(low);
                if (brand.isEmpty() || model.isEmpty() || low < 1 || high < low || high > ServiceSupport.MAX_PRICE) {
                    continue;
                }
                updated += jdbc.update("UPDATE \"RepairPrice\" SET price = ?, \"priceMax\" = ?, \"updatedAt\" = ? "
                                + "WHERE lower(brand) = lower(?) AND lower(model) = lower(?) AND issue = ?",
                        low, high > low ? high : null, now, brand, model, issues.get(i).asText());
            }
        }
        jdbc.update("INSERT INTO \"AppSetting\" (key, value, \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                VERSION_KEY, version, now);
        LOG.info("[repair] price ranges {}: {} prices updated", version, updated);
        return new Result(version, true, updated);
    }

    private JsonNode read() {
        try (InputStream in = new ClassPathResource("repair/repair-prices.json").getInputStream()) {
            return mapper.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
