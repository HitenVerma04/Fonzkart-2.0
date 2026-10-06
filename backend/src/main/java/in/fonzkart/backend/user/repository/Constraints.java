package in.fonzkart.backend.user.repository;

import org.springframework.dao.DataIntegrityViolationException;

/** Maps database constraint errors to the Prisma error codes the original code checks. */
public final class Constraints {

    private Constraints() {
    }

    /** Prisma P2002 (unique constraint failed), e.g. "User_email_key" / "User_phone_key". */
    public static boolean isUniqueViolation(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof java.sql.SQLException sql && "23505".equals(sql.getSQLState())) {
                return true;
            }
        }
        return e instanceof DataIntegrityViolationException
                && String.valueOf(e.getMessage()).contains("duplicate key value");
    }
}
