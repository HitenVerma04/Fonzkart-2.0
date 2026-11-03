package in.fonzkart.backend.shop;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.service.AccountDeletionService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The screen guard shop: guards kept in "ScreenGuard", the store and discount switches in "AppSetting", and cash on
 * delivery orders in "ShopOrder". Everyone reads the store; signed-in customers order (priced here, never by the
 * app); administrators edit the guards, flip the switches and move orders along.
 */
@Service
public class ShopService {

    public record ScreenGuard(String id, String name, String guardType, String brand, String model, String imageUrl,
                              int mrp, int price, boolean isActive, int displayOrder) {
    }

    public record ScreenGuardInput(String name, String guardType, String brand, String model, String imageUrl,
                                   Double mrp, Double price, Boolean isActive, Double displayOrder) {
    }

    public record ShopSettings(boolean storeEnabled, boolean discountsEnabled) {
    }

    public record SettingsInput(Boolean storeEnabled, Boolean discountsEnabled) {
    }

    public record Store(boolean storeEnabled, boolean discountsEnabled, List<ScreenGuard> items) {
    }

    public record AdminOverview(ShopSettings settings, List<ScreenGuard> items) {
    }

    public record OrderItem(String screenGuardId, String name, String model, int quantity, int unitPrice, int unitMrp) {
    }

    public record ShopOrder(String id, int orderNumber, String status, List<OrderItem> items, int total, String name,
                            String phone, String address, String pincode, String paymentMethod, String createdAt,
                            @JsonInclude(JsonInclude.Include.NON_NULL) String customerEmail) {
    }

    public record LineInput(String screenGuardId, Double quantity) {
    }

    public record PlaceOrderInput(List<LineInput> items, String name, String phone, String address, String pincode) {
    }

    public record StatusInput(String status) {
    }

    static final List<String> GUARD_TYPES = List.of("tempered", "privacy", "matte", "clear", "full", "lens");
    static final List<String> STATUSES = List.of("placed", "confirmed", "shipped", "delivered", "cancelled");
    static final String STORE_ENABLED = "shop.storeEnabled";
    static final String DISCOUNTS_ENABLED = "shop.discountsEnabled";

    static final int MAX_NAME = 80;
    static final int MAX_BRAND = 40;
    static final int MAX_PRICE = 100_000;
    static final int MAX_LINES = 10;
    static final int MAX_QUANTITY = 5;
    static final int MIN_ADDRESS = 5;
    static final int MAX_ADDRESS = 300;
    private static final int MAX_IMAGE_URL = 500;
    /** A website path such as /uploads/x.png (not //host), or an https URL; nothing that could run as a link. */
    private static final Pattern IMAGE_URL = Pattern.compile("^(/(?!/)[A-Za-z0-9._~%/-]+|https://[^\\s\"'<>]+)$");
    private static final Pattern PHONE = Pattern.compile("^\\d{10}$");
    private static final Pattern PINCODE = Pattern.compile("^\\d{6}$");
    private static final TypeReference<List<OrderItem>> ITEMS = new TypeReference<>() {
    };

