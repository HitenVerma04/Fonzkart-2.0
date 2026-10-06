package in.fonzkart.backend.support;

import in.fonzkart.backend.shared.mail.MailTransport;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

/**
 * Shared setup for auth/user integration tests: an empty PostgreSQL 15 database with the Prisma-generated schema,
 * fixed test settings for auth and mail, and a recording mail transport.
 */
public final class PostgresTestBase {

    public static final String AUTH_SECRET = "scenario-secret";

    private PostgresTestBase() {
    }

    public static PostgreSQLContainer<?> emptyPrismaDatabase() {
        return prismaDatabaseWith();
    }

    /** The Prisma-generated schema followed by the given classpath seed scripts (run in order). */
    public static PostgreSQLContainer<?> prismaDatabaseWith(String... seedScripts) {
        PostgreSQLContainer<?> container = new PostgreSQLContainer<>("postgres:15")
                .withDatabaseName("fonzkart")
                .withCopyFileToContainer(MountableFile.forClasspathResource("db/01-prisma-schema.sql"),
                        "/docker-entrypoint-initdb.d/01-prisma-schema.sql");
        for (String script : seedScripts) {
            container.withCopyFileToContainer(MountableFile.forClasspathResource(script),
                    "/docker-entrypoint-initdb.d/" + script.substring(script.lastIndexOf('/') + 1));
        }
        return container;
    }

    public static void register(DynamicPropertyRegistry registry, PostgreSQLContainer<?> postgres) {
        registry.add("DB_URL", postgres::getJdbcUrl);
        registry.add("DB_USERNAME", postgres::getUsername);
        registry.add("DB_PASSWORD", postgres::getPassword);
        registry.add("fonzkart.auth.secret", () -> AUTH_SECRET);
        registry.add("fonzkart.auth.app-url", () -> "https://www.fonzkart.in");
        registry.add("fonzkart.mail.host", () -> "smtp.test.invalid");
        registry.add("fonzkart.mail.port", () -> "1025");
        registry.add("fonzkart.mail.user", () -> "noreply@fonzkart.in");
        registry.add("fonzkart.mail.pass", () -> "x");
    }

    @TestConfiguration
    public static class RecordingMailConfig {
        /** Replaces the SMTP transport (it is a {@link MailTransport} and wins as @Primary). */
        @Bean
        @Primary
        public RecordingMailTransport recordingMailTransport() {
            return new RecordingMailTransport();
        }
    }
}
