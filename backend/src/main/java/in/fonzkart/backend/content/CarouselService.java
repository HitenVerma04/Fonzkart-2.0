package in.fonzkart.backend.content;

import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The Customer app's home-page carousel, kept in "CarouselSlide" and edited in the Admin app ("Edit carousel view").
 * Everyone reads the visible cards; only administrators read all cards and change them.
 */
@Service
public class CarouselService {

    public record Slide(String id, String imageUrl, String title, String subtitle, String category, boolean isActive,
                        int displayOrder) {
    }

    public record SlideInput(String imageUrl, String title, String subtitle, String category, Boolean isActive,
                             Integer displayOrder) {
    }

    public record SlideOrder(String id, Integer displayOrder) {
    }

    /** The sell categories a card can open (the website's CategorySelector ids). */
    static final List<String> CATEGORIES =
            List.of("smartphone", "tablet", "camera", "laptop", "watch", "smarttv", "console", "desktop", "earbuds");

    static final int MAX_TITLE = 60;
    static final int MAX_SUBTITLE = 120;
    private static final int MAX_IMAGE_URL = 500;
    /** A website path such as /uploads/x.png (not //host), or an https URL; nothing that could run as a link. */
    private static final Pattern IMAGE_URL = Pattern.compile("^(/(?!/)[A-Za-z0-9._~%/-]+|https://[^\\s\"'<>]+)$");

    private static final String COLUMNS = "id, \"imageUrl\", title, subtitle, category, \"isActive\", \"displayOrder\"";
    private static final String ORDER = " ORDER BY \"displayOrder\" ASC, \"createdAt\" ASC";
    private static final RowMapper<Slide> ROW = (rs, i) -> new Slide(rs.getString(1), rs.getString(2), rs.getString(3),
            rs.getString(4), rs.getString(5), rs.getBoolean(6), rs.getInt(7));

    private final StaffAccess staffAccess;
    private final JdbcTemplate jdbc;

    public CarouselService(StaffAccess staffAccess, JdbcTemplate jdbc) {
        this.staffAccess = staffAccess;
        this.jdbc = jdbc;
    }

    /** The cards the Customer app shows, in order. */
    public List<Slide> visible() {
        return jdbc.query("SELECT " + COLUMNS + " FROM \"CarouselSlide\" WHERE \"isActive\" = true" + ORDER, ROW);
    }

    /** Every card, hidden ones included, for the Admin app. */
    public List<Slide> all(Optional<SessionPayload> session) {
        requireAdmin(session);
        return jdbc.query("SELECT " + COLUMNS + " FROM \"CarouselSlide\"" + ORDER, ROW);
    }

    /** A new card; without an order it goes after the last one. */
    @Transactional
    public Map<String, Object> add(Optional<SessionPayload> session, SlideInput input) {
        requireAdmin(session);
        Slide s = validated(input);
        int order = input.displayOrder() != null ? s.displayOrder()
                : jdbc.queryForObject("SELECT COALESCE(MAX(\"displayOrder\") + 1, 0) FROM \"CarouselSlide\"", Integer.class);
        String id = Cuid.next();
        LocalDateTime now = JsDates.nowUtc();
        jdbc.update("INSERT INTO \"CarouselSlide\" (id, \"imageUrl\", title, subtitle, category, \"isActive\", \"displayOrder\", "
                        + "\"createdAt\", \"updatedAt\") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id, s.imageUrl(), s.title(), s.subtitle(), s.category(), s.isActive(), order, now, now);
        return result(id);
    }

    @Transactional
    public Map<String, Object> update(Optional<SessionPayload> session, String id, SlideInput input) {
        requireAdmin(session);
        Slide s = validated(input);
        Integer order = input.displayOrder() != null ? s.displayOrder() : null;
        int changed = jdbc.update("UPDATE \"CarouselSlide\" SET \"imageUrl\" = ?, title = ?, subtitle = ?, category = ?, "
                        + "\"isActive\" = ?, \"displayOrder\" = COALESCE(?, \"displayOrder\"), \"updatedAt\" = ? WHERE id = ?",
                s.imageUrl(), s.title(), s.subtitle(), s.category(), s.isActive(), order, JsDates.nowUtc(), id);
        if (changed == 0) {
            throw ActionException.notFound();
        }
        return result(id);
    }

    /** New positions for several cards at once; one unknown card changes nothing. */
    @Transactional
    public Map<String, Object> reorder(Optional<SessionPayload> session, List<SlideOrder> items) {
        requireAdmin(session);
        LocalDateTime now = JsDates.nowUtc();
        for (SlideOrder item : items == null ? List.<SlideOrder>of() : items) {
            if (item == null || item.displayOrder() == null) {
                throw new ActionException(HttpStatus.BAD_REQUEST, "Every card needs a position.");
            }
            if (jdbc.update("UPDATE \"CarouselSlide\" SET \"displayOrder\" = ?, \"updatedAt\" = ? WHERE id = ?",
                    item.displayOrder(), now, item.id()) == 0) {
                throw ActionException.notFound();
            }
        }
        return result(null);
    }

    @Transactional
    public Map<String, Object> delete(Optional<SessionPayload> session, String id) {
        requireAdmin(session);
        if (jdbc.update("DELETE FROM \"CarouselSlide\" WHERE id = ?", id) == 0) {
            throw ActionException.notFound();
        }
        return result(null);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private void requireAdmin(Optional<SessionPayload> session) {
        staffAccess.requireRole(session, StaffAccess.ADMINS);
    }

    /** The input cleaned up, or a 400 naming what is wrong. */
    static Slide validated(SlideInput input) {
        if (input == null) {
            throw badRequest("Missing card details.");
        }
        String image = input.imageUrl() == null ? "" : JsText.trim(input.imageUrl());
        String title = input.title() == null ? "" : JsText.trim(input.title());
        String subtitle = input.subtitle() == null ? "" : JsText.trim(input.subtitle());
        String category = input.category() == null || JsText.trim(input.category()).isEmpty() ? null : JsText.trim(input.category());
        if (image.isEmpty()) {
            throw badRequest("Add a picture.");
        }
        if (image.length() > MAX_IMAGE_URL || !IMAGE_URL.matcher(image).matches()) {
            throw badRequest("The picture must be an uploaded picture or an https link.");
        }
        if (title.isEmpty()) {
            throw badRequest("Add a title.");
        }
        if (title.length() > MAX_TITLE) {
            throw badRequest("The title can have at most " + MAX_TITLE + " characters.");
        }
        if (subtitle.length() > MAX_SUBTITLE) {
            throw badRequest("The text can have at most " + MAX_SUBTITLE + " characters.");
        }
        if (category != null && !CATEGORIES.contains(category)) {
            throw badRequest("Unknown category.");
        }
        boolean active = input.isActive() == null || input.isActive();
        int order = input.displayOrder() == null ? 0 : input.displayOrder();
        return new Slide(null, image, title, subtitle, category, active, order);
    }

    private static ActionException badRequest(String message) {
        return new ActionException(HttpStatus.BAD_REQUEST, message);
    }

    private static Map<String, Object> result(String id) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        if (id != null) {
            m.put("id", id);
        }
        return m;
    }
}
