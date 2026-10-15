package in.fonzkart.backend.auth.rules;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Limits guessing, as the website does (lib/attempt-limits.ts):
 * <ul>
 *   <li>sign-in: after {@value #MAX_SIGNIN_FAILURES} wrong passwords for one account (email or phone) within 15
 *       minutes, that account's sign-in is refused until 15 minutes after the first of them;</li>
 *   <li>one-time codes: after {@value #MAX_CODE_FAILURES} wrong codes for one email, the code is cancelled and a new
 *       one must be requested (the caller clears it), so a 6-digit code cannot be guessed.</li>
 * </ul>
 * Kept in memory: a restart forgets the counts, which only gives back a few attempts. The map is bounded so that
 * made-up account names cannot fill the memory.
 */
@Component
public class AttemptLimiter {

    public static final int MAX_SIGNIN_FAILURES = 10;
    public static final int MAX_CODE_FAILURES = 5;
    public static final Duration WINDOW = Duration.ofMinutes(15);
    public static final String TOO_MANY_SIGNINS = "Too many sign-in attempts. Please try again in 15 minutes.";
    public static final String TOO_MANY_CODES = "Too many wrong codes. Please request a new one.";

    private static final int MAX_ENTRIES = 50_000;

    public enum Kind { SIGNIN, EXECUTIVE_SIGNIN, CODE }

    private record Window(int failures, Instant start) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public AttemptLimiter() {
        this(Clock.systemUTC());
    }

    AttemptLimiter(Clock clock) {
        this.clock = clock;
    }

    /** True while sign-in for this account is refused. */
    public boolean blocked(Kind kind, String account) {
        Window w = current(kind, account);
        return w != null && w.failures() >= MAX_SIGNIN_FAILURES;
    }

    /** Records a wrong password or code; returns true when this one reached the limit. */
    public boolean failed(Kind kind, String account) {
        if (windows.size() >= MAX_ENTRIES) {
            prune();
        }
        Instant now = clock.instant();
        Window w = windows.compute(key(kind, account), (k, old) ->
                old == null || expired(old, now) ? new Window(1, now) : new Window(old.failures() + 1, old.start()));
        return w.failures() >= (kind == Kind.CODE ? MAX_CODE_FAILURES : MAX_SIGNIN_FAILURES);
    }

    /** A successful sign-in, a used code or a newly issued code starts the count again. */
    public void reset(Kind kind, String account) {
        windows.remove(key(kind, account));
    }

    private Window current(Kind kind, String account) {
        String key = key(kind, account);
        Window w = windows.get(key);
        if (w != null && expired(w, clock.instant())) {
            windows.remove(key, w);
            return null;
        }
        return w;
    }

    private boolean expired(Window w, Instant now) {
        return !now.isBefore(w.start().plus(WINDOW));
    }

    private void prune() {
        Instant now = clock.instant();
        windows.entrySet().removeIf(e -> expired(e.getValue(), now));
        if (windows.size() >= MAX_ENTRIES) {
            windows.clear(); // only under a flood of made-up accounts; real accounts lose a few counted attempts
        }
    }

    private static String key(Kind kind, String account) {
        return kind + ":" + (account == null ? "" : account.trim().toLowerCase(Locale.ROOT));
    }
}
