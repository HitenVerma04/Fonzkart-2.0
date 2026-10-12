package in.fonzkart.backend.catalog.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The device questionnaire the website keeps in lib/data.ts → questionnaireSteps (category → steps → options),
 * served so the apps ask exactly the same questions. {@code catalog/questionnaire.json} is generated from the
 * TypeScript source (backend/tools/catalog-sync/generate.mjs); like the catalog reads, it needs no login.
 */
@RestController
@RequestMapping("/api/catalog")
public class QuestionnaireController {

    private final JsonNode questionnaire;

    public QuestionnaireController(ObjectMapper objectMapper) {
        try (InputStream in = new ClassPathResource("catalog/questionnaire.json").getInputStream()) {
            this.questionnaire = objectMapper.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read catalog/questionnaire.json", e);
        }
    }

    @GetMapping("/questionnaire")
    public JsonNode getQuestionnaire() {
        return questionnaire;
    }
}
