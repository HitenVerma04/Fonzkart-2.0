package in.fonzkart.backend.order.rules;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import in.fonzkart.backend.shared.web.JsNumberJacksonConfig;
import java.math.BigDecimal;
import java.util.Iterator;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * JSON as the website handles an order's text columns: {@code parseAnswers()} from lib/order-status.ts and
 * {@code JSON.stringify()}, with numbers written the way JavaScript writes them (1, not 1.0).
 */
@Component
public class OrderJson {

    private static final JsonNodeFactory F = JsonNodeFactory.instance;

    private final ObjectMapper mapper;

    public OrderJson(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    /**
     * parseAnswers(raw): an object stays as it is (a copy); a string is parsed and kept when it is an object; anything
     * else, an array or text that is not JSON gives {}.
     */
    public ObjectNode parseAnswers(JsonNode raw) {
        if (raw == null) {
            return F.objectNode();
        }
        if (raw.isObject()) {
            return (ObjectNode) jsNumbers(raw.deepCopy());
        }
        if (raw.isTextual()) {
            return parseAnswers(raw.asText());
        }
        return F.objectNode();
    }

    /** parseAnswers() of a text column. */
    public ObjectNode parseAnswers(String raw) {
        if (raw == null) {
            return F.objectNode();
        }
        try {
            JsonNode parsed = mapper.readTree(raw);
            return parsed != null && parsed.isObject() ? (ObjectNode) jsNumbers(parsed) : F.objectNode();
        } catch (JsonProcessingException e) {
            return F.objectNode();
        }
    }

    /** JSON.parse(text) for a column the original parses without a guard; null for null/empty. */
    public JsonNode parse(String raw) {
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        try {
            return jsNumbers(mapper.readTree(raw));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Invalid JSON in an order column", e);
        }
    }

    /** JSON.stringify(value); {@code null} (or a missing value) gives "null". */
    public String stringify(JsonNode value) {
        try {
            return mapper.writeValueAsString(value == null || value.isMissingNode() ? F.nullNode() : jsNumbers(value));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * {@code (target[key] ??= []).push(entry)}: a missing or null log becomes a new array; a value that is not an
     * array makes the original throw (push is not a function), so it does here too.
     */
    public static void appendToLog(ObjectNode target, String key, ObjectNode entry) {
        JsonNode existing = target.get(key);
        if (existing == null || existing.isNull()) {
            target.set(key, F.arrayNode().add(entry));
        } else if (existing.isArray()) {
            ((ArrayNode) existing).add(entry);
        } else {
            throw new IllegalStateException(key + " is not an array");
        }
    }

    /** JSON.parse() turns every number into a JavaScript number: 1.0 becomes 1 and is written without a fraction. */
    public static JsonNode jsNumbers(JsonNode node) {
        if (node == null) {
            return null;
        }
        if (node.isFloatingPointNumber() || node.isBigDecimal()) {
            double d = node.asDouble();
            if (Double.isNaN(d) || Double.isInfinite(d)) {
                return F.nullNode();
            }
            if (d == Math.rint(d) && Math.abs(d) < 9.007199254740992E15) {
                return F.numberNode((long) d);
            }
            double abs = Math.abs(d);
            if (abs >= 1e-6 && abs < 1e21) {
                return F.numberNode(new BigDecimal(JsNumberJacksonConfig.toJavaScriptString(d)));
            }
            return F.numberNode(d);
        }
        if (node.isArray()) {
            ArrayNode a = F.arrayNode();
            node.forEach(n -> a.add(jsNumbers(n)));
            return a;
        }
        if (node.isObject()) {
            ObjectNode o = F.objectNode();
            for (Iterator<Map.Entry<String, JsonNode>> it = node.fields(); it.hasNext(); ) {
                Map.Entry<String, JsonNode> e = it.next();
                o.set(e.getKey(), jsNumbers(e.getValue()));
            }
            return o;
        }
        return node;
    }
}
