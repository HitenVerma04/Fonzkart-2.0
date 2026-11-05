package in.fonzkart.backend.shop;

import static in.fonzkart.backend.shop.ServiceSupport.badRequest;
import static in.fonzkart.backend.shop.ServiceSupport.clean;
import static in.fonzkart.backend.shop.ServiceSupport.result;
import static in.fonzkart.backend.shop.ServiceSupport.whole;

import com.fasterxml.jackson.annotation.JsonInclude;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.shared.id.Cuid;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Refurbished devices: each listing in "RefurbishedDevice" has a condition grade, a price and a stock count; a customer
 * buys one at a time, cash on delivery, in "RefurbishedOrder". An order takes one from the stock and cancelling it puts
 * it back. Everyone reads the listings; administrators edit them and move orders along.
 */
@Service
public class BuyService {

    public record Device(String id, String name, String brand, String storage, String grade, int warrantyMonths,
                         String imageUrl, int mrp, int price, int stock, boolean isActive, int displayOrder) {
    }

    public record DeviceInput(String name, String brand, String storage, String grade, Double warrantyMonths, String imageUrl,
                              Double mrp, Double price, Double stock, Boolean isActive, Double displayOrder) {
    }

    public record Store(boolean enabled, List<Device> items) {
    }

    public record AdminOverview(boolean enabled, List<Device> items) {
    }

    public record Order(String id, int orderNumber, String status, String deviceId, String deviceName, String storage,
                        String grade, int warrantyMonths, String imageUrl, int price, int mrp, String name, String phone,
                        String address, String pincode, String paymentMethod, String createdAt,
                        @JsonInclude(JsonInclude.Include.NON_NULL) String customerEmail) {
    }

    public record PlaceOrderInput(String deviceId, String name, String phone, String address, String pincode) {
    }

    public record StatusInput(String status) {
    }

    public record SwitchInput(Boolean enabled) {
    }

    static final String ENABLED = "buy.enabled";
    static final List<String> GRADES = List.of("superb", "good", "fair");
    static final List<String> STATUSES = List.of("placed", "confirmed", "shipped", "delivered", "cancelled");
    private static final int MAX_SHORT = 40;
    private static final int MAX_WARRANTY = 36;
    private static final int MAX_STOCK = 9_999;

    private static final String COLUMNS = "id, name, brand, storage, grade, \"warrantyMonths\", \"imageUrl\", mrp, price, stock, "
            + "\"isActive\", \"displayOrder\"";
    private static final String SORTED = " ORDER BY \"displayOrder\" ASC, name ASC";
    private static final RowMapper<Device> DEVICE = (rs, i) -> new Device(rs.getString(1), rs.getString(2), rs.getString(3),
            rs.getString(4), rs.getString(5), rs.getInt(6), rs.getString(7), rs.getInt(8), rs.getInt(9), rs.getInt(10),
            rs.getBoolean(11), rs.getInt(12));
    private static final String ORDER_COLUMNS = "o.id, o.\"orderNumber\", o.status, o.\"deviceId\", o.\"deviceName\", o.storage, "
            + "o.grade, o.\"warrantyMonths\", o.\"imageUrl\", o.price, o.mrp, o.name, o.phone, o.address, o.pincode, "
            + "o.\"paymentMethod\", o.\"createdAt\"";

    private final ServiceSupport support;
    private final JdbcTemplate jdbc;

    public BuyService(ServiceSupport support, JdbcTemplate jdbc) {
        this.support = support;
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------------------------------------ customers

    /** What customers see: active listings that are in stock. */
    public Store store() {
        if (!support.isOn(ENABLED)) {
            return new Store(false, List.of());
        }
        return new Store(true, jdbc.query("SELECT " + COLUMNS + " FROM \"RefurbishedDevice\" WHERE \"isActive\" = true AND stock > 0"
                + SORTED, DEVICE));
    }

    /** A cash on delivery order for one device, priced here and taken from the stock in the same step. */
    @Transactional
    public Order placeOrder(Optional<SessionPayload> session, PlaceOrderInput input) {
        SessionUser me = support.customer(session);
        if (input == null) {
            throw badRequest("Missing order details.");
        }
        if (!support.isOn(ENABLED)) {
            throw badRequest("Buying is closed right now.");
        }
        ServiceSupport.Customer customer = ServiceSupport.checked(input.name(), input.phone(), input.address(), input.pincode());
        String deviceId = clean(input.deviceId());
        // One statement, so two customers can never get the last device.
        List<Device> taken = jdbc.query("UPDATE \"RefurbishedDevice\" SET stock = stock - 1, \"updatedAt\" = ? "
                + "WHERE id = ? AND \"isActive\" = true AND stock > 0 RETURNING " + COLUMNS, DEVICE, JsDates.nowUtc(), deviceId);
        if (taken.isEmpty()) {
            throw badRequest("This device has just been sold. Please pick another.");
        }
        Device d = taken.get(0);
        String id = Cuid.next();
        LocalDateTime now = JsDates.nowUtc();
        jdbc.update("INSERT INTO \"RefurbishedOrder\" (id, \"userId\", \"deviceId\", \"deviceName\", storage, grade, \"warrantyMonths\", "
                        + "\"imageUrl\", price, mrp, name, phone, address, pincode, \"paymentMethod\", status, \"createdAt\", \"updatedAt\") "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'placed', ?, ?)",
                id, me.id(), d.id(), d.name(), d.storage(), d.grade(), d.warrantyMonths(), d.imageUrl(), d.price(), d.mrp(),
                customer.name(), customer.phone(), customer.address(), customer.pincode(), now, now);
        return jdbc.queryForObject("SELECT " + ORDER_COLUMNS + ", NULL::text FROM \"RefurbishedOrder\" o WHERE o.id = ?", this::order, id);
    }

