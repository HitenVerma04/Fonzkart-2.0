package in.fonzkart.backend.shop;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** On startup: adds the extra screen guard kinds ({@link ScreenGuardKinds}). Off with {@code fonzkart.shop.guard-kinds=false}. */
@Component
@Order(2)
class ScreenGuardKindsRunner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(ScreenGuardKindsRunner.class);
    private final ScreenGuardKinds kinds;
    private final boolean enabled;

    ScreenGuardKindsRunner(ScreenGuardKinds kinds, @Value("${fonzkart.shop.guard-kinds:true}") boolean enabled) {
        this.kinds = kinds;
        this.enabled = enabled;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            return;
        }
        try {
            kinds.apply();
        } catch (RuntimeException e) {
            LOG.error("[shop] the extra screen guard kinds were not added", e);
        }
    }
}
