package in.fonzkart.backend.content;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.support.PostgresTestBase;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** The home-page carousel: who may read and change it, what customers see, and what a card may contain. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestBase.RecordingMailConfig.class)
class CarouselIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = PostgresTestBase.emptyPrismaDatabase();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PostgresTestBase.register(registry, POSTGRES);
    }

    @LocalServerPort
    private int port;
    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();

    @BeforeEach
    void cleanDatabase() {
        jdbc.update("DELETE FROM \"CarouselSlide\"");
        jdbc.update("DELETE FROM \"User\"");
    }

    @Test
    void onlyAdministratorsChangeTheCarousel() throws Exception {
        assertThat(post("/api/content/carousel", null, card("Sell now", null)).statusCode()).isEqualTo(401);

        String customer = quickRegister("Cara", "cara@example.test");
        assertThat(post("/api/content/carousel", customer, card("Sell now", null)).statusCode()).isEqualTo(403);
        assertThat(get("/api/content/carousel/admin", customer).statusCode()).isEqualTo(403);

        String partner = quickRegister("Pat", "pat@example.test");
        jdbc.update("UPDATE \"User\" SET role = 'PARTNER' WHERE email = 'pat@example.test'");
        assertThat(post("/api/content/carousel", partner, card("Sell now", null)).statusCode()).isEqualTo(403);

        String admin = quickRegister("Ada", "ada@example.test");
        jdbc.update("UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'ada@example.test'");
        assertThat(post("/api/content/carousel", admin, card("Sell now", null)).statusCode()).isEqualTo(200);

        String id = jdbc.queryForObject("SELECT id FROM \"CarouselSlide\"", String.class);
        assertThat(put("/api/content/carousel/" + id, customer, card("Changed", null)).statusCode()).isEqualTo(403);
        assertThat(delete("/api/content/carousel/" + id, customer).statusCode()).isEqualTo(403);
        assertThat(put("/api/content/carousel/order", customer, List.of(Map.of("id", id, "displayOrder", 5))).statusCode())
                .isEqualTo(403);
        assertThat(jdbc.queryForObject("SELECT title FROM \"CarouselSlide\"", String.class)).isEqualTo("Sell now");
    }

    @Test
    void customersSeeVisibleCardsInOrder() throws Exception {
        String admin = superAdmin();
        assertThat(json(get("/api/content/carousel", null))).isEmpty();

        String first = json(post("/api/content/carousel", admin, card("Phones", "smartphone"))).get("id").asText();
        Map<String, Object> hidden = card("Hidden", null);
        hidden.put("isActive", false);
        String second = json(post("/api/content/carousel", admin, hidden)).get("id").asText();
        String third = json(post("/api/content/carousel", admin, card("Laptops", "laptop"))).get("id").asText();

        // Added cards go to the end.
        assertThat(ids(json(get("/api/content/carousel/admin", admin)))).containsExactly(first, second, third);
        JsonNode visible = json(get("/api/content/carousel", null));
        assertThat(ids(visible)).containsExactly(first, third);
        JsonNode phones = visible.get(0);
        assertThat(phones.get("imageUrl").asText()).isEqualTo("/uploads/banner.png");
        assertThat(phones.get("title").asText()).isEqualTo("Phones");
        assertThat(phones.get("subtitle").asText()).isEqualTo("Best prices this week");
        assertThat(phones.get("category").asText()).isEqualTo("smartphone");
        assertThat(phones.get("isActive").asBoolean()).isTrue();

        // Reorder: the laptop card first.
        json(put("/api/content/carousel/order", admin, List.of(Map.of("id", third, "displayOrder", 0),
                Map.of("id", first, "displayOrder", 1), Map.of("id", second, "displayOrder", 2))));
        assertThat(ids(json(get("/api/content/carousel", null)))).containsExactly(third, first);

        // An unknown card in a reorder changes nothing.
        assertThat(put("/api/content/carousel/order", admin, List.of(Map.of("id", first, "displayOrder", 9),
                Map.of("id", "missing", "displayOrder", 0))).statusCode()).isEqualTo(404);
        assertThat(ids(json(get("/api/content/carousel", null)))).containsExactly(third, first);

        // Edit: show the hidden card, no category; the position stays when none is sent.
        Map<String, Object> edited = card("Now visible", "");
        json(put("/api/content/carousel/" + second, admin, edited));
        JsonNode all = json(get("/api/content/carousel", null));
        assertThat(ids(all)).containsExactly(third, first, second);
        assertThat(all.get(2).get("title").asText()).isEqualTo("Now visible");
        assertThat(all.get(2).get("category").isNull()).isTrue();

        json(delete("/api/content/carousel/" + first, admin));
        assertThat(ids(json(get("/api/content/carousel", null)))).containsExactly(third, second);
        assertThat(delete("/api/content/carousel/" + first, admin).statusCode()).isEqualTo(404);
        assertThat(put("/api/content/carousel/" + first, admin, card("Gone", null)).statusCode()).isEqualTo(404);
    }

    @Test
    void cardsAreChecked() throws Exception {
        String admin = superAdmin();
        assertThat(error(post("/api/content/carousel", admin, card("", null)))).isEqualTo("Add a title.");
        assertThat(error(post("/api/content/carousel", admin, card("x".repeat(61), null))))
                .isEqualTo("The title can have at most 60 characters.");

        Map<String, Object> longText = card("Ok", null);
        longText.put("subtitle", "x".repeat(121));
        assertThat(error(post("/api/content/carousel", admin, longText))).isEqualTo("The text can have at most 120 characters.");

        assertThat(error(post("/api/content/carousel", admin, card("Ok", "fridge")))).isEqualTo("Unknown category.");

        for (String bad : List.of("javascript:alert(1)", "http://example.test/a.png", "//evil.test/a.png",
                "data:image/png;base64,AAAA", "/uploads/a b.png")) {
            Map<String, Object> c = card("Ok", null);
            c.put("imageUrl", bad);
            assertThat(error(post("/api/content/carousel", admin, c))).as(bad)
                    .isEqualTo("The picture must be an uploaded picture or an https link.");
        }
        Map<String, Object> noPicture = card("Ok", null);
        noPicture.put("imageUrl", "  ");
        assertThat(error(post("/api/content/carousel", admin, noPicture))).isEqualTo("Add a picture.");

        Map<String, Object> https = card("  Trimmed  ", null);
        https.put("imageUrl", "https://cdn.example.test/banner.webp");
        json(post("/api/content/carousel", admin, https));
        assertThat(jdbc.queryForObject("SELECT title FROM \"CarouselSlide\"", String.class)).isEqualTo("Trimmed");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM \"CarouselSlide\"", Integer.class)).isEqualTo(1);
    }

    // ------------------------------------------------------------------------------------------------ helpers

    private static Map<String, Object> card(String title, String category) {
        Map<String, Object> m = new HashMap<>();
        m.put("imageUrl", "/uploads/banner.png");
        m.put("title", title);
        m.put("subtitle", "Best prices this week");
        m.put("category", category);
        return m;
    }

    private String superAdmin() throws Exception {
        HttpResponse<String> r = post("/api/auth/signup", null,
                Map.of("name", "Root", "email", "admin@fonzkart.in", "phone", "9000000000", "password", "pw"));
        return cookie(r.headers().firstValue("Set-Cookie").orElseThrow());
    }

    private String quickRegister(String name, String email) throws Exception {
        return cookie(post("/api/auth/quick-register", null, Map.of("name", name, "email", email, "password", "pw"))
                .headers().firstValue("Set-Cookie").orElseThrow());
    }

    private static String cookie(String setCookie) {
        return setCookie.split(";", 2)[0];
    }

    private static List<String> ids(JsonNode array) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(n.get("id").asText()));
        return out;
    }

    private JsonNode json(HttpResponse<String> r) throws Exception {
        assertThat(r.statusCode()).as(r.body()).isEqualTo(200);
        return mapper.readTree(r.body());
    }

    private String error(HttpResponse<String> r) throws Exception {
        assertThat(r.statusCode()).as(r.body()).isEqualTo(400);
        return mapper.readTree(r.body()).get("error").asText();
    }

    private HttpResponse<String> get(String path, String cookie) throws Exception {
        return send(HttpRequest.newBuilder(uri(path)).GET(), cookie);
    }

    private HttpResponse<String> delete(String path, String cookie) throws Exception {
        return send(HttpRequest.newBuilder(uri(path)).DELETE(), cookie);
    }

    private HttpResponse<String> post(String path, String cookie, Object body) throws Exception {
        return send(HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))), cookie);
    }

    private HttpResponse<String> put(String path, String cookie, Object body) throws Exception {
        return send(HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))), cookie);
    }

    private HttpResponse<String> send(HttpRequest.Builder b, String cookie) throws Exception {
        if (cookie != null) {
            b.header("Cookie", cookie);
        }
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }
}