    public List<Order> myOrders(Optional<SessionPayload> session) {
        SessionUser me = support.customer(session);
        return jdbc.query("SELECT " + ORDER_COLUMNS + ", NULL::text FROM \"RefurbishedOrder\" o WHERE o.\"userId\" = ? "
                + "ORDER BY o.\"createdAt\" DESC, o.\"orderNumber\" DESC", this::order, me.id());
    }

    // ------------------------------------------------------------------------------------------------ administrators

    public AdminOverview overview(Optional<SessionPayload> session) {
        support.requireAdmin(session);
        return new AdminOverview(support.isOn(ENABLED), jdbc.query("SELECT " + COLUMNS + " FROM \"RefurbishedDevice\"" + SORTED, DEVICE));
    }

    @Transactional
    public Map<String, Object> add(Optional<SessionPayload> session, DeviceInput input) {
        support.requireAdmin(session);
        Device d = validated(input);
        int position = input.displayOrder() != null ? d.displayOrder()
                : jdbc.queryForObject("SELECT COALESCE(MAX(\"displayOrder\") + 1, 0) FROM \"RefurbishedDevice\"", Integer.class);
        String id = Cuid.next();
        LocalDateTime now = JsDates.nowUtc();
        jdbc.update("INSERT INTO \"RefurbishedDevice\" (id, name, brand, storage, grade, \"warrantyMonths\", \"imageUrl\", mrp, price, "
                        + "stock, \"isActive\", \"displayOrder\", \"createdAt\", \"updatedAt\") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id, d.name(), d.brand(), d.storage(), d.grade(), d.warrantyMonths(), d.imageUrl(), d.mrp(), d.price(), d.stock(),
                d.isActive(), position, now, now);
        return result(id);
    }

    @Transactional
    public Map<String, Object> update(Optional<SessionPayload> session, String id, DeviceInput input) {
        support.requireAdmin(session);
        Device d = validated(input);
        Integer position = input.displayOrder() != null ? d.displayOrder() : null;
        int changed = jdbc.update("UPDATE \"RefurbishedDevice\" SET name = ?, brand = ?, storage = ?, grade = ?, \"warrantyMonths\" = ?, "
                        + "\"imageUrl\" = ?, mrp = ?, price = ?, stock = ?, \"isActive\" = ?, \"displayOrder\" = COALESCE(?, \"displayOrder\"), "
                        + "\"updatedAt\" = ? WHERE id = ?",
                d.name(), d.brand(), d.storage(), d.grade(), d.warrantyMonths(), d.imageUrl(), d.mrp(), d.price(), d.stock(), d.isActive(),
                position, JsDates.nowUtc(), id);
        if (changed == 0) {
            throw ActionException.notFound();
        }
        return result(id);
    }

    /** Removes a listing; orders keep their own copy of its details. */
    @Transactional
    public Map<String, Object> delete(Optional<SessionPayload> session, String id) {
        support.requireAdmin(session);
        if (jdbc.update("DELETE FROM \"RefurbishedDevice\" WHERE id = ?", id) == 0) {
            throw ActionException.notFound();
        }
        return result(null);
    }

    @Transactional
    public Map<String, Object> setEnabled(Optional<SessionPayload> session, SwitchInput input) {
        support.requireAdmin(session);
        if (input == null || input.enabled() == null) {
            throw badRequest("Nothing to change.");
        }
        support.setSwitch(ENABLED, input.enabled());
        return result(null);
    }

