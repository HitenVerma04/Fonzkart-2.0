package in.fonzkart.backend.shop;

import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.service.AccountDeletionService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** What buying a refurbished device and booking a repair have in common: who is asking, the on/off switches, the customer's details. */
@Component
class ServiceSupport {

    /** Name, phone, address and pincode, cleaned up and checked. */
    record Customer(String name, String phone, String address, String pincode) {
    }

    static final int MAX_NAME = 80;
    static final int MAX_PRICE = 500_000;
    private static final int MIN_ADDRESS = 5;
    private static final int MAX_ADDRESS = 300;
    private static final int MAX_IMAGE_URL = 500;
    private static final Pattern PHONE = Pattern.compile("^\\d{10}$");
    private static final Pattern PINCODE = Pattern.compile("^\\d{6}$");
    /** A website path such as /uploads/x.png (not //host), or an https URL; nothing that could run as a link. */
    private static final Pattern IMAGE_URL = Pattern.compile("^(/(?!/)[A-Za-z0-9._~%/-]+|https://[^\\s\"'<>]+)$");

    private final StaffAccess staffAccess;
    private final JdbcTemplate jdbc;

    ServiceSupport(StaffAccess staffAccess, JdbcTemplate jdbc) {
        this.staffAccess = staffAccess;
        this.jdbc = jdbc;
    }

    void requireAdmin(Optional<SessionPayload> session) {
        staffAccess.requireRole(session, StaffAccess.ADMINS);
    }

    /** The signed-in customer, unless the account has been deleted. */
    SessionUser customer(Optional<SessionPayload> session) {
        SessionUser me = session.map(SessionPayload::user).filter(u -> u.id() != null).orElseThrow(ActionException::unauthorized);
        List<String> email = jdbc.queryForList("SELECT email FROM \"User\" WHERE id = ?", String.class, me.id());
        if (email.isEmpty() || (email.get(0) != null && email.get(0).endsWith(AccountDeletionService.DELETED_EMAIL_DOMAIN))) {
            throw ActionException.unauthorized();
        }
        return me;
    }

    /** A switch in "AppSetting"; one never set is on. */
    boolean isOn(String key) {
        return !jdbc.queryForList("SELECT value FROM \"AppSetting\" WHERE key = ?", String.class, key).contains("false");
    }

    void setSwitch(String key, boolean on) {
        jdbc.update("INSERT INTO \"AppSetting\" (key, value, \"updatedAt\") VALUES (?, ?, ?) "
                + "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = EXCLUDED.\"updatedAt\"",
                key, Boolean.toString(on), JsDates.nowUtc());
    }

    static Customer checked(String rawName, String rawPhone, String rawAddress, String rawPincode) {
        String name = clean(rawName);
        String phone = clean(rawPhone).replaceAll("[\\s-]", "");
        String address = clean(rawAddress);
        String pincode = clean(rawPincode).replaceAll("\\s", "");
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
            throw badRequest("Add your address.");
        }
        if (address.length() > MAX_ADDRESS) {
            throw badRequest("The address can have at most " + MAX_ADDRESS + " characters.");
        }
        if (!PINCODE.matcher(pincode).matches()) {
            throw badRequest("Enter a 6-digit pincode.");
        }
        return new Customer(name, phone, address, pincode);
    }

    /** The picture's address cleaned up (null when there is none), or a 400. */
    static String image(String raw) {
        String image = clean(raw);
        if (image.isEmpty()) {
            return null;
        }
        if (image.length() > MAX_IMAGE_URL || !IMAGE_URL.matcher(image).matches()) {
            throw badRequest("The picture must be an uploaded picture or an https link.");
        }
        return image;
    }

    /** A whole number within int range, or null (missing, fractional, or too large). */
    static Integer whole(Double value) {
        if (value == null || value.isNaN() || value.isInfinite() || value != Math.floor(value) || Math.abs(value) > Integer.MAX_VALUE) {
            return null;
        }
        return value.intValue();
    }

    static String clean(String value) {
        return value == null ? "" : JsText.trim(value);
    }

    static ActionException badRequest(String message) {
        return new ActionException(HttpStatus.BAD_REQUEST, message);
    }

    static Map<String, Object> result(String id) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        if (id != null) {
            m.put("id", id);
        }
        return m;
    }
}
