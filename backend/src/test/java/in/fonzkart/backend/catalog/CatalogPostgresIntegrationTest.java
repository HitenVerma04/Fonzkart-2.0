package in.fonzkart.backend.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import in.fonzkart.backend.catalog.repository.BrandRepository;
import in.fonzkart.backend.catalog.repository.DeviceModelRepository;
import in.fonzkart.backend.catalog.repository.VariantRepository;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.env.Environment;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.util.UriUtils;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.MountableFile;

/**
 * End-to-end check against a real PostgreSQL 15 built from the Prisma-generated schema
 * (src/test/resources/db). Verifies:
 * <ol>
 *   <li>the application starts and Hibernate validates the existing schema,</li>
 *   <li>the schema is byte-for-byte unchanged afterwards (tables, columns, defaults, constraints, indexes),</li>
 *   <li>database connections are read-only,</li>
 *   <li>JVM and PostgreSQL session time zone are UTC and timestamp handling matches Prisma's UTC convention,</li>
 *   <li>every catalog API response equals the response of the ORIGINAL TypeScript code on the same data
 *       (golden/catalog-api-expected.json, captured by running lib/store.ts + actions/catalog.ts with Prisma).</li>
 * </ol>
 * Skipped automatically when Docker is not available.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CatalogPostgresIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:15")
            .withDatabaseName("fonzkart")
            .withCopyFileToContainer(MountableFile.forClasspathResource("db/01-prisma-schema.sql"),
                    "/docker-entrypoint-initdb.d/01-prisma-schema.sql")
            .withCopyFileToContainer(MountableFile.forClasspathResource("db/02-catalog-data.sql"),
                    "/docker-entrypoint-initdb.d/02-catalog-data.sql");

    /** Schema fingerprint taken BEFORE the Spring context (and Hibernate) touches the database. */
    private static String schemaBeforeStartup;

    private static final String SCHEMA_FINGERPRINT_SQL = """
            SELECT string_agg(x, E'\\n' ORDER BY x) FROM (
              SELECT 'table ' || tablename AS x FROM pg_tables WHERE schemaname = 'public'
              UNION ALL
              SELECT 'column ' || table_name || '.' || column_name || ' ' || data_type || ' ' || udt_name || ' '
                     || is_nullable || ' ' || coalesce(column_default, '')
              FROM information_schema.columns WHERE table_schema = 'public'
              UNION ALL
              SELECT 'constraint ' || conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid)
              FROM pg_constraint WHERE connamespace = 'public'::regnamespace
              UNION ALL
              SELECT 'index ' || indexdef FROM pg_indexes WHERE schemaname = 'public'
              UNION ALL
              SELECT 'sequence ' || sequencename FROM pg_sequences WHERE schemaname = 'public'
            ) s
            """;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) throws Exception {
        schemaBeforeStartup = fingerprint();
        registry.add("DB_URL", POSTGRES::getJdbcUrl);
        registry.add("DB_USERNAME", POSTGRES::getUsername);
        registry.add("DB_PASSWORD", POSTGRES::getPassword);
    }

    @Autowired
    private TestRestTemplate rest;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private Environment environment;
    @Autowired
    private PlatformTransactionManager transactionManager;

    private final ObjectMapper mapper = new ObjectMapper();

    // ---- 1 & 2: startup + schema untouched ------------------------------------------------------------

    @Test
    void hibernateValidatesExistingSchemaWithoutChangingIt() throws Exception {
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(schemaBeforeStartup).contains("table Brand", "table Model", "table Variant");
        assertThat(fingerprint()).isEqualTo(schemaBeforeStartup);
        assertThat(rest.getForEntity("/actuator/health", String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    // ---- 3: read-only ---------------------------------------------------------------------------------

    @Test
    void catalogRunsInDatabaseEnforcedReadOnlyTransactions() {
        // Every catalog repository is declared @Transactional(readOnly = true) ...
        for (Class<?> repository : List.of(BrandRepository.class, DeviceModelRepository.class, VariantRepository.class)) {
            Transactional tx = repository.getAnnotation(Transactional.class);
            assertThat(tx).as(repository.getSimpleName()).isNotNull();
            assertThat(tx.readOnly()).as(repository.getSimpleName()).isTrue();
        }
        // ... and a read-only transaction is enforced by PostgreSQL itself (pgjdbc readOnlyMode=always).
        TransactionTemplate readOnly = new TransactionTemplate(transactionManager);
        readOnly.setReadOnly(true);
        assertThatThrownBy(() -> readOnly.executeWithoutResult(s -> jdbc.update(
                "INSERT INTO \"Brand\" (\"id\", \"name\", \"logo\") VALUES ('it-write', 'x', 'x')")))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("read-only transaction");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"Brand\" WHERE id = 'it-write'", Integer.class)).isZero();
    }

    // ---- 4: time zone and date handling --------------------------------------------------------------

    @Test
    void jvmAndDatabaseSessionUseUtc() {
        assertThat(TimeZone.getDefault().getID()).isEqualTo("UTC");
        assertThat(jdbc.queryForObject("SHOW TimeZone", String.class)).isEqualTo("UTC");
        assertThat(environment.getProperty("spring.jpa.properties.hibernate.jdbc.time_zone")).isEqualTo("UTC");
    }

    @Test
    void timestampWithoutTimeZoneIsReadAsUtcLikePrisma() {
        // Prisma writes DateTime as the UTC wall-clock value into "timestamp(3) without time zone".
        Timestamp stored = jdbc.queryForObject(
                "SELECT CAST('2026-03-01 12:34:56.789' AS timestamp(3))", Timestamp.class);
        assertThat(stored.toInstant()).isEqualTo(Instant.parse("2026-03-01T12:34:56.789Z"));
        assertThat(stored.toLocalDateTime()).isEqualTo(LocalDateTime.parse("2026-03-01T12:34:56.789"));

        // A column default of CURRENT_TIMESTAMP (Prisma @default(now())) evaluated in this session must be "now" in UTC.
        Timestamp dbNow = jdbc.queryForObject("SELECT CAST(CURRENT_TIMESTAMP AS timestamp(3))", Timestamp.class);
        assertThat(Duration.between(dbNow.toInstant(), Instant.now()).abs()).isLessThan(Duration.ofMinutes(2));
    }

    // ---- 5: parity with the original TypeScript ------------------------------------------------------

    @Test
    void catalogApiMatchesOriginalTypeScriptResponses() throws Exception {
        JsonNode expected;
        try (InputStream in = getClass().getResourceAsStream("/golden/catalog-api-expected.json")) {
            expected = mapper.readTree(in);
        }

        List<String> mismatches = new ArrayList<>();
        int calls = 0;
        for (Iterator<Map.Entry<String, JsonNode>> it = expected.fields(); it.hasNext(); ) {
            Map.Entry<String, JsonNode> entry = it.next();
            calls++;
            JsonNode actual = call(entry.getKey());
            if (!entry.getValue().equals(actual)) {
                mismatches.add(entry.getKey() + "\n  expected: " + abbreviate(entry.getValue()) + "\n  actual:   " + abbreviate(actual));
            }
        }

        assertThat(calls).isEqualTo(167);
        assertThat(mismatches).as("responses differing from the original TypeScript").isEmpty();
    }

    /** Executes a call recorded as e.g. {@code getModels("samsung","Mobile")}; null arguments mean "not passed". */
    private JsonNode call(String recorded) throws Exception {
        String kind = recorded.substring(0, recorded.indexOf('('));
        JsonNode args = mapper.readTree("[" + recorded.substring(recorded.indexOf('(') + 1, recorded.lastIndexOf(')')) + "]");

        String path = switch (kind) {
            case "getBrands" -> "/api/catalog/brands" + query("category", args.get(0));
            case "getBrand" -> "/api/catalog/brands/" + UriUtils.encodePathSegment(args.get(0).asText(), StandardCharsets.UTF_8);
            case "getModels" -> "/api/catalog/models" + query("brandId", args.get(0), "category", args.get(1));
            case "searchGlobalModels" -> "/api/catalog/models/search" + query("query", args.get(0));
            case "getVariants" -> "/api/catalog/variants" + query("modelId", args.get(0));
            case "findVariantByName" -> "/api/catalog/variants/lookup" + query("deviceName", args.get(0));
            default -> throw new IllegalArgumentException("Unknown call " + recorded);
        };

        ResponseEntity<String> response = rest.getForEntity(URI.create(rest.getRootUri() + path), String.class);
        if (response.getStatusCode() == HttpStatus.NOT_FOUND) {
            return mapper.nullNode(); // the original returns null
        }
        assertThat(response.getStatusCode()).as(recorded).isEqualTo(HttpStatus.OK);
        return mapper.readTree(response.getBody());
    }

    private static String query(Object... nameValuePairs) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < nameValuePairs.length; i += 2) {
            JsonNode value = (JsonNode) nameValuePairs[i + 1];
            if (value == null || value.isNull()) {
                continue;
            }
            sb.append(sb.isEmpty() ? '?' : '&')
                    .append(nameValuePairs[i]).append('=')
                    .append(URLEncoder.encode(value.asText(), StandardCharsets.UTF_8));
        }
        return sb.toString();
    }

    private static String abbreviate(JsonNode node) {
        String s = String.valueOf(node);
        return s.length() > 400 ? s.substring(0, 400) + "..." : s;
    }

    /**
     * Raw JDBC connection (outside Spring). The first call happens before the application has switched the JVM
     * to UTC, so the zone is set to UTC only while connecting and then restored; this keeps
     * {@link #jvmAndDatabaseSessionUseUtc()} a real check of the application's own UTC setup.
     */
    private static String fingerprint() throws Exception {
        TimeZone original = TimeZone.getDefault();
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        try (Connection c = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery(SCHEMA_FINGERPRINT_SQL)) {
            rs.next();
            return rs.getString(1);
        } finally {
            TimeZone.setDefault(original);
        }
    }
}
