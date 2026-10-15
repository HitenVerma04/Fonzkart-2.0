package in.fonzkart.backend.user.service;

import in.fonzkart.backend.auth.rules.Roles;
import in.fonzkart.backend.auth.rules.StaffAccess;
import in.fonzkart.backend.auth.rules.StaffAccess.Staff;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.order.repository.NotificationRepository;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.repository.UserRepository;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * "Delete my account" (required by Google Play and the App Store; also offered on the website). The account is
 * anonymised, not removed: "Order"."userId" cascades on delete, so removing the row would wipe the order history the
 * business must keep. Name, email, phone and password are replaced, the reset code cleared and the person's
 * notifications deleted, so the account can no longer sign in and no personal details remain on it. Sessions issued
 * before stop working because they no longer match the account's email ({@code CustomerOrderService}, profile).
 * Staff accounts are removed by an administrator instead.
 */
@Service
public class AccountDeletionService {

    public static final String DELETED_EMAIL_DOMAIN = "@deleted.invalid";
    public static final String FORBIDDEN_STAFF = "Forbidden: Staff accounts are removed by an administrator";

    private static final SecureRandom RANDOM = new SecureRandom();

    private final StaffAccess staffAccess;
    private final UserRepository users;
    private final NotificationRepository notifications;

    public AccountDeletionService(StaffAccess staffAccess, UserRepository users, NotificationRepository notifications) {
        this.staffAccess = staffAccess;
        this.users = users;
        this.notifications = notifications;
    }

    public Map<String, Object> deleteMyAccount(Optional<SessionPayload> session) {
        Staff me = staffAccess.current(session).orElseThrow(ActionException::unauthorized);
        if (!List.of(Roles.USER, Roles.UNVERIFIED).contains(me.role())) {
            throw ActionException.forbidden(FORBIDDEN_STAFF);
        }
        byte[] random = new byte[24];
        RANDOM.nextBytes(random);
        // Not a bcrypt hash: no password can ever match it (PasswordHasher.matches returns false).
        String unusable = "!deleted:" + HexFormat.of().formatHex(random);
        users.anonymiseById(me.id(), "Deleted user", "deleted-" + me.id() + DELETED_EMAIL_DOMAIN, unusable,
                JsDates.nowUtc());
        notifications.deleteByUserId(me.id());
        return Map.of("success", true);
    }
}
