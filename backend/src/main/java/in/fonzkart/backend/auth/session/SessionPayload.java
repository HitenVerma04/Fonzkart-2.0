package in.fonzkart.backend.auth.session;

/**
 * lib/auth-utils.ts → SessionPayload: the decoded session JWT.
 *
 * @param user    the signed-in user (role possibly adjusted by identity rules, as getSession() does)
 * @param expires ISO-8601 string (JSON serialisation of the JavaScript Date passed to login())
 * @param iat     issued-at, seconds since epoch
 * @param exp     expiry, seconds since epoch (iat + 1 week)
 */
public record SessionPayload(SessionUser user, String expires, Long iat, Long exp) {

    public SessionPayload withUser(SessionUser newUser) {
        return new SessionPayload(newUser, expires, iat, exp);
    }
}
