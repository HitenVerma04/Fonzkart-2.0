package in.fonzkart.backend.shared.config;

import java.time.Clock;
import java.util.concurrent.Executor;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@ConfigurationPropertiesScan("in.fonzkart.backend")
public class CoreConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    /** Runs fire-and-forget emails (the original calls sendSystemEmail() without awaiting it). */
    @Bean
    public Executor mailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("mail-");
        executor.initialize();
        return executor;
    }
}
