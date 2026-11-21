package in.fonzkart.backend.city.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.city.entity.City;
import in.fonzkart.backend.city.repository.CityRepository;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.time.JsDates;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fonzkart across India: applies cities/major-cities.json once per version. A city that is missing (by its name or a
 * known other name: Bengaluru for Bangalore) is added, switched on, with the pincode span of its urban area; a city that
 * exists but has no pincodes gets them. A city already set up keeps its name, pincodes and on/off switch, and no city
 * is removed, so admins stay in charge on the Cities page.
 */
@Service
public class MajorCities {

    /** "AppSetting" key holding the version of major-cities.json last applied. */
    public static final String VERSION_KEY = "cities.major.version";
    private static final Logger LOG = LoggerFactory.getLogger(MajorCities.class);

    /** What one run did. */
    public record Result(String version, boolean applied, int added, int filled) {
    }

    private final CityRepository cities;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public MajorCities(CityRepository cities, JdbcTemplate jdbc, ObjectMapper mapper) {
        this.cities = cities;
        this.jdbc = jdbc;
        this.mapper = mapper;
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
            return new Result(version, false, 0, 0);
        }
        Map<String, City> byName = new HashMap<>();
        for (City c : cities.findAll()) {
            byName.put(key(c.getName()), c);
        }
        LocalDateTime now = JsDates.nowUtc();
        int added = 0;
        int filled = 0;
        for (JsonNode entry : file.path("cities")) {
            String name = entry.path("name").asText("").trim();
            if (name.isEmpty()) {
                continue;
            }
            City existing = byName.get(key(name));
            for (JsonNode alias : entry.path("aliases")) {
                if (existing == null) {
                    existing = byName.get(key(alias.asText()));
                }
            }
            String[] pincodes = pincodes(entry.path("pincodes"));
            if (existing == null) {
                City city = City.newCity(Cuid.next(), name, true, pincodes, now);
                cities.saveAndFlush(city);
                byName.put(key(name), city);
                added++;
            } else if (existing.getPincodes() == null || existing.getPincodes().length == 0) {
                cities.updatePincodes(existing.getId(), pincodes, now);
                filled++;
            }
        }
        jdbc.update("INSERT INTO \"AppSetting\" (key, value, \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                VERSION_KEY, version, now);
        LOG.info("[cities] major cities {}: {} added, {} given pincodes", version, added, filled);
        return new Result(version, true, added, filled);
    }

    /** [[from, to], ...] → every pincode in the spans, as text. */
    static String[] pincodes(JsonNode spans) {
        List<String> out = new ArrayList<>();
        for (JsonNode span : spans) {
            int from = span.path(0).asInt();
            int to = span.path(1).asInt(from);
            if (from < 110000 || to > 999999 || to < from || to - from > 999) {
                continue;
            }
            for (int p = from; p <= to; p++) {
                out.add(Integer.toString(p));
            }
        }
        return out.toArray(String[]::new);
    }

    private static String key(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT).replaceAll("\s+", " ");
    }

    private JsonNode read() {
        try (InputStream in = new ClassPathResource("cities/major-cities.json").getInputStream()) {
            return mapper.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
