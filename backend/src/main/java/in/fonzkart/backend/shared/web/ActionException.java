package in.fonzkart.backend.shared.web;

import org.springframework.http.HttpStatus;

/**
 * An error the original server action THREW (as opposed to returning an {@code { error }} object).
 * Rendered as {@code {"error": message}} with the given status; see {@link ApiExceptionHandler}.
 */
public class ActionException extends RuntimeException {

    private final HttpStatus status;

    public ActionException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }

    /** {@code throw new Error('Unauthorized')} */
    public static ActionException unauthorized() {
        return new ActionException(HttpStatus.UNAUTHORIZED, "Unauthorized");
    }

    public static ActionException forbidden(String message) {
        return new ActionException(HttpStatus.FORBIDDEN, message);
    }

    /** Equivalent of Prisma P2025 on update/delete of a missing record. */
    public static ActionException recordNotFound() {
        return new ActionException(HttpStatus.INTERNAL_SERVER_ERROR, "Record to update not found.");
    }

    public static ActionException notFound() {
        return new ActionException(HttpStatus.NOT_FOUND, "Not found");
    }
}
