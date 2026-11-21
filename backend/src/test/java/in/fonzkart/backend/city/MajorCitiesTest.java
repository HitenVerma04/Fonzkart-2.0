package in.fonzkart.backend.city;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.city.service.MajorCities;
import in.fonzkart.backend.support.PostgresTestBase;
import java.util.HashSet;
import java.util.Set;
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

/** cities/major-cities.json: missing cities added once per version; cities an admin set up are left as they are. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@Import(PostgresTestBase.RecordingMailConfig.class)
class MajorCitiesTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.prismaDatabaseWith();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    @Autowired
    private MajorCities majorCities;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void addsMissingCitiesOnceAndKeepsWhatAdminsSetUp() throws Exception {
        jdbc.update("INSERT INTO \"City\" (id, name, \"isActive\", pincodes, \"displayOrder\", \"isFeatured\", \"createdAt\", \"updatedAt\") "
                + "VALUES ('c-blr', 'Bengaluru', false, '{560001}', 0, false, now(), now()), "
                + "('c-pune', 'Pune', true, '{}', 0, false, now(), now())");
        JsonNode file = new ObjectMapper().readTree("""
                {"version": "t1", "cities": [
                  {"name": "Bangalore", "aliases": ["Bengaluru"], "pincodes": [[560001, 560003]]},
                  {"name": "Pune", "aliases": [], "pincodes": [[411001, 411002]]},
                  {"name": "Delhi", "aliases": ["New Delhi"], "pincodes": [[110001, 110003]]}
                ]}""");

        MajorCities.Result first = majorCities.apply(file);
        assertThat(first.applied()).isTrue();
        assertThat(first.added()).isEqualTo(1);
        assertThat(first.filled()).isEqualTo(1);
        // Bengaluru is Bangalore: not added twice, its own switch and pincodes stay.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"City\"", Integer.class)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT \"isActive\" FROM \"City\" WHERE id = 'c-blr'", Boolean.class)).isFalse();
        assertThat(jdbc.queryForObject("SELECT array_to_string(pincodes, ',') FROM \"City\" WHERE id = 'c-blr'", String.class))
                .isEqualTo("560001");
        assertThat(jdbc.queryForObject("SELECT array_to_string(pincodes, ',') FROM \"City\" WHERE id = 'c-pune'", String.class))
                .isEqualTo("411001,411002");
        assertThat(jdbc.queryForObject("SELECT array_to_string(pincodes, ',') || '|' || \"isActive\" FROM \"City\" WHERE name = 'Delhi'",
                String.class)).isEqualTo("110001,110002,110003|true");

        jdbc.update("DELETE FROM \"City\" WHERE name = 'Delhi'");
        assertThat(majorCities.apply(file).applied()).isFalse(); // once per version
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"City\"", Integer.class)).isEqualTo(2);
    }

    @Test
    void theBundledListIsSound() throws Exception {
        JsonNode file = new ObjectMapper().readTree(new ClassPathResource("cities/major-cities.json").getInputStream());
        Set<String> names = new HashSet<>();
        assertThat(file.path("cities").size()).isGreaterThanOrEqualTo(30);
        for (JsonNode c : file.path("cities")) {
            assertThat(names.add(c.path("name").asText().toLowerCase())).as(c.path("name").asText()).isTrue();
            for (JsonNode span : c.path("pincodes")) {
                int from = span.path(0).asInt();
                int to = span.path(1).asInt();
                assertThat(from).as(c.path("name").asText()).isBetween(110000, 999999);
                assertThat(to).as(c.path("name").asText()).isBetween(from, from + 999);
            }
        }
    }
}