    public List<Order> allOrders(Optional<SessionPayload> session) {
        support.requireAdmin(session);
        return jdbc.query("SELECT " + ORDER_COLUMNS + ", u.email FROM \"RefurbishedOrder\" o LEFT JOIN \"User\" u ON u.id = o.\"userId\" "
                + "ORDER BY o.\"createdAt\" DESC, o.\"orderNumber\" DESC", this::order);
    }

    /** Moves an order along. Cancelling puts the device back on sale; undoing a cancel takes it out again if it is still there. */
    @Transactional
    public Map<String, Object> setStatus(Optional<SessionPayload> session, String id, StatusInput input) {
        support.requireAdmin(session);
        String status = input == null ? "" : clean(input.status());
        if (!STATUSES.contains(status)) {
            throw badRequest("Unknown order status.");
        }
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT status, \"deviceId\" FROM \"RefurbishedOrder\" WHERE id = ? FOR UPDATE", id);
        if (rows.isEmpty()) {
            throw ActionException.notFound();
        }
        String previous = (String) rows.get(0).get("status");
        String deviceId = (String) rows.get(0).get("deviceId");
        LocalDateTime now = JsDates.nowUtc();
        if ("cancelled".equals(status) && !"cancelled".equals(previous)) {
            jdbc.update("UPDATE \"RefurbishedDevice\" SET stock = stock + 1, \"updatedAt\" = ? WHERE id = ?", now, deviceId);
        } else if ("cancelled".equals(previous) && !"cancelled".equals(status)
                && jdbc.update("UPDATE \"RefurbishedDevice\" SET stock = stock - 1, \"updatedAt\" = ? WHERE id = ? AND stock > 0", now, deviceId) == 0) {
            throw badRequest("This device is out of stock, so the order cannot be reopened.");
        }
        jdbc.update("UPDATE \"RefurbishedOrder\" SET status = ?, \"updatedAt\" = ? WHERE id = ?", status, now, id);
        return result(id);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    static Device validated(DeviceInput input) {
        if (input == null) {
            throw badRequest("Missing device details.");
        }
        String name = clean(input.name());
        String brand = clean(input.brand());
        String storage = clean(input.storage());
        String grade = clean(input.grade());
        if (name.isEmpty() || name.length() > ServiceSupport.MAX_NAME) {
            throw badRequest("Add a name of at most " + ServiceSupport.MAX_NAME + " characters.");
        }
        if (brand.isEmpty() || brand.length() > MAX_SHORT) {
            throw badRequest("Add the brand, at most " + MAX_SHORT + " characters.");
        }
        if (storage.isEmpty() || storage.length() > MAX_SHORT) {
            throw badRequest("Add the storage, at most " + MAX_SHORT + " characters.");
        }
        if (!GRADES.contains(grade)) {
            throw badRequest("Unknown condition grade.");
        }
        Integer warranty = whole(input.warrantyMonths());
        if (warranty == null || warranty < 0 || warranty > MAX_WARRANTY) {
            throw badRequest("The warranty must be from 0 to " + MAX_WARRANTY + " months.");
        }
        Integer mrp = whole(input.mrp());
        Integer price = whole(input.price());
        if (mrp == null || mrp < 1 || mrp > ServiceSupport.MAX_PRICE) {
            throw badRequest("The MRP must be a whole number of rupees from 1 to " + ServiceSupport.MAX_PRICE + ".");
        }
        if (price == null || price < 1) {
            throw badRequest("The sale price must be a whole number of rupees, at least 1.");
        }
        if (price > mrp) {
            throw badRequest("The sale price cannot be more than the MRP.");
        }
        Integer stock = whole(input.stock());
        if (stock == null || stock < 0 || stock > MAX_STOCK) {
            throw badRequest("The stock must be a whole number from 0 to " + MAX_STOCK + ".");
        }
        Integer position = input.displayOrder() == null ? Integer.valueOf(0) : whole(input.displayOrder());
        if (position == null) {
            throw badRequest("The position must be a whole number.");
        }
        return new Device(null, name, brand, storage, grade, warranty, ServiceSupport.image(input.imageUrl()), mrp, price, stock,
                input.isActive() == null || input.isActive(), position);
    }

    private Order order(ResultSet rs, int row) throws SQLException {
        return new Order(rs.getString(1), rs.getInt(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6),
                rs.getString(7), rs.getInt(8), rs.getString(9), rs.getInt(10), rs.getInt(11), rs.getString(12), rs.getString(13),
                rs.getString(14), rs.getString(15), rs.getString(16), JsDates.toIsoString(rs.getObject(17, LocalDateTime.class)),
                rs.getString(18));
    }
}
