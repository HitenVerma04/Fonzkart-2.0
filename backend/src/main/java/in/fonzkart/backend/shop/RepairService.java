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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Repairs: "RepairPrice" holds the fixed price of each repair for each phone; a customer books a doorstep visit for a
 * date and time slot in "RepairBooking" and pays after the repair. Everyone reads the prices; administrators edit them
 * and move bookings along.
 */
@Service
public class RepairService {

    public record Price(String id, String brand, String model, String issue, int price, boolean isActive, int displayOrder) {
    }

    public record PriceInput(String brand, String model, String issue, Double price, Boolean isActive, Double displayOrder) {
    }

    public record Store(boolean enabled, List<Price> items) {
    }

    public record AdminOverview(boolean enabled, List<Price> items) {
    }

    public record Booking(String id, int bookingNumber, String status, String brand, String model, String issue, int price,
                          String visitDate, String slot, String name, String phone, String address, String pincode,
                          String createdAt, @JsonInclude(JsonInclude.Include.NON_NULL) String customerEmail) {
    }

    public record BookInput(String repairPriceId, String visitDate, String slot, String name, String phone, String address, String pincode) {
    }

    public record StatusInput(String status) {
    }

    public record SwitchInput(Boolean enabled) {
    }

    static final String ENABLED = "repair.enabled";
    static final List<String> ISSUES = List.of("screen", "battery", "charging", "camera", "speaker", "back");
    static final List<String> SLOTS = List.of("morning", "afternoon", "evening");
    static final List<String> STATUSES = List.of("booked", "confirmed", "completed", "cancelled");
    /** How far ahead a visit can be booked; the first day is tomorrow. */
    static final int MAX_DAYS_AHEAD = 14;
    private static final ZoneId INDIA = ZoneId.of("Asia/Kolkata");
    private static final int MAX_SHORT = 40;

    private static final String COLUMNS = "id, brand, model, issue, price, \"isActive\", \"displayOrder\"";
    private static final String SORTED = " ORDER BY \"displayOrder\" ASC, brand ASC, model ASC, issue ASC";
    private static final RowMapper<Price> PRICE = (rs, i) -> new Price(rs.getString(1), rs.getString(2), rs.getString(3),
            rs.getString(4), rs.getInt(5), rs.getBoolean(6), rs.getInt(7));
    private static final String BOOKING_COLUMNS = "b.id, b.\"bookingNumber\", b.status, b.brand, b.model, b.issue, b.price, "
            + "b.\"visitDate\", b.slot, b.name, b.phone, b.address, b.pincode, b.\"createdAt\"";

    private final ServiceSupport support;
    private final JdbcTemplate jdbc;

    public RepairService(ServiceSupport support, JdbcTemplate jdbc) {
        this.support = support;
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------------------------------------ customers

    public Store store() {
        if (!support.isOn(ENABLED)) {
            return new Store(false, List.of());
        }
        return new Store(true, jdbc.query("SELECT " + COLUMNS + " FROM \"RepairPrice\" WHERE \"isActive\" = true" + SORTED, PRICE));
    }

    /** A doorstep visit, priced from the price list as it is now. */
    @Transactional
    public Booking book(Optional<SessionPayload> session, BookInput input) {
        SessionUser me = support.customer(session);
        if (input == null) {
            throw badRequest("Missing booking details.");
        }
        if (!support.isOn(ENABLED)) {
            throw badRequest("Repairs are closed right now.");
        }
        ServiceSupport.Customer customer = ServiceSupport.checked(input.name(), input.phone(), input.address(), input.pincode());
        String slot = clean(input.slot());
        if (!SLOTS.contains(slot)) {
            throw badRequest("Choose a time slot.");
        }
        LocalDate date = visitDate(input.visitDate());
        List<Price> found = jdbc.query("SELECT " + COLUMNS + " FROM \"RepairPrice\" WHERE id = ? AND \"isActive\" = true", PRICE,
                clean(input.repairPriceId()));
        if (found.isEmpty()) {
            throw badRequest("This repair is no longer offered. Please choose another.");
        }
        Price p = found.get(0);
        String id = Cuid.next();
        LocalDateTime now = JsDates.nowUtc();
        jdbc.update("INSERT INTO \"RepairBooking\" (id, \"userId\", \"repairPriceId\", brand, model, issue, price, \"visitDate\", slot, "
                        + "name, phone, address, pincode, status, \"createdAt\", \"updatedAt\") "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'booked', ?, ?)",
                id, me.id(), p.id(), p.brand(), p.model(), p.issue(), p.price(), date.toString(), slot, customer.name(), customer.phone(),
                customer.address(), customer.pincode(), now, now);
        return jdbc.queryForObject("SELECT " + BOOKING_COLUMNS + ", NULL::text FROM \"RepairBooking\" b WHERE b.id = ?", this::booking, id);
    }

    public List<Booking> myBookings(Optional<SessionPayload> session) {
        SessionUser me = support.customer(session);
        return jdbc.query("SELECT " + BOOKING_COLUMNS + ", NULL::text FROM \"RepairBooking\" b WHERE b.\"userId\" = ? "
                + "ORDER BY b.\"createdAt\" DESC, b.\"bookingNumber\" DESC", this::booking, me.id());
    }

    // ------------------------------------------------------------------------------------------------ administrators

