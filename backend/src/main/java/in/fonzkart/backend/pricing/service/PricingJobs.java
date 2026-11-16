package in.fonzkart.backend.pricing.service;

import java.time.YearMonth;
import java.time.ZoneId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Every night at 03:30 (India): the monthly revaluation of auto max values (each variant once a month) and the
 * learning run (suggestions, and the small well-evidenced changes the engine makes itself). Nothing here ever stops
 * the backend. Off with {@code fonzkart.pricing.jobs=false} (the tests).
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "fonzkart.pricing.jobs", havingValue = "true", matchIfMissing = true)
public class PricingJobs {

    private static final Logger LOG = LoggerFactory.getLogger(PricingJobs.class);
    private final MaxValueService maxValues;
    private final PricingLearningService learning;

    public PricingJobs(MaxValueService maxValues, PricingLearningService learning) {
        this.maxValues = maxValues;
        this.learning = learning;
    }

    @Scheduled(cron = "0 30 3 * * *", zone = "Asia/Kolkata")
    public void nightly() {
        try {
            maxValues.revalueAll(YearMonth.now(ZoneId.of("Asia/Kolkata")));
        } catch (RuntimeException e) {
            LOG.error("[pricing] revaluation failed", e);
        }
        try {
            learning.run();
        } catch (RuntimeException e) {
            LOG.error("[pricing] learning run failed", e);
        }
    }
}
