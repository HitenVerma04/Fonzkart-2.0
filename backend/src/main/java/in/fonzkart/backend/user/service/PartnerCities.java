package in.fonzkart.backend.user.service;

import static in.fonzkart.backend.shared.text.JsText.truthy;

import in.fonzkart.backend.user.entity.User;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The cities a partner is responsible for. The partner's main city stays in {@code User.cityId}, which the website and
 * every older screen read; the other cities are rows of {@code "PartnerCity"} (partnerId, cityId). The backend creates
 * that table itself on startup ({@link #ensureTable}), so a deploy needs no hand-run SQL. Reads fail soft: without the
 * table a partner simply has their main city only.
 */
@Component
public class PartnerCities {

    private static final Logger LOG = LoggerFactory.getLogger(PartnerCities.class);
    private final JdbcTemplate jdbc;

    public PartnerCities(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** CREATE TABLE IF NOT EXISTS "PartnerCity" (prisma/schema.prisma: PartnerCity). */
    public void ensureTable() {
        jdbc.execute("CREATE TABLE IF NOT EXISTS \"PartnerCity\" ("
                + "\"partnerId\" TEXT NOT NULL, "
                + "\"cityId\" TEXT NOT NULL, "
                + "\"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                + "CONSTRAINT \"PartnerCity_pkey\" PRIMARY KEY (\"partnerId\", \"cityId\"))");
        jdbc.execute("CREATE INDEX IF NOT EXISTS \"PartnerCity_cityId_idx\" ON \"PartnerCity\" (\"cityId\")");
    }

    /** Every city of this partner: the main city first, then the others in the order they were added. */
    public List<String> cityIds(User partner) {
        return merge(partner.getCityId(), extraCityIds(List.of(partner.getId())).getOrDefault(partner.getId(), List.of()));
    }

    /** The extra cities (not the main one) of each of these partners. */
    public Map<String, List<String>> extraCityIds(Collection<String> partnerIds) {
        Map<String, List<String>> out = new HashMap<>();
        if (partnerIds.isEmpty()) {
            return out;
        }
        try {
            jdbc.query("SELECT \"partnerId\", \"cityId\" FROM \"PartnerCity\" WHERE \"partnerId\" IN ("
                            + marks(partnerIds.size()) + ") ORDER BY \"createdAt\" ASC, \"cityId\" ASC",
                    rs -> {
                        out.computeIfAbsent(rs.getString(1), k -> new ArrayList<>()).add(rs.getString(2));
                    }, partnerIds.toArray());
        } catch (DataAccessException e) {
            LOG.warn("[cities] partner cities could not be read: {}", e.getMessage());
        }
        return out;
    }

    /** The partners serving each of these cities as one of their extra cities (not the main one). */
    public Map<String, List<String>> partnerIdsByExtraCity(Collection<String> cityIds) {
        Map<String, List<String>> out = new HashMap<>();
        if (cityIds.isEmpty()) {
            return out;
        }
        try {
            jdbc.query("SELECT \"cityId\", \"partnerId\" FROM \"PartnerCity\" WHERE \"cityId\" IN (" + marks(cityIds.size()) + ")",
                    rs -> {
                        out.computeIfAbsent(rs.getString(1), k -> new ArrayList<>()).add(rs.getString(2));
                    }, cityIds.toArray());
        } catch (DataAccessException e) {
            LOG.warn("[cities] partner cities could not be read: {}", e.getMessage());
        }
        return out;
    }

    /** Main city first, then the extras, without repeats. */
    public static List<String> merge(String main, List<String> extras) {
        Set<String> all = new LinkedHashSet<>();
        if (truthy(main)) {
            all.add(main);
        }
        for (String id : extras) {
            if (truthy(id)) {
                all.add(id);
            }
        }
        return new ArrayList<>(all);
    }

    /** Replaces this partner's extra cities (the main city is never stored here). */
    @Transactional
    public void setExtras(String partnerId, String mainCityId, List<String> extras) {
        jdbc.update("DELETE FROM \"PartnerCity\" WHERE \"partnerId\" = ?", partnerId);
        int order = 0;
        for (String cityId : new LinkedHashSet<>(extras)) {
            if (!truthy(cityId) || cityId.equals(mainCityId)) {
                continue;
            }
            // createdAt keeps the chosen order (a millisecond apart).
            jdbc.update("INSERT INTO \"PartnerCity\" (\"partnerId\", \"cityId\", \"createdAt\") "
                    + "VALUES (?, ?, CURRENT_TIMESTAMP + make_interval(secs => ?))", partnerId, cityId, order++ / 1000.0);
        }
    }

    /** The main city became {@code mainCityId}: it is no longer one of the extras. */
    public void dropExtra(String partnerId, String cityId) {
        if (!truthy(cityId)) {
            return;
        }
        try {
            jdbc.update("DELETE FROM \"PartnerCity\" WHERE \"partnerId\" = ? AND \"cityId\" = ?", partnerId, cityId);
        } catch (DataAccessException e) {
            LOG.warn("[cities] partner city could not be removed: {}", e.getMessage());
        }
    }

    private static String marks(int n) {
        return String.join(", ", Collections.nCopies(n, "?"));
    }
}
