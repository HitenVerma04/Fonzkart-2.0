package in.fonzkart.backend.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.pricing.service.CatalogImageFix;
import in.fonzkart.backend.support.PostgresTestBase;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** catalog/model-images.json: wrong pictures replaced once per version, pictures set by admins left alone. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@Import(PostgresTestBase.RecordingMailConfig.class)
class CatalogImageFixTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.prismaDatabaseWith();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    @Autowired
    private CatalogImageFix fix;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void replacesOnlyTheListedWrongPicturesOncePerVersion() throws Exception {
        jdbc.update("INSERT INTO \"Brand\" (id, name, logo, categories, priority) VALUES ('sx', 'SX', 'https://gone.example/logo.png', '{watch}', 1)");
        jdbc.update("INSERT INTO \"Model\" (id, \"brandId\", name, img, category, priority) VALUES "
                + "('w-stand-in', 'sx', 'Watch One', '/models/sx/Phone.png', 'smartwatch', 10), "
                + "('w-admin', 'sx', 'Watch Two', '/uploads/admin-photo.png', 'watch', 10)");

        JsonNode file = new ObjectMapper().readTree("""
                {"version": "i1", "models": [
                  {"brandId": "sx", "category": "watch", "name": "watch one", "img": "/models/sx-smartwatch/One.png", "replaces": ["/models/sx/Phone.png"]},
                  {"brandId": "sx", "category": "watch", "name": "Watch Two", "img": "/models/sx-smartwatch/Two.png", "replaces": ["/models/sx/Phone.png"]}
                ],
                "brands": [{"id": "sx", "logo": "/models/sx/logo.png", "replaces": ["https://gone.example/logo.png"]}]}""");

        CatalogImageFix.Result first = fix.apply(file);
        assertThat(first.applied()).isTrue();
        assertThat(first.modelsUpdated()).isEqualTo(1);
        assertThat(first.brandsUpdated()).isEqualTo(1);
        assertThat(img("w-stand-in")).isEqualTo("/models/sx-smartwatch/One.png");
        assertThat(img("w-admin")).isEqualTo("/uploads/admin-photo.png"); // an admin's picture stays
        assertThat(jdbc.queryForObject("SELECT logo FROM \"Brand\" WHERE id = 'sx'", String.class)).isEqualTo("/models/sx/logo.png");

        jdbc.update("UPDATE \"Model\" SET img = '/models/sx/Phone.png' WHERE id = 'w-stand-in'");
        assertThat(fix.apply(file).applied()).isFalse(); // the same version is applied once
        assertThat(img("w-stand-in")).isEqualTo("/models/sx/Phone.png");
    }

    @Test
    void everyPictureTheBundledFileNamesExistsOnTheWebsite() throws Exception {
        JsonNode file = new ObjectMapper().readTree(new ClassPathResource("catalog/model-images.json").getInputStream());
        List<String> paths = new ArrayList<>();
        file.path("models").forEach(m -> paths.add(m.path("img").asText()));
        file.path("brands").forEach(b -> paths.add(b.path("logo").asText()));
        Path publicDir = Path.of("..", "public").toAbsolutePath().normalize();
        assertThat(paths).isNotEmpty().allSatisfy(p -> assertThat(Files.exists(publicDir.resolve(p.substring(1)))).as(p).isTrue());
        assertThat(fix.apply().version()).isNotBlank();
    }

    private String img(String id) {
        return jdbc.queryForObject("SELECT img FROM \"Model\" WHERE id = ?", String.class, id);
    }
}
