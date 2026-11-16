package in.fonzkart.backend.pricing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Launch month and price of the most traded phones (catalog/model-reference.json), matched to catalog models by brand
 * and a normalised name ("Galaxy S24 Ultra 5G" = "Samsung Galaxy S24 Ultra" = "galaxy s24 ultra"). Only a reference
 * for repair costs and the catalog checks; it never sets a price.
 */
@Component
public class ModelReference {

    private static final Logger LOG = LoggerFactory.getLogger(ModelReference.class);

    public record Ref(long launchPrice, String launchMonth) {
    }

    private final Map<String, Ref> byKey = new HashMap<>();

    public ModelReference(ObjectMapper mapper) {
        try (InputStream in = new ClassPathResource("catalog/model-reference.json").getInputStream()) {
            for (JsonNode m : mapper.readTree(in).path("models")) {
                byKey.put(key(m.path("brandId").asText(), m.path("name").asText()),
                        new Ref(m.path("launchPrice").asLong(), m.path("launched").asText()));
            }
        } catch (Exception e) {
            LOG.warn("[pricing] catalog/model-reference.json not loaded: {}", e.getMessage());
        }
    }

    public Optional<Ref> find(String brandId, String modelName) {
        return Optional.ofNullable(byKey.get(key(brandId, modelName)));
    }

    public int size() {
        return byKey.size();
    }

    /** brand | name in lower case, without the brand, "5G"/"4G" and punctuation, "+" as "plus". */
    static String key(String brandId, String name) {
        String brand = brandId == null ? "" : brandId.trim().toLowerCase(Locale.ROOT);
        String n = name == null ? "" : name.toLowerCase(Locale.ROOT).replace("+", " plus ");
        n = n.replaceAll("[^a-z0-9]+", " ").trim();
        String plainBrand = brand.replace("-", " ");
        if (n.startsWith(plainBrand + " ")) {
            n = n.substring(plainBrand.length() + 1);
        }
        n = (" " + n + " ").replace(" 5g ", " ").replace(" 4g ", " ").trim().replaceAll("\\s+", " ");
        return brand + "|" + n;
    }
}