    public AdminOverview overview(Optional<SessionPayload> session) {
        support.requireAdmin(session);
        return new AdminOverview(support.isOn(ENABLED), jdbc.query("SELECT " + COLUMNS + " FROM \"RepairPrice\"" + SORTED, PRICE));
    }

    @Transactional
    public Map<String, Object> add(Optional<SessionPayload> session, PriceInput input) {
        support.requireAdmin(session);
        Price p = validated(input);
        String id = Cuid.next();
        LocalDateTime now = JsDates.nowUtc();
        try {
            jdbc.update("INSERT INTO \"RepairPrice\" (id, brand, model, issue, price, \"isActive\", \"displayOrder\", \"createdAt\", \"updatedAt\") "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", id, p.brand(), p.model(), p.issue(), p.price(), p.isActive(), p.displayOrder(), now, now);
        } catch (DuplicateKeyException e) {
            throw duplicate();
        }
        return result(id);
    }

    @Transactional
    public Map<String, Object> update(Optional<SessionPayload> session, String id, PriceInput input) {
        support.requireAdmin(session);
        Price p = validated(input);
        Integer position = input.displayOrder() != null ? p.displayOrder() : null;
        int changed;
        try {
            changed = jdbc.update("UPDATE \"RepairPrice\" SET brand = ?, model = ?, issue = ?, price = ?, \"isActive\" = ?, "
                    + "\"displayOrder\" = COALESCE(?, \"displayOrder\"), \"updatedAt\" = ? WHERE id = ?",
                    p.brand(), p.model(), p.issue(), p.price(), p.isActive(), position, JsDates.nowUtc(), id);
        } catch (DuplicateKeyException e) {
            throw duplicate();
        }
        if (changed == 0) {
            throw ActionException.notFound();
        }
        return result(id);
    }

    /** Removes a price; bookings keep their own copy of it. */
    @Transactional
    public Map<String, Object> delete(Optional<SessionPayload> session, String id) {
        support.requireAdmin(session);
        if (jdbc.update("DELETE FROM \"RepairPrice\" WHERE id = ?", id) == 0) {
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

    public List<Booking> allBookings(Optional<SessionPayload> session) {
        support.requireAdmin(session);
        return jdbc.query("SELECT " + BOOKING_COLUMNS + ", u.email FROM \"RepairBooking\" b LEFT JOIN \"User\" u ON u.id = b.\"userId\" "
                + "ORDER BY b.\"createdAt\" DESC, b.\"bookingNumber\" DESC", this::booking);
    }

    @Transactional
    public Map<String, Object> setStatus(Optional<SessionPayload> session, String id, StatusInput input) {
        support.requireAdmin(session);
        String status = input == null ? "" : clean(input.status());
        if (!STATUSES.contains(status)) {
            throw badRequest("Unknown booking status.");
        }
        if (jdbc.update("UPDATE \"RepairBooking\" SET status = ?, \"updatedAt\" = ? WHERE id = ?", status, JsDates.nowUtc(), id) == 0) {
            throw ActionException.notFound();
        }
        return result(id);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private static ActionException duplicate() {
        return badRequest("This phone already has a price for this repair.");
    }

    /** The visit's date, from tomorrow (in India) up to two weeks ahead. */
    private static LocalDate visitDate(String raw) {
        LocalDate date;
        try {
            date = LocalDate.parse(clean(raw));
        } catch (DateTimeParseException e) {
            throw badRequest("Choose a date for the visit.");
        }
        LocalDate today = LocalDate.now(INDIA);
        if (!date.isAfter(today) || date.isAfter(today.plusDays(MAX_DAYS_AHEAD))) {
            throw badRequest("Choose a date within the next " + MAX_DAYS_AHEAD + " days.");
        }
        return date;
    }

    static Price validated(PriceInput input) {
        if (input == null) {
            throw badRequest("Missing repair details.");
        }
        String brand = clean(input.brand());
        String model = clean(input.model());
        String issue = clean(input.issue());
        if (brand.isEmpty() || model.isEmpty()) {
            throw badRequest("Add the phone brand and model.");
        }
        if (brand.length() > MAX_SHORT || model.length() > MAX_SHORT) {
            throw badRequest("The brand and model can have at most " + MAX_SHORT + " characters each.");
        }
        if (!ISSUES.contains(issue)) {
            throw badRequest("Unknown repair.");
        }
        Integer price = whole(input.price());
        if (price == null || price < 1 || price > ServiceSupport.MAX_PRICE) {
            throw badRequest("The price must be a whole number of rupees from 1 to " + ServiceSupport.MAX_PRICE + ".");
        }
        Integer position = input.displayOrder() == null ? Integer.valueOf(0) : whole(input.displayOrder());
        if (position == null) {
            throw badRequest("The position must be a whole number.");
        }
        return new Price(null, brand, model, issue, price, input.isActive() == null || input.isActive(), position);
    }

    private Booking booking(ResultSet rs, int row) throws SQLException {
        return new Booking(rs.getString(1), rs.getInt(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6),
                rs.getInt(7), rs.getString(8), rs.getString(9), rs.getString(10), rs.getString(11), rs.getString(12), rs.getString(13),
                JsDates.toIsoString(rs.getObject(14, LocalDateTime.class)), rs.getString(15));
    }
}
