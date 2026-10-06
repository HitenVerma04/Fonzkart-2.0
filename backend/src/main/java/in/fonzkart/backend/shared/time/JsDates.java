package in.fonzkart.backend.shared.time;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

/**
 * Date helpers matching how the Next.js/Prisma app handles time:
 * Prisma DateTime columns are "timestamp(3) without time zone" holding UTC wall-clock values (millisecond precision),
 * and dates reach the client as JavaScript {@code Date.prototype.toISOString()} strings.
 */
public final class JsDates {

    private static final DateTimeFormatter ISO_MILLIS = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

    private JsDates() {
    }

    /** {@code new Date()} as stored by Prisma: UTC, truncated to milliseconds. */
    public static LocalDateTime nowUtc() {
        return LocalDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
    }

    /** {@code date.toISOString()} for a UTC wall-clock value, e.g. 2026-10-01T10:58:24.267Z. Null-safe. */
    public static String toIsoString(LocalDateTime utc) {
        return utc == null ? null : ISO_MILLIS.format(utc);
    }

    public static String toIsoString(Instant instant) {
        return toIsoString(LocalDateTime.ofInstant(instant.truncatedTo(ChronoUnit.MILLIS), ZoneOffset.UTC));
    }
}