    private static final String GUARD_COLUMNS =
            "id, name, \"guardType\", brand, model, \"imageUrl\", mrp, price, \"isActive\", \"displayOrder\"";
    private static final String GUARD_ORDER = " ORDER BY \"displayOrder\" ASC, name ASC";
    private static final RowMapper<ScreenGuard> GUARD = (rs, i) -> new ScreenGuard(rs.getString(1), rs.getString(2),
            rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6), rs.getInt(7), rs.getInt(8),
            rs.getBoolean(9), rs.getInt(10));
    private static final String ORDER_COLUMNS = "o.id, o.\"orderNumber\", o.status, o.items, o.total, o.name, o.phone, "
            + "o.address, o.pincode, o.\"paymentMethod\", o.\"createdAt\"";

    private final StaffAccess staffAccess;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ShopService(StaffAccess staffAccess, JdbcTemplate jdbc, ObjectMapper mapper) {
        this.staffAccess = staffAccess;
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    // ------------------------------------------------------------------------------------------------ customers

    /** What the Customer app shows: the switches and the active guards, priced at MRP when discounts are off. */
    public Store store() {
        ShopSettings s = settings();
        if (!s.storeEnabled()) {
            return new Store(false, s.discountsEnabled(), List.of());
        }
        List<ScreenGuard> items = jdbc.query("SELECT " + GUARD_COLUMNS + " FROM \"ScreenGuard\" WHERE \"isActive\" = true"
                + GUARD_ORDER, GUARD);
        if (!s.discountsEnabled()) {
            items = items.stream().map(g -> new ScreenGuard(g.id(), g.name(), g.guardType(), g.brand(), g.model(),
                    g.imageUrl(), g.mrp(), g.mrp(), g.isActive(), g.displayOrder())).toList();
        }
        return new Store(true, s.discountsEnabled(), items);
    }

    /** A cash on delivery order from the signed-in customer, priced from the guards as they are now. */
    @Transactional
    public ShopOrder placeOrder(Optional<SessionPayload> session, PlaceOrderInput input) {
        SessionUser me = activeUser(session).orElseThrow(ActionException::unauthorized);
        if (input == null) {
            throw badRequest("Missing order details.");
        }
        ShopSettings s = settings();
        if (!s.storeEnabled()) {
            throw badRequest("The store is closed right now.");
        }
        String name = clean(input.name());
        String phone = clean(input.phone()).replaceAll("[\\s-]", "");
        String address = clean(input.address());
        String pincode = clean(input.pincode()).replaceAll("\\s", "");
        if (name.isEmpty()) {
            throw badRequest("Add your name.");
        }
        if (name.length() > MAX_NAME) {
            throw badRequest("The name can have at most " + MAX_NAME + " characters.");
        }
        if (!PHONE.matcher(phone).matches()) {
            throw badRequest("Enter a 10-digit phone number.");
        }
        if (address.length() < MIN_ADDRESS) {
            throw badRequest("Add your delivery address.");
        }
        if (address.length() > MAX_ADDRESS) {
            throw badRequest("The address can have at most " + MAX_ADDRESS + " characters.");
        }
        if (!PINCODE.matcher(pincode).matches()) {
            throw badRequest("Enter a 6-digit pincode.");
        }

        List<LineInput> lines = input.items() == null ? List.of() : input.items();
        if (lines.isEmpty()) {
            throw badRequest("Your cart is empty.");
        }
        if (lines.size() > MAX_LINES) {
            throw badRequest("An order can have at most " + MAX_LINES + " different guards.");
        }
        Set<String> seen = new HashSet<>();
        for (LineInput line : lines) {
            if (line == null || line.screenGuardId() == null || line.screenGuardId().isBlank()) {
                throw badRequest("Unknown screen guard.");
            }
            if (!seen.add(line.screenGuardId())) {
                throw badRequest("Each guard can be in the order once.");
            }
            Integer q = whole(line.quantity());
            if (q == null || q < 1 || q > MAX_QUANTITY) {
                throw badRequest("The quantity must be from 1 to " + MAX_QUANTITY + ".");
            }
        }

        Map<String, ScreenGuard> guards = new HashMap<>();
        jdbc.query("SELECT " + GUARD_COLUMNS + " FROM \"ScreenGuard\" WHERE \"isActive\" = true AND id IN ("
                        + String.join(", ", Collections.nCopies(seen.size(), "?")) + ")", GUARD, seen.toArray())
                .forEach(g -> guards.put(g.id(), g));
        List<OrderItem> items = new ArrayList<>();
        int total = 0;
        for (LineInput line : lines) {
            ScreenGuard g = guards.get(line.screenGuardId());
            if (g == null) {
                throw badRequest("A guard in your cart is no longer sold. Remove it and try again.");
            }
            int quantity = whole(line.quantity());
            int unitPrice = s.discountsEnabled() ? g.price() : g.mrp();
            items.add(new OrderItem(g.id(), g.name(), g.model(), quantity, unitPrice, g.mrp()));
            total += unitPrice * quantity;
        }

        String id = Cuid.next();
        LocalDateTime now = JsDates.nowUtc();
        jdbc.update("INSERT INTO \"ShopOrder\" (id, \"userId\", items, total, name, phone, address, pincode, "
                        + "\"paymentMethod\", status, \"createdAt\", \"updatedAt\") VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'placed', ?, ?)",
                id, me.id(), write(items), total, name, phone, address, pincode, now, now);
        return jdbc.queryForObject("SELECT " + ORDER_COLUMNS + ", NULL::text FROM \"ShopOrder\" o WHERE o.id = ?",
                this::order, id);
    }

    /** The signed-in customer's orders, newest first. */
    public List<ShopOrder> myOrders(Optional<SessionPayload> session) {
        SessionUser me = activeUser(session).orElseThrow(ActionException::unauthorized);
        return jdbc.query("SELECT " + ORDER_COLUMNS + ", NULL::text FROM \"ShopOrder\" o WHERE o.\"userId\" = ? "
                + "ORDER BY o.\"createdAt\" DESC, o.\"orderNumber\" DESC", this::order, me.id());
    }

    // ------------------------------------------------------------------------------------------------ administrators

    /** The switches and every guard, hidden ones included, with their real sale prices. */
    public AdminOverview overview(Optional<SessionPayload> session) {
        requireAdmin(session);
        return new AdminOverview(settings(), jdbc.query("SELECT " + GUARD_COLUMNS + " FROM \"ScreenGuard\"" + GUARD_ORDER, GUARD));
    }

    /** A new guard; without an order it goes after the last one. */
    @Transactional
    public Map<String, Object> add(Optional<SessionPayload> session, ScreenGuardInput input) {
        requireAdmin(session);
        ScreenGuard g = validated(input);
        int order = input.displayOrder() != null ? g.displayOrder()
                : jdbc.queryForObject("SELECT COALESCE(MAX(\"displayOrder\") + 1, 0) FROM \"ScreenGuard\"", Integer.class);
        String id = Cuid.next();
        LocalDateTime now = JsDates.nowUtc();
        jdbc.update("INSERT INTO \"ScreenGuard\" (id, name, \"guardType\", brand, model, \"imageUrl\", mrp, price, "
                        + "\"isActive\", \"displayOrder\", \"createdAt\", \"updatedAt\") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id, g.name(), g.guardType(), g.brand(), g.model(), g.imageUrl(), g.mrp(), g.price(), g.isActive(), order,
                now, now);
        return result(id);
    }

    @Transactional
    public Map<String, Object> update(Optional<SessionPayload> session, String id, ScreenGuardInput input) {
        requireAdmin(session);
        ScreenGuard g = validated(input);
        Integer order = input.displayOrder() != null ? g.displayOrder() : null;
        int changed = jdbc.update("UPDATE \"ScreenGuard\" SET name = ?, \"guardType\" = ?, brand = ?, model = ?, "
                        + "\"imageUrl\" = ?, mrp = ?, price = ?, \"isActive\" = ?, \"displayOrder\" = COALESCE(?, \"displayOrder\"), "
                        + "\"updatedAt\" = ? WHERE id = ?",
                g.name(), g.guardType(), g.brand(), g.model(), g.imageUrl(), g.mrp(), g.price(), g.isActive(), order,
                JsDates.nowUtc(), id);
        if (changed == 0) {
            throw ActionException.notFound();
        }
        return result(id);
    }

    /** Removes a guard; orders keep their own copy of its name and prices. */
    @Transactional
    public Map<String, Object> delete(Optional<SessionPayload> session, String id) {
        requireAdmin(session);
        if (jdbc.update("DELETE FROM \"ScreenGuard\" WHERE id = ?", id) == 0) {
            throw ActionException.notFound();
        }
        return result(null);
    }

    /** Sets either switch; one left out stays as it is. */
    @Transactional
    public Map<String, Object> saveSettings(Optional<SessionPayload> session, SettingsInput input) {
        requireAdmin(session);
        if (input == null || (input.storeEnabled() == null && input.discountsEnabled() == null)) {
            throw badRequest("Nothing to change.");
        }
        LocalDateTime now = JsDates.nowUtc();
        if (input.storeEnabled() != null) {
            saveSetting(STORE_ENABLED, input.storeEnabled(), now);
        }
        if (input.discountsEnabled() != null) {
            saveSetting(DISCOUNTS_ENABLED, input.discountsEnabled(), now);
        }
        return result(null);
    }

    /** Every order, newest first, with the email of the customer who placed it. */
    public List<ShopOrder> allOrders(Optional<SessionPayload> session) {
        requireAdmin(session);
        return jdbc.query("SELECT " + ORDER_COLUMNS + ", u.email FROM \"ShopOrder\" o LEFT JOIN \"User\" u ON u.id = o.\"userId\" "
                + "ORDER BY o.\"createdAt\" DESC, o.\"orderNumber\" DESC", this::order);
    }

    @Transactional
    public Map<String, Object> setStatus(Optional<SessionPayload> session, String id, StatusInput input) {
        requireAdmin(session);
        String status = input == null ? "" : clean(input.status());
        if (!STATUSES.contains(status)) {
            throw badRequest("Unknown order status.");
        }
        if (jdbc.update("UPDATE \"ShopOrder\" SET status = ?, \"updatedAt\" = ? WHERE id = ?", status, JsDates.nowUtc(), id) == 0) {
            throw ActionException.notFound();
        }
        return result(id);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private void requireAdmin(Optional<SessionPayload> session) {
        staffAccess.requireRole(session, StaffAccess.ADMINS);
    }

    /** The signed-in user, unless the account has been deleted. */
    private Optional<SessionUser> activeUser(Optional<SessionPayload> session) {
        Optional<SessionUser> me = session.map(SessionPayload::user).filter(u -> u.id() != null);
        if (me.isEmpty()) {
            return me;
        }
        List<String> email = jdbc.queryForList("SELECT email FROM \"User\" WHERE id = ?", String.class, me.get().id());
        boolean gone = email.isEmpty() || (email.get(0) != null && email.get(0).endsWith(AccountDeletionService.DELETED_EMAIL_DOMAIN));
        return gone ? Optional.empty() : me;
    }

    /** Both switches; a switch never set is on. */
    ShopSettings settings() {
        Map<String, String> values = new HashMap<>();
        jdbc.query("SELECT key, value FROM \"AppSetting\" WHERE key IN (?, ?)",
                (ResultSet rs) -> {
                    values.put(rs.getString(1), rs.getString(2));
                }, STORE_ENABLED, DISCOUNTS_ENABLED);
        return new ShopSettings(!"false".equals(values.get(STORE_ENABLED)), !"false".equals(values.get(DISCOUNTS_ENABLED)));
    }

    private void saveSetting(String key, boolean value, LocalDateTime now) {
        jdbc.update("INSERT INTO \"AppSetting\" (key, value, \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                key, Boolean.toString(value), now);
    }

    /** The input cleaned up, or a 400 naming what is wrong. */
    static ScreenGuard validated(ScreenGuardInput input) {
        if (input == null) {
            throw badRequest("Missing guard details.");
        }
        String name = clean(input.name());
        String type = clean(input.guardType());
        String brand = clean(input.brand());
        String model = clean(input.model());
        String image = clean(input.imageUrl());
        if (name.isEmpty()) {
            throw badRequest("Add a name.");
        }
        if (name.length() > MAX_NAME) {
            throw badRequest("The name can have at most " + MAX_NAME + " characters.");
        }
        if (!GUARD_TYPES.contains(type)) {
            throw badRequest("Unknown guard type.");
        }
        if (brand.isEmpty() || model.isEmpty()) {
            throw badRequest("Add the phone brand and model it fits.");
        }
        if (brand.length() > MAX_BRAND || model.length() > MAX_BRAND) {
            throw badRequest("The brand and model can have at most " + MAX_BRAND + " characters each.");
        }
        if (!image.isEmpty() && (image.length() > MAX_IMAGE_URL || !IMAGE_URL.matcher(image).matches())) {
            throw badRequest("The picture must be an uploaded picture or an https link.");
        }
        Integer mrp = whole(input.mrp());
        Integer price = whole(input.price());
        if (mrp == null || mrp < 1 || mrp > MAX_PRICE) {
            throw badRequest("The MRP must be a whole number of rupees from 1 to " + MAX_PRICE + ".");
        }
        if (price == null || price < 1) {
            throw badRequest("The sale price must be a whole number of rupees, at least 1.");
        }
        if (price > mrp) {
            throw badRequest("The sale price cannot be more than the MRP.");
        }
        Integer order = input.displayOrder() == null ? Integer.valueOf(0) : whole(input.displayOrder());
        if (order == null) {
            throw badRequest("The position must be a whole number.");
        }
        boolean active = input.isActive() == null || input.isActive();
        return new ScreenGuard(null, name, type, brand, model, image.isEmpty() ? null : image, mrp, price, active, order);
    }

    private ShopOrder order(ResultSet rs, int row) throws SQLException {
        List<OrderItem> items;
        try {
            items = mapper.readValue(rs.getString(4), ITEMS);
        } catch (JsonProcessingException e) {
            items = List.of();
        }
        return new ShopOrder(rs.getString(1), rs.getInt(2), rs.getString(3), items, rs.getInt(5), rs.getString(6),
                rs.getString(7), rs.getString(8), rs.getString(9), rs.getString(10),
                JsDates.toIsoString(rs.getObject(11, LocalDateTime.class)), rs.getString(12));
    }

    private String write(List<OrderItem> items) {
        try {
            return mapper.writeValueAsString(items);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** A whole number within int range, or null (missing, fractional, or too large). */
    private static Integer whole(Double value) {
        if (value == null || value.isNaN() || value.isInfinite() || value != Math.floor(value)
                || Math.abs(value) > Integer.MAX_VALUE) {
            return null;
        }
        return value.intValue();
    }

    private static String clean(String value) {
        return value == null ? "" : JsText.trim(value);
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
