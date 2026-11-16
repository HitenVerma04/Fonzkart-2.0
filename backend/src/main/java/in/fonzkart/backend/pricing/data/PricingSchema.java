package in.fonzkart.backend.pricing.data;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Creates the pricing engine's tables when the backend starts (pricing/schema.sql, every statement IF NOT EXISTS), so
 * a deploy needs no SQL run by hand. Runs before everything else that starts with the backend. A failure is logged and
 * never stops the backend: prices are then worked out without the engine's data (category shares and the prior repair
 * costs), as {@link PricingData} reads fail soft.
 */
@Component
@Order(0)
public class PricingSchema implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(PricingSchema.class);
    private final JdbcTemplate jdbc;

    public PricingSchema(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        ensure();
    }

    /** Runs pricing/schema.sql; true when every statement ran. */
    public boolean ensure() {
        String sql;
        try (InputStream in = new ClassPathResource("pricing/schema.sql").getInputStream()) {
            sql = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            LOG.error("[pricing] pricing/schema.sql could not be read", e);
            return false;
        }
        StringBuilder clean = new StringBuilder();
        for (String line : sql.split("\n")) {
            if (!line.trim().startsWith("--")) {
                clean.append(line).append('\n');
            }
        }
        boolean ok = true;
        for (String statement : clean.toString().split(";")) {
            if (statement.isBlank()) {
                continue;
            }
            try {
                jdbc.execute(statement.trim());
            } catch (RuntimeException e) {
                ok = false;
                LOG.error("[pricing] schema statement failed: {}", statement.trim().lines().findFirst().orElse(""), e);
            }
        }
        return ok;
    }
}
