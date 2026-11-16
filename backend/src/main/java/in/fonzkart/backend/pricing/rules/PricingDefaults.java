package in.fonzkart.backend.pricing.rules;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The built-in deductions of every sell category (the questions of lib/data.ts → questionnaireSteps): for each
 * question, the share of the max value each answer takes, in percent, and the most that one question can take in all
 * (several functional problems together, say). An admin's pricing rule for an answer replaces its built-in share.
 * <p>
 * Answer keys are the ones the pricing rules use: an option id ({@code "good"}), {@code "!item"} for an accessory the
 * customer does not have, and {@code "true"} / {@code "false"} for a yes/no question. An answer that is not listed
 * takes nothing (flawless, purchased in India, ...).
 * <p>
 * The "warranty" question is the device's age (0-3 months old takes nothing; over 11 months or out of warranty takes
 * the most), as on Cashify.
 */
public final class PricingDefaults {

    /** One question: the share each answer takes (percent of the max value) and the most it takes in all (percent). */
    public record Question(double capPercent, Map<String, Double> answers) {
    }

    /** A question with one answer (or a yes/no question) takes at most what its worst answer takes. */
    static final double SINGLE = 90;

    private static final Map<String, Map<String, Question>> BY_CATEGORY = build();

    private PricingDefaults() {
    }

    /** The built-in questions of a category (empty when it has none), in questionnaire order. */
    public static Map<String, Question> forCategory(String category) {
        return BY_CATEGORY.getOrDefault(category, Map.of());
    }

