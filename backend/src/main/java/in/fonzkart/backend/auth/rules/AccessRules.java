package in.fonzkart.backend.auth.rules;

import static in.fonzkart.backend.shared.text.JsText.lower;
import static in.fonzkart.backend.shared.text.JsText.trim;

import in.fonzkart.backend.auth.config.AuthProperties;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.shared.web.ActionException;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Identity rules ported from lib/auth-utils.ts and lib/session.ts.
 * <p>
 * {@link #isAdmin} / {@link #requireStaffPanel} only answer "may this user open the staff panel?" — true for every
 * staff role, including PARTNER and FIELD_EXECUTIVE (the admin layout's check). They are NOT authorization for
 * sensitive operations: those use the explicit role lists in {@link StaffAccess}.
 */
@Component
public class AccessRules {

    private final AuthProperties properties;

    public AccessRules(AuthProperties properties) {
        this.properties = properties;
    }

    /** SUPER_ADMIN_EMAILS.includes(email.toLowerCase()) */
    public boolean isSuperAdminEmail(String email) {
        return email != null && !email.isEmpty() && properties.superAdminEmails().contains(lower(email));
    }

    /** email.toLowerCase() === 'mobilesouls.in@gmail.com' (forced to USER, never admin) */
    public boolean isForcedUserEmail(String email) {
        return email != null && !email.isEmpty() && properties.forcedUserEmails().contains(lower(email));
    }

    /** SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase()) — used by removeAdmin/removeUserRole. */
    public boolean isProtectedSuperAdmin(String rawEmail) {
        return rawEmail != null && properties.superAdminEmails().contains(lower(trim(rawEmail)));
    }

    /** Role overrides applied by both login() and getSession() in lib/session.ts. */
    public SessionUser applyIdentityOverrides(SessionUser user) {
        if (user == null) {
            return null;
        }
        if (isSuperAdminEmail(user.email())) {
            return user.withRole(Roles.SUPER_ADMIN);
        }
        if (isForcedUserEmail(user.email())) {
            return user.withRole(Roles.USER);
        }
        return user;
    }

    /** lib/auth-utils.ts → isAdmin(user) */
    public boolean isAdmin(SessionUser user) {
        if (user == null || user.email() == null || user.email().isEmpty()) {
            return false;
        }
        if (isForcedUserEmail(user.email())) {
            return false;
        }
        return properties.superAdminEmails().contains(lower(user.email()))
                || Roles.ADMIN_PANEL_ROLES.contains(user.role());
    }

    /** lib/auth-utils.ts → isSuperAdmin(user) */
    public boolean isSuperAdmin(SessionUser user) {
        if (user == null || user.email() == null || user.email().isEmpty()) {
            return false;
        }
        if (isForcedUserEmail(user.email())) {
            return false;
        }
        return Roles.SUPER_ADMIN.equals(user.role()) || properties.superAdminEmails().contains(lower(user.email()));
    }

    /**
     * The admin layout's gate (any staff role): throws 'Unauthorized' / 'Forbidden: Admin access required'. Used only
     * for page views that add their own role checks; never for operations (see {@link StaffAccess}).
     */
    public SessionUser requireStaffPanel(Optional<SessionPayload> session) {
        SessionUser user = requireUser(session);
        if (!isAdmin(user)) {
            throw ActionException.forbidden("Forbidden: Admin access required");
        }
        return user;
    }

    /** {@code if (!session || !session.user) throw new Error('Unauthorized')} */
    public SessionUser requireUser(Optional<SessionPayload> session) {
        return session.map(SessionPayload::user).orElseThrow(ActionException::unauthorized);
    }
}
