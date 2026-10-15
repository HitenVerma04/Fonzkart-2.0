package in.fonzkart.backend.catalog.service;

import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.web.ActionException;
import java.sql.Array;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Catalog editing for administrators: the brand, model and variant actions of actions/admin.ts (with lib/store.ts),
 * unchanged in behaviour. Changes are visible at once to the website and every app, which all read the catalog
 * through this backend.
 */
@Service
public class CatalogAdminService {

    private static final Pattern WHITESPACE = Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);

    public record ModelPriority(String id, Integer priority) {
    }

    private final StaffAccess staffAccess;
    private final JdbcTemplate jdbc;

    public CatalogAdminService(StaffAccess staffAccess, JdbcTemplate jdbc) {
        this.staffAccess = staffAccess;
        this.jdbc = jdbc;
    }

    private void requireAdmin(Optional<SessionPayload> session) {
        staffAccess.requireRole(session, StaffAccess.ADMINS);
    }

    // ------------------------------------------------------------------------------------------------ brands

    /**
     * addBrand(name, logo, category?, priority = 100): the id is the name in lower case with spaces as dashes. An
     * existing brand gets the category added and its name, logo and priority replaced.
     */
    @Transactional
    public Map<String, Object> addBrand(Optional<SessionPayload> session, String name, String logo, String category,
                                        Integer priority) {
        requireAdmin(session);
        String id = WHITESPACE.matcher(JsText.lower(name)).replaceAll("-");
        int p = priority == null ? 100 : priority;
        List<String[]> existing = categoriesOf(id);
        if (!existing.isEmpty()) {
            if (JsText.truthy(category) && !Arrays.asList(existing.get(0)).contains(category)) {
                jdbc.update("UPDATE \"Brand\" SET categories = array_append(categories, ?) WHERE id = ?", category, id);
            }
            update("UPDATE \"Brand\" SET name = ?, logo = ?, priority = ? WHERE id = ?", name, logo, p, id);
        } else {
            jdbc.update(con -> {
                var ps = con.prepareStatement("INSERT INTO \"Brand\" (id, name, logo, categories, priority) VALUES (?, ?, ?, ?, ?)");
                ps.setString(1, id);
                ps.setString(2, name);
                ps.setString(3, logo);
                ps.setArray(4, con.createArrayOf("text", JsText.truthy(category) ? new String[]{category} : new String[0]));
                ps.setInt(5, 100);
                return ps;
            });
        }
        return result("id", id);
    }

    /** updateBrand(id, name, logo, priority?): a missing priority is left as it is. */
    @Transactional
    public Map<String, Object> updateBrand(Optional<SessionPayload> session, String id, String name, String logo, Integer priority) {
        requireAdmin(session);
        if (priority == null) {
            update("UPDATE \"Brand\" SET name = ?, logo = ? WHERE id = ?", name, logo, id);
        } else {
            update("UPDATE \"Brand\" SET name = ?, logo = ?, priority = ? WHERE id = ?", name, logo, priority, id);
        }
        return result(null, null);
    }

    /**
     * deleteBrand(id, category?): with a category, the brand leaves that category (and is deleted when it was its
     * last one, or when it had none); without, the brand and its models and variants are deleted.
     */
    @Transactional
    public Map<String, Object> deleteBrand(Optional<SessionPayload> session, String id, String category) {
        requireAdmin(session);
        if (JsText.truthy(category)) {
            List<String[]> rows = categoriesOf(id);
            if (!rows.isEmpty()) {
                List<String> categories = Arrays.asList(rows.get(0));
                if (categories.contains(category)) {
                    List<String> remaining = new ArrayList<>(categories);
                    remaining.removeIf(category::equals);
                    if (remaining.isEmpty()) {
                        jdbc.update("DELETE FROM \"Brand\" WHERE id = ?", id);
                    } else {
                        jdbc.update(con -> {
                            var ps = con.prepareStatement("UPDATE \"Brand\" SET categories = ? WHERE id = ?");
                            ps.setArray(1, con.createArrayOf("text", remaining.toArray(String[]::new)));
                            ps.setString(2, id);
                            return ps;
                        });
                    }
                } else if (categories.isEmpty()) {
                    delete("DELETE FROM \"Brand\" WHERE id = ?", id);
                }
            }
        } else {
            delete("DELETE FROM \"Brand\" WHERE id = ?", id);
        }
        return result(null, null);
    }

    // ------------------------------------------------------------------------------------------------ models

    @Transactional
    public Map<String, Object> addModel(Optional<SessionPayload> session, String brandId, String name, String img,
                                        String category, Integer priority) {
        requireAdmin(session);
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO \"Model\" (id, \"brandId\", name, img, category, priority) VALUES (?, ?, ?, ?, ?, ?)",
                id, brandId, name, img, category == null ? "smartphone" : category, priority == null ? 100 : priority);
        return result("id", id);
    }

    @Transactional
    public Map<String, Object> updateModel(Optional<SessionPayload> session, String id, String brandId, String name,
                                           String img, String category, Integer priority) {
        requireAdmin(session);
        update("UPDATE \"Model\" SET \"brandId\" = ?, name = ?, img = ?, category = ?, priority = ? WHERE id = ?",
                brandId, name, img, category == null ? "smartphone" : category, priority == null ? 100 : priority, id);
        return result(null, null);
    }

    /** reorderModels(items): all priorities in one transaction; one missing model changes nothing. */
    @Transactional
    public Map<String, Object> reorderModels(Optional<SessionPayload> session, List<ModelPriority> items) {
        requireAdmin(session);
        for (ModelPriority item : items == null ? List.<ModelPriority>of() : items) {
            update("UPDATE \"Model\" SET priority = ? WHERE id = ?", item.priority(), item.id());
        }
        return result(null, null);
    }

    @Transactional
    public Map<String, Object> deleteModel(Optional<SessionPayload> session, String id) {
        requireAdmin(session);
        delete("DELETE FROM \"Model\" WHERE id = ?", id);
        return result(null, null);
    }

    // ------------------------------------------------------------------------------------------------ variants

    @Transactional
    public Map<String, Object> addVariant(Optional<SessionPayload> session, String modelId, String name, Integer basePrice) {
        requireAdmin(session);
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO \"Variant\" (id, \"modelId\", name, \"basePrice\") VALUES (?, ?, ?, ?)", id, modelId, name, basePrice);
        return result("id", id);
    }

    @Transactional
    public Map<String, Object> updateVariant(Optional<SessionPayload> session, String id, String modelId, String name,
                                             Integer basePrice) {
        requireAdmin(session);
        update("UPDATE \"Variant\" SET \"modelId\" = ?, name = ?, \"basePrice\" = ? WHERE id = ?", modelId, name, basePrice, id);
        return result(null, null);
    }

    @Transactional
    public Map<String, Object> deleteVariant(Optional<SessionPayload> session, String id) {
        requireAdmin(session);
        delete("DELETE FROM \"Variant\" WHERE id = ?", id);
        return result(null, null);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private List<String[]> categoriesOf(String brandId) {
        return jdbc.query("SELECT categories FROM \"Brand\" WHERE id = ?", (rs, i) -> {
            Array a = rs.getArray(1);
            return a == null ? new String[0] : (String[]) a.getArray();
        }, brandId);
    }

    /** prisma.x.update(): a missing record throws P2025. */
    private void update(String sql, Object... args) {
        if (jdbc.update(sql, args) == 0) {
            throw ActionException.recordNotFound();
        }
    }

    /** prisma.x.delete(): a missing record throws P2025. */
    private void delete(String sql, Object... args) {
        if (jdbc.update(sql, args) == 0) {
            throw ActionException.recordNotFound();
        }
    }

    private static Map<String, Object> result(String key, Object value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        if (key != null) {
            m.put(key, value);
        }
        return m;
    }
}