    private static Map<String, Map<String, Question>> build() {
        Map<String, Map<String, Question>> all = new LinkedHashMap<>();

        all.put("smartphone", new Builder()
                .question("physical_condition", SINGLE, "good", 4, "average", 12, "below_average", 30)
                .question("body_condition", SINGLE, "good", 3, "average", 8, "below_average", 18)
                .question("functional_issues", 50,
                        "wifi", 8, "sim1", 5, "sim2", 2, "bluetooth", 4, "front_camera", 8, "back_camera", 15,
                        "camera_glass", 5, "finger_sensor", 5, "face_sensor", 15, "power_button", 4, "volume_button", 3,
                        "silent_button", 2, "speaker", 5, "earpiece", 5, "microphone", 6, "audio_ic", 10,
                        "charging_port", 6, "proximity", 4, "vibrator", 2, "battery", 8,
                        // iPhones ask for the battery health instead of "Battery"; above 85% is healthy.
                        "battery_health_low", 8, "battery_health_high", 0,
                        "front_camera_blur", 5, "back_camera_blur", 8)
                .question("purchase_location", SINGLE, "global", 10)
                .question("accessories", 10, "!charger", 1, "!box", 2, "!bill", 4)
                .warranty()
                .build());

        all.put("tablet", new Builder()
                .question("power", SINGLE, "false", 60)
                .question("touch", SINGLE, "false", 25)
                .question("wifi", SINGLE, "false", 10)
                .question("physical_condition", SINGLE, "good", 4, "average", 12, "below_average", 30)
                .question("body_condition", SINGLE, "good", 3, "average", 8, "below_average", 18)
                .question("functional_issues", 40,
                        "bluetooth", 4, "front_camera", 6, "back_camera", 8, "camera_glass", 4, "power_button", 4,
                        "volume_button", 3, "speaker", 5, "microphone", 5, "charging_port", 6, "battery", 8)
                .question("purchase_location", SINGLE, "global", 10)
                .question("accessories", 10, "!charger", 2, "!box", 2, "!bill", 4)
                .warranty()
                .build());

        all.put("watch", new Builder()
                .question("power", SINGLE, "false", 60)
                .question("touch", SINGLE, "false", 25)
                .question("charging", SINGLE, "false", 15)
                .question("physical_condition", SINGLE, "good", 4, "average", 12, "damaged", 30)
                .question("body_condition", SINGLE, "good", 3, "average", 8, "below_average", 18)
                .question("functional_issues", 40,
                        "battery_low", 8, "wifi", 5, "speaker", 4, "crown", 5, "buttons", 4, "heart_sensor", 8,
                        "bluetooth", 5)
                .question("purchase_location", SINGLE, "global", 10)
                .question("accessories", 12, "!charger", 4, "!strap", 3, "!box", 2, "!bill", 4)
                .warranty()
                .build());

        all.put("console", new Builder()
                .question("power", SINGLE, "false", 60)
                .question("drive", SINGLE, "false", 20)
                .question("controller", SINGLE, "false", 15)
                .question("cosmetic", 30, "body_cracks", 15, "ports_damaged", 10)
                .build());

        Map<String, Question> tv = new Builder()
                .question("physical_condition", SINGLE, "good", 4, "average", 12, "damaged", 40)
                .question("body_condition", SINGLE, "good", 3, "average", 8, "below_average", 15)
                .question("functional_issues", 50,
                        "wifi", 5, "bluetooth", 3, "ports", 6, "sound", 10, "remote_sensor", 4, "power_fault", 25,
                        "display_flicker", 20)
                .question("purchase_location", SINGLE, "global", 10)
                .question("accessories", 12, "!remote", 4, "!stand", 3, "!wall_mount", 1, "!bill", 4, "!box", 2)
                .warranty()
                .build();
        all.put("smarttv", tv);
        all.put("tv", tv);

        all.put("laptop", new Builder()
                .question("power", SINGLE, "false", 60)
                .question("ports", SINGLE, "false", 10)
                .question("screen_working", SINGLE, "false", 30)
                .question("keyboard", SINGLE, "false", 15)
                .question("physical_condition", 50, "screen_damage", 25, "body_damage", 12, "battery_dead", 12, "keys_missing", 8)
                .question("specs", 8, "charger_missing", 5, "box_missing", 1)
                .build());

        all.put("camera", new Builder()
                .question("power", SINGLE, "false", 60)
                .question("lens_focus", SINGLE, "false", 25)
                .question("sensor_spots", SINGLE, "true", 20)
                .question("flash", SINGLE, "false", 5)
                .question("physical_condition", SINGLE, "good", 4, "average", 12, "below_average", 25)
                .question("screen_condition", SINGLE, "cracked", 15, "dead_pixels", 8)
                .question("functional_issues", 40,
                        "buttons", 5, "card_slot", 8, "hdmi_usb", 4, "battery_door", 3, "mode_dial", 5, "mic_jack", 2)
                .question("purchase_location", SINGLE, "global", 10)
                .question("accessories", 15, "!battery", 6, "!charger", 3, "!lens_cap", 1, "!strap", 1, "!box", 2, "!bill", 4)
                .warranty()
                .build());

        all.put("desktop", new Builder()
                .question("power", SINGLE, "false", 50)
                .question("display_output", SINGLE, "false", 20)
                .question("ports", SINGLE, "false", 8)
                .question("physical_condition", SINGLE, "good", 3, "average", 8, "below_average", 18)
                .question("accessories", 10, "!power_cable", 3, "!keyboard_mouse", 3, "!bill", 4)
                .build());

        all.put("earbuds", new Builder()
                // Earbuds are not repaired: dead ones are worth their case and parts, a case that will not charge
                // needs a new case.
                .question("power", SINGLE, "false", 70)
                .question("charging", SINGLE, "false", 35)
                .question("anc", SINGLE, "false", 10)
                .question("physical_condition", SINGLE, "good", 4, "average", 10, "damaged", 25)
                .question("accessories", 12, "!box", 3, "!bill", 4, "!charging_cable", 2)
                .build());

        return Collections.unmodifiableMap(all);
    }

    private static final class Builder {
        private final Map<String, Question> questions = new LinkedHashMap<>();

        /** {@code answerPercents}: answer key, percent, answer key, percent, ... */
        Builder question(String key, double capPercent, Object... answerPercents) {
            Map<String, Double> answers = new LinkedHashMap<>();
            for (int i = 0; i < answerPercents.length; i += 2) {
                answers.put((String) answerPercents[i], ((Number) answerPercents[i + 1]).doubleValue());
            }
            questions.put(key, new Question(capPercent, Collections.unmodifiableMap(answers)));
            return this;
        }

        /** The device's age: the newer, the closer to the max value. */
        Builder warranty() {
            return question("warranty", SINGLE, "3_6_months", 3, "6_11_months", 5, "no", 8);
        }

        Map<String, Question> build() {
            return Collections.unmodifiableMap(questions);
        }
    }
}
