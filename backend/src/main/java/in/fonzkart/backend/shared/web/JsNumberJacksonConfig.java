package in.fonzkart.backend.shared.web;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import java.io.IOException;
import java.math.BigDecimal;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Serialises floating-point numbers the way JavaScript's JSON.stringify does, so responses are identical to the
 * Next.js app's: integral values without a fraction (77, not 77.0), plain notation from 1e-6 up to 1e21, and
 * JavaScript-style exponents outside it (1e+21, 1e-7). Values that are not finite become null, as in JavaScript.
 */
@Configuration
public class JsNumberJacksonConfig {

    @Bean
    public Module javascriptNumberModule() {
        SimpleModule module = new SimpleModule("javascript-numbers");
        JsonSerializer<Double> serializer = new JsonSerializer<>() {
            @Override
            public void serialize(Double value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
                if (value == null || value.isNaN() || value.isInfinite()) {
                    gen.writeNull();
                } else {
                    gen.writeNumber(toJavaScriptString(value));
                }
            }
        };
        module.addSerializer(Double.class, serializer);
        module.addSerializer(double.class, serializer);
        return module;
    }

    /** Number.prototype.toString() for finite doubles. */
    static String toJavaScriptString(double v) {
        if (v == 0) {
            return "0";
        }
        double abs = Math.abs(v);
        if (abs >= 1e-6 && abs < 1e21) {
            return new BigDecimal(Double.toString(v)).stripTrailingZeros().toPlainString();
        }
        // Shortest round-trip digits (as Java's Double.toString), formatted with a JavaScript exponent.
        BigDecimal d = new BigDecimal(Double.toString(v)).stripTrailingZeros();
        String digits = d.unscaledValue().abs().toString();
        int exponent = digits.length() - 1 - d.scale();
        String mantissa = digits.length() == 1 ? digits : digits.charAt(0) + "." + digits.substring(1);
        return (v < 0 ? "-" : "") + mantissa + "e" + (exponent >= 0 ? "+" : "") + exponent;
    }
}
