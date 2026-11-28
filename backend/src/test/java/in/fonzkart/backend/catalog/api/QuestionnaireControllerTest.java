package in.fonzkart.backend.catalog.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(QuestionnaireController.class)
class QuestionnaireControllerTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void servesTheGeneratedQuestionnaireUnchangedToAppsThatPickStepsByDevice() throws Exception {
        String file = new ClassPathResource("catalog/questionnaire.json").getContentAsString(StandardCharsets.UTF_8);

        mvc.perform(get("/api/catalog/questionnaire").param("showFor", "true"))
                .andExpect(status().isOk())
                .andExpect(content().json(file, true))
                .andExpect(jsonPath("$.smartphone[0].id").value("physical_condition"))
                .andExpect(jsonPath("$.smartphone[0].options[0].id").value("flawless"))
                .andExpect(jsonPath("$.smartphone[?(@.id == 'fold_check')]").isNotEmpty())
                .andExpect(jsonPath("$.smartphone[?(@.id == 'icloud_lock')]").isNotEmpty());
    }

    @Test
    void olderAppsGetNoDeviceOnlyQuestions() throws Exception {
        mvc.perform(get("/api/catalog/questionnaire"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.smartphone[0].id").value("physical_condition"))
                .andExpect(jsonPath("$.smartphone[?(@.id == 'fold_check')]").isEmpty())
                .andExpect(jsonPath("$.smartphone[?(@.id == 'icloud_lock')]").isEmpty())
                .andExpect(jsonPath("$.smartphone[?(@.id == 'functional_issues')].options[?(@.id == 'touch_faulty')]").isNotEmpty())
                .andExpect(jsonPath("$..showFor").isEmpty());
    }
}
