package in.fonzkart.backend.pricing.service;

import java.time.YearMonth;
import java.time.ZoneId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Applies a new version of catalog/launch-prices.json when the backend starts (see {@link LaunchPriceImport}). A failure
 * is logged and never stops the backend. Off with {@code fonzkart.catalog.launch-prices=false} (the tests).
 */
@Component
@Order(10)
@ConditionalOnProperty(name = "fonzkart.catalog.launch-prices", havingValue = "true", matchIfMissing = true)
class LaunchPriceImportRunner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(LaunchPriceImportRunner.class);
    private final LaunchPriceImport importer;
    private final MaxValueService maxValues;
    private final CatalogImageFix images;

    LaunchPriceImportRunner(LaunchPriceImport importer, MaxValueService maxValues, CatalogImageFix images) {
        this.importer = importer;
        this.maxValues = maxValues;
        this.images = images;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            importer.apply(YearMonth.now(ZoneId.of("Asia/Kolkata")));
        } catch (RuntimeException e) {
            LOG.error("[catalog] launch prices were not applied", e);
        }
        try {
            images.apply();
        } catch (RuntimeException e) {
            LOG.error("[catalog] model pictures were not fixed", e);
        }
        try {
            int n = maxValues.syncLaunchFile(importer.bundled());
            if (n > 0) {
                LOG.info("[pricing] launch data recorded for {} variants (their max values now follow the monthly revaluation)", n);
            }
        } catch (RuntimeException e) {
            LOG.error("[pricing] launch data was not recorded", e);
        }
    }
}
