package in.fonzkart.backend.pricing.rules;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.MissingNode;
import in.fonzkart.backend.shared.text.JsText;
import java.util.regex.Pattern;

/**
 * JavaScript value semantics over JSON values, as needed to evaluate the original pricing code exactly on
 * client-supplied answers. {@link MissingNode} represents {@code undefined}; a JSON null is {@code null}.
 */
public final class JsValues {

    /** Thrown where the original would throw a TypeError (the server action then fails). */
    public static final class JsTypeError extends RuntimeException {
        public JsTypeError(String message) {
            super("TypeError: " + message);
        }
    }

    private static final Pattern ARRAY_INDEX = Pattern.compile("0|[1-9][0-9]*");
    private static final Pattern DECIMAL = Pattern.compile("[+-]?(([0-9]+\\.?[0-9]*|\\.[0-9]+)([eE][+-]?[0-9]+)?)");

    private JsValues() {
    }

    public static JsonNode undefined() {
        return MissingNode.getInstance();
    }

    public static boolean isNullish(JsonNode v) {
        return v == null || v.isMissingNode() || v.isNull();
    }

    /** {@code target[key]} — throws like JavaScript when target is null or undefined. */
    public static JsonNode get(JsonNode target, String key) {
        if (isNullish(target)) {
            throw new JsTypeError("Cannot read properties of " + (target == null || target.isMissingNode() ? "undefined" : "null")
                    + " (reading '" + key + "')");
        }
        if (target.isObject()) {
            JsonNode v = target.get(key);
            return v == null ? undefined() : v;
        }
        if (target.isArray()) {
            if ("length".equals(key)) {
                return JsonNodeFactory.instance.numberNode(target.size());
            }
            if (ARRAY_INDEX.matcher(key).matches() && key.length() < 10 && Integer.parseInt(key) < target.size()) {
                return target.get(Integer.parseInt(key));
            }
            return undefined();
        }
        if (target.isTextual()) {
            String s = target.textValue();
            if ("length".equals(key)) {
                return JsonNodeFactory.instance.numberNode(s.length());
            }
            if (ARRAY_INDEX.matcher(key).matches() && key.length() < 10 && Integer.parseInt(key) < s.length()) {
                return JsonNodeFactory.instance.textNode(String.valueOf(s.charAt(Integer.parseInt(key))));
            }
            return undefined();
        }
        return undefined(); // numbers and booleans have no own properties used here
    }

    /** {@code v === false} */
    public static boolean isFalse(JsonNode v) {
        return v != null && v.isBoolean() && !v.booleanValue();
    }

    /** {@code v === true} */
    public static boolean isTrue(JsonNode v) {
        return v != null && v.isBoolean() && v.booleanValue();
    }

    /** {@code v === s} for a string s */
    public static boolean equalsString(JsonNode v, String s) {
        return v != null && v.isTextual() && v.textValue().equals(s);
    }

    /** {@code v?.includes(s)}: null when v is nullish (undefined result), otherwise like {@link #includes}. */
    public static Boolean optionalIncludes(JsonNode v, String s) {
        return isNullish(v) ? null : includes(v, s);
    }

    /**
     * {@code v.includes(s)}: Array.prototype.includes (strict element equality) or String.prototype.includes
     * (substring); any other value throws like JavaScript.
     */
    public static boolean includes(JsonNode v, String s) {
        if (isNullish(v)) {
            throw new JsTypeError("Cannot read properties of " + (v == null || v.isMissingNode() ? "undefined" : "null")
                    + " (reading 'includes')");
        }
        if (v.isArray()) {
            return arrayIncludes(v, s);
        }
        if (v.isTextual()) {
            return v.textValue().contains(s);
        }
        throw new JsTypeError("includes is not a function");
    }

    /** {@code array.includes(s)} for a known array */
    public static boolean arrayIncludes(JsonNode array, String s) {
        for (JsonNode e : array) {
            if (e.isTextual() && e.textValue().equals(s)) {
                return true;
            }
        }
        return false;
    }

    /** JavaScript truthiness. */
    public static boolean truthy(JsonNode v) {
        if (isNullish(v)) {
            return false;
        }
        if (v.isBoolean()) {
            return v.booleanValue();
        }
        if (v.isNumber()) {
            double d = v.asDouble();
            return d != 0 && !Double.isNaN(d);
        }
        if (v.isTextual()) {
            return !v.textValue().isEmpty();
        }
        return true; // objects and arrays
    }

    /** {@code x || []} */
    public static JsonNode orEmptyArray(JsonNode v) {
        return truthy(v) ? v : JsonNodeFactory.instance.arrayNode();
    }

    /** ToNumber(v), used where the original compares or multiplies a value of unknown type. */
    public static double toNumber(JsonNode v) {
        if (v == null || v.isMissingNode()) {
            return Double.NaN;
        }
        if (v.isNull()) {
            return 0;
        }
        if (v.isBoolean()) {
            return v.booleanValue() ? 1 : 0;
        }
        if (v.isNumber()) {
            return v.asDouble();
        }
        if (v.isTextual()) {
            return stringToNumber(v.textValue());
        }
        if (v.isArray()) {
            return stringToNumber(arrayToString((ArrayNode) v));
        }
        return Double.NaN; // "[object Object]"
    }

    static double stringToNumber(String raw) {
        String s = JsText.trim(raw);
        if (s.isEmpty()) {
            return 0;
        }
        switch (s) {
            case "Infinity", "+Infinity":
                return Double.POSITIVE_INFINITY;
            case "-Infinity":
                return Double.NEGATIVE_INFINITY;
            default:
                break;
        }
        try {
            if (s.length() > 2 && s.charAt(0) == '0') {
                char p = Character.toLowerCase(s.charAt(1));
                int radix = p == 'x' ? 16 : p == 'o' ? 8 : p == 'b' ? 2 : 0;
                if (radix != 0) {
                    return new java.math.BigInteger(s.substring(2), radix).doubleValue();
                }
            }
            return DECIMAL.matcher(s).matches() ? Double.parseDouble(s) : Double.NaN;
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }

    /** Array.prototype.toString (join with ','; null/undefined become empty). */
    static String arrayToString(ArrayNode a) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < a.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            JsonNode e = a.get(i);
            if (isNullish(e)) {
                continue;
            }
            if (e.isArray()) {
                sb.append(arrayToString((ArrayNode) e));
            } else if (e.isObject()) {
                sb.append("[object Object]");
            } else if (e.isTextual()) {
                sb.append(e.textValue());
            } else if (e.isNumber()) {
                double d = e.asDouble();
                sb.append(d == Math.rint(d) && Math.abs(d) < 1e21 ? String.valueOf((long) d) : String.valueOf(d));
            } else {
                sb.append(e.asText());
            }
        }
        return sb.toString();
    }
}
