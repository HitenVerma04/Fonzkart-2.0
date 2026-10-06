package in.fonzkart.backend.shared.time;

import java.util.TimeZone;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;

/**
 * Forces the JVM default time zone to UTC before any bean (in particular the DataSource) is created.
 * <p>
 * Why: Prisma stores DateTime values as UTC in "timestamp without time zone" columns, and the PostgreSQL JDBC
 * driver sends the JVM default zone as the session TimeZone. Host aliases such as "Asia/Calcutta" are also
 * rejected by newer PostgreSQL versions at connection time.
 * <p>
 * Registered in META-INF/spring.factories so it applies to every SpringApplication start (main, tests, tooling),
 * not only {@code main()}.
 */
public class UtcTimeZone implements EnvironmentPostProcessor {

    public static final String UTC = "UTC";

    public static void apply() {
        TimeZone.setDefault(TimeZone.getTimeZone(UTC));
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        apply();
    }
}
