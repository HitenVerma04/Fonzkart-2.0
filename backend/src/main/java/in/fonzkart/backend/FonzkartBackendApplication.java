package in.fonzkart.backend;

import in.fonzkart.backend.shared.time.UtcTimeZone;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class FonzkartBackendApplication {

    public static void main(String[] args) {
        // Earliest possible point (before logging starts). UtcTimeZone also runs as an EnvironmentPostProcessor
        // so the same guarantee holds when the application is started by tests or other launchers.
        UtcTimeZone.apply();
        SpringApplication.run(FonzkartBackendApplication.class, args);
    }
}
