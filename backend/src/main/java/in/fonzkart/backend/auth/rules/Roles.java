package in.fonzkart.backend.auth.rules;

import java.util.List;

/** The role strings stored in "User"."role" by the Next.js app. No roles are added or renamed. */
public final class Roles {

    public static final String UNVERIFIED = "UNVERIFIED";
    public static final String USER = "USER";
    public static final String SUPER_ADMIN = "SUPER_ADMIN";
    public static final String ADMIN = "ADMIN";
    public static final String ZONAL_HEAD = "ZONAL_HEAD";
    public static final String RELATIONSHIP_MANAGER = "RELATIONSHIP_MANAGER";
    public static final String PARTNER = "PARTNER";
    public static final String FIELD_EXECUTIVE = "FIELD_EXECUTIVE";

    /** lib/auth-utils.ts → isAdmin(): roles allowed into the staff panel. Not administrators — see StaffAccess. */
    public static final List<String> ADMIN_PANEL_ROLES =
            List.of(ADMIN, SUPER_ADMIN, ZONAL_HEAD, RELATIONSHIP_MANAGER, PARTNER, FIELD_EXECUTIVE);

    /** actions/auth.ts → signin(): roles redirected to /admin after login (RELATIONSHIP_MANAGER is not included). */
    public static final List<String> ADMIN_REDIRECT_ROLES =
            List.of(SUPER_ADMIN, ADMIN, ZONAL_HEAD, PARTNER, FIELD_EXECUTIVE);

    private Roles() {
    }
}
