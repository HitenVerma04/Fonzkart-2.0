package in.fonzkart.backend.catalog.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Iterator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The device questionnaire the website keeps in lib/data.ts → questionnaireSteps (category → steps → options),
 * served so the apps ask exactly the same questions. {@code catalog/questionnaire.json} is generated from the
 * TypeScript source (backend/tools/catalog-sync/generate.mjs); like the catalog reads, it needs no login.
 * <p>
 * Steps, sections and options marked {@code showFor} (the iCloud lock on iPhones, the hinge on folding phones) are
 * only for apps that pick them by device: they ask with {@code ?showFor=true}. Older app versions would show them on
 * every phone, so they get the questionnaire without them.
 */
@RestController
@RequestMapping("/api/catalog")
public class QuestionnaireController {

    private final JsonNode questionnaire;
    private final JsonNode withoutDeviceOnly;

    public QuestionnaireController(ObjectMapper objectMapper) {
        try (InputStream in = new ClassPathResource("catalog/questionnaire.json").getInputStream()) {
            this.questionnaire = objectMapper.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read catalog/questionnaire.json", e);
        }
        this.withoutDeviceOnly = strip(questionnaire.deepCopy());
    }

    @GetMapping("/questionnaire")
    public JsonNode getQuestionnaire(@RequestParam(defaultValue = "false") boolean showFor) {
        return showFor ? questionnaire : withoutDeviceOnly;
    }

    /** Removes every array item marked showFor, at any depth. */
    private static JsonNode strip(JsonNode node) {
        if (node instanceof ArrayNode array) {
            for (Iterator<JsonNode> it = array.elements(); it.hasNext(); ) {
                JsonNode item = it.next();
                if (item.has("showFor")) {
                    it.remove();
                } else {
                    strip(item);
                }
            }
        } else if (node instanceof ObjectNode object) {
            object.elements().forEachRemaining(QuestionnaireController::strip);
        }
        return node;
    }
}
