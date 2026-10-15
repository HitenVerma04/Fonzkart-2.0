package in.fonzkart.backend.auth.rules;

import static org.assertj.core.api.Assertions.assertThat;

import in.fonzkart.backend.auth.rules.AttemptLimiter.Kind;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class AttemptLimiterTest {

    /** A clock the test moves forward. */
    private static final class TestClock extends Clock {
        Instant now = Instant.parse("2026-10-16T10:00:00Z");

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private final TestClock clock = new TestClock();
    private final AttemptLimiter limiter = new AttemptLimiter(clock);

    @Test
    void signInIsRefusedAfterTenFailuresUntilTheWindowEnds() {
        for (int i = 1; i < AttemptLimiter.MAX_SIGNIN_FAILURES; i++) {
            assertThat(limiter.failed(Kind.SIGNIN, "u1")).isFalse();
            assertThat(limiter.blocked(Kind.SIGNIN, "u1")).isFalse();
        }
        assertThat(limiter.failed(Kind.SIGNIN, "u1")).isTrue();
        assertThat(limiter.blocked(Kind.SIGNIN, "U1 ")).as("same account, any case or spacing").isTrue();
        assertThat(limiter.blocked(Kind.SIGNIN, "u2")).isFalse();
        assertThat(limiter.blocked(Kind.EXECUTIVE_SIGNIN, "u1")).isFalse();

        clock.now = clock.now.plus(AttemptLimiter.WINDOW).minusSeconds(1);
        assertThat(limiter.blocked(Kind.SIGNIN, "u1")).isTrue();
        clock.now = clock.now.plusSeconds(1);
        assertThat(limiter.blocked(Kind.SIGNIN, "u1")).isFalse();
        assertThat(limiter.failed(Kind.SIGNIN, "u1")).as("a new window starts at 1").isFalse();
    }

    @Test
    void aSuccessStartsTheCountAgain() {
        for (int i = 0; i < AttemptLimiter.MAX_SIGNIN_FAILURES - 1; i++) {
            limiter.failed(Kind.SIGNIN, "u1");
        }
        limiter.reset(Kind.SIGNIN, "u1");
        assertThat(limiter.failed(Kind.SIGNIN, "u1")).isFalse();
        assertThat(limiter.blocked(Kind.SIGNIN, "u1")).isFalse();
    }

    @Test
    void theFifthWrongCodeReachesTheLimit() {
        for (int i = 1; i < AttemptLimiter.MAX_CODE_FAILURES; i++) {
            assertThat(limiter.failed(Kind.CODE, "a@example.test")).isFalse();
        }
        assertThat(limiter.failed(Kind.CODE, "A@example.test")).isTrue();
        clock.now = clock.now.plus(Duration.ofMinutes(16));
        assertThat(limiter.failed(Kind.CODE, "a@example.test")).isFalse();
    }
}
