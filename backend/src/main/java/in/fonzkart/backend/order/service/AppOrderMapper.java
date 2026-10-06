package in.fonzkart.backend.order.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import in.fonzkart.backend.order.dto.AppOrderDto;
import in.fonzkart.backend.order.dto.AppOrderDto.Location;
import in.fonzkart.backend.order.dto.AppOrderDto.UserSummary;
import in.fonzkart.backend.order.entity.OrderRecord;
import in.fonzkart.backend.shared.time.JsDates;
import in.fonzkart.backend.shared.web.ActionException;
import in.fonzkart.backend.user.entity.User;
import java.util.Arrays;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Port of lib/store.ts → mapPrismaOrderToAppOrder(), unchanged (read-only use until the order domain migrates). */
@Component
public class AppOrderMapper {

    private final ObjectMapper mapper;

    public AppOrderMapper(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public AppOrderDto toAppOrder(OrderRecord o, User user) {
        // try { answersObj = o.answers ? JSON.parse(o.answers) : null } catch { answersObj = null }
        JsonNode answers = null;
        if (o.getAnswers() != null && !o.getAnswers().isEmpty()) {
            try {
                answers = jsNumbers(mapper.readTree(o.getAnswers()));
            } catch (Exception e) {
                answers = null;
            }
        }
        boolean isCompleted = "completed".equals(o.getStatus());
        JsonNode hubStatus = field(answers, "hubStatus");
        if (!truthy(hubStatus)) {
            hubStatus = isCompleted ? JsonNodeFactory.instance.textNode("pending") : null;
        }
        // riderAnswers: o.riderAnswers ? JSON.parse(o.riderAnswers) : null — NOT guarded in the original (throws)
        JsonNode riderAnswers = null;
        if (o.getRiderAnswers() != null && !o.getRiderAnswers().isEmpty()) {
            try {
                riderAnswers = jsNumbers(mapper.readTree(o.getRiderAnswers()));
            } catch (Exception e) {
                throw new ActionException(HttpStatus.INTERNAL_SERVER_ERROR, "Invalid riderAnswers JSON in order " + o.getId());
            }
        }
        // (o.locationLat && o.locationLng) — 0 counts as missing, as in JavaScript
        Location location = o.getLocationLat() != null && o.getLocationLat() != 0
                && o.getLocationLng() != null && o.getLocationLng() != 0
                && !o.getLocationLat().isNaN() && !o.getLocationLng().isNaN()
                ? new Location(o.getLocationLat(), o.getLocationLng()) : null;

        return new AppOrderDto(o.getId(), o.getOrderNumber(), o.getUserId(),
                user == null ? null : new UserSummary(user.getId(), user.getName(), user.getEmail(), user.getPhone()),
                o.getDevice(), o.getPrice(), JsDates.toIsoString(o.getCreatedAt()), o.getStatus(), o.getAddress(),
                o.getPincode(), location, o.getRiderId(), o.getPartnerId(), answers, riderAnswers,
                o.getVerificationImages() == null ? List.of() : Arrays.asList(o.getVerificationImages()),
                o.getOfferedPrice(), hubStatus, orNull(field(answers, "hubHandoverAt")),
                orNull(field(answers, "hubReceivedBy")));
    }

    /**
     * JSON.parse() turns every number into a JavaScript number, so 1.0 becomes 1. Jackson keeps 1.0 as a floating
     * node; integral floating values are converted so re-serialised JSON matches the original's.
     */
    private static JsonNode jsNumbers(JsonNode node) {
        if (node == null) {
            return null;
        }
        if (node.isFloatingPointNumber()) {
            double d = node.asDouble();
            if (d == Math.rint(d) && Math.abs(d) < 9.007199254740992E15) {
                return JsonNodeFactory.instance.numberNode((long) d);
            }
            return JsonNodeFactory.instance.numberNode(d);
        }
        if (node.isArray()) {
            com.fasterxml.jackson.databind.node.ArrayNode a = JsonNodeFactory.instance.arrayNode();
            node.forEach(n -> a.add(jsNumbers(n)));
            return a;
        }
        if (node.isObject()) {
            com.fasterxml.jackson.databind.node.ObjectNode o = JsonNodeFactory.instance.objectNode();
            node.fields().forEachRemaining(e -> o.set(e.getKey(), jsNumbers(e.getValue())));
            return o;
        }
        return node;
    }

    /** answersObj?.[name] */
    private static JsonNode field(JsonNode obj, String name) {
        return obj != null && obj.isObject() ? obj.get(name) : null;
    }

    /** value || null */
    private static JsonNode orNull(JsonNode v) {
        return truthy(v) ? v : null;
    }

    /** JavaScript truthiness of a parsed JSON value. */
    static boolean truthy(JsonNode v) {
        if (v == null || v.isNull() || v.isMissingNode()) {
            return false;
        }
        if (v.isTextual()) {
            return !v.asText().isEmpty();
        }
        if (v.isBoolean()) {
            return v.asBoolean();
        }
        if (v.isNumber()) {
            double d = v.asDouble();
            return d != 0 && !Double.isNaN(d);
        }
        return true; // objects and arrays
    }
}
