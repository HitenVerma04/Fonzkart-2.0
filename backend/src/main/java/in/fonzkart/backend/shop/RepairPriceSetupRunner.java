package in.fonzkart.backend.shop;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * On startup: adds the price-range column when it is missing, then applies a new version of repair/repair-prices.json.
 * Failures are logged and never stop the backend. The price list is off with {@code fonzkart.repair.seed=false}.
 */
@Component
@Order(1)
class RepairPriceSetupRunner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(RepairPriceSetupRunner.class);
    private final RepairPriceSheet sheet;
    private final boolean seed;

    RepairPriceSetupRunner(RepairPriceSheet sheet, @Value("${fonzkart.repair.seed:true}") boolean seed) {
        this.sheet = sheet;
        this.seed = seed;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            sheet.ensureColumns();
        } catch (RuntimeException e) {
            LOG.error("[repair] the priceMax column could not be added", e);
            return;
        }
        if (!seed) {
            return;
        }
        try {
            sheet.apply();
        } catch (RuntimeException e) {
            LOG.error("[repair] the repair price ranges were not applied", e);
        }
    }
}
