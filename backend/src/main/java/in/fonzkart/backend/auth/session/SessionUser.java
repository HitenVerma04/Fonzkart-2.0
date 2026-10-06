package in.fonzkart.backend.auth.session;

/**
 * lib/auth-utils.ts → SessionUser, as stored in the session JWT ({@code { id, email, name, role }}).
 */
public record SessionUser(String id, String email, String name, String role) {

    public SessionUser withRole(String newRole) {
        return new SessionUser(id, email, name, newRole);
    }
}
