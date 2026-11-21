package in.fonzkart.backend.city.service;

import in.fonzkart.backend.user.service.PartnerCities;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * On startup: creates the "PartnerCity" table (partners serving more than one city) when it is missing, then applies a
 * new version of cities/major-cities.json. Failures are logged and never stop the backend. The city list is off with
 * {@code fonzkart.cities.seed=false} (the tests add their own cities).
 */
@Component
@Order(1)
class CitySetupRunner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(CitySetupRunner.class);
    private final PartnerCities partnerCities;
    private final MajorCities majorCities;
    private final boolean seed;

    CitySetupRunner(PartnerCities partnerCities, MajorCities majorCities,
                    @Value("${fonzkart.cities.seed:true}") boolean seed) {
        this.partnerCities = partnerCities;
        this.majorCities = majorCities;
        this.seed = seed;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            partnerCities.ensureTable();
        } catch (RuntimeException e) {
            LOG.error("[cities] the PartnerCity table could not be created", e);
        }
        if (!seed) {
            return;
        }
        try {
            majorCities.apply();
        } catch (RuntimeException e) {
            LOG.error("[cities] the major cities were not added", e);
        }
    }
}
