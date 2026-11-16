package in.fonzkart.backend.pricing.engine;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * What a repair-type answer means: which part has to be repaired or replaced, and how much of that part's cost the
 * answer stands for (a blurry camera is usually a lens or a module refit: 70% of a new camera module).
 * <p>
 * Answers that only change how a device looks or sells (scratches, age, missing box, bought abroad, a dead device whose
 * fault is unknown) are not here: they take a share of the max value ({@link in.fonzkart.backend.pricing.rules.PricingDefaults}).
 * <p>
 * Several answers can point at the same part ("SIM 1", "WiFi" and "Bluetooth" are all board repairs; "touch not
 * working" and "screen cracked" are both the display): a part is paid for once, at its most expensive answer.
 * <p>
 * The cost ratios are the <b>prior</b>: the part's price as a share of the model's launch price in India, per brand
 * tier, with rupee bounds. They come from the official India price lists (Apple's repair estimator: an iPhone 18 Pro
 * Max display ₹42,900 = 24% of launch, back glass 9%, battery 8%; iPhone 15 display ₹25,500 = 32%; Samsung's "key
 * spare part cost" page: Galaxy S and A displays 18–25%; budget phones' batteries ₹900–2,000) and are used only when
 * nothing better is known: a price from an official list, Fonzkart's own repair price list or what Fonzkart actually
 * paid to repair a device replaces them ({@link RepairCostEstimator}).
 */
public final class PartCatalog {

    public static final String DISPLAY = "display";
    public static final String BACK_PANEL = "back_panel";
    public static final String BATTERY = "battery";
    public static final String REAR_CAMERA = "rear_camera";
    public static final String FRONT_CAMERA = "front_camera";
    public static final String CAMERA_GLASS = "camera_glass";
    public static final String FACE_ID = "face_id";
    public static final String FINGERPRINT = "fingerprint";
    public static final String SENSORS = "sensors";
    public static final String BUTTONS = "buttons";
    public static final String SPEAKER = "speaker";
    public static final String EARPIECE = "earpiece";
    public static final String MICROPHONE = "microphone";
    public static final String VIBRATOR = "vibrator";
    public static final String CHARGING_PORT = "charging_port";
    public static final String BOARD = "board";
    public static final String KEYBOARD = "keyboard";
    public static final String BACKLIGHT = "backlight";
    public static final String POWER_BOARD = "power_board";

    /** Names shown to admins and customers. */
    public static final Map<String, String> LABELS = labels();

    /** One answer's repair: the part and the share of its cost (0–1). */
    public record PartUse(String part, double severity) {
    }

    /** A part's prior cost: share of the launch price per tier (apple, premium, standard), within [min, max] rupees. */
    public record Ratio(double apple, double premium, double standard, long min, long max) {
        public double share(String tier) {
            return switch (tier) {
                case "apple" -> apple;
                case "premium" -> premium;
                default -> standard;
            };
        }
    }

    /** Repair labour: the first repair job and each further one on the same device (parts come off together). */
    public record Labour(long first, long extra) {
    }

    private static final Map<String, Map<String, PartUse>> USES = uses();
    private static final Map<String, Map<String, Ratio>> RATIOS = ratios();
    /** Foldable phones: the folding display costs far more (iPhone Duo inner display ₹1,49,900 of ₹2,99,900). */
    private static final Ratio FOLDABLE_DISPLAY = new Ratio(0.45, 0.40, 0.38, 6000, 160000);
    private static final Map<String, Labour> LABOUR = Map.of(
            "smartphone", new Labour(300, 150), "tablet", new Labour(400, 200), "watch", new Labour(400, 200),
            "laptop", new Labour(700, 350), "smarttv", new Labour(900, 450), "camera", new Labour(600, 300),
            "desktop", new Labour(600, 300));
    private static final Set<String> FOLD_WORDS = Set.of("fold", "flip", "razr", "duo", "open", "v fold", "magic v");

    private PartCatalog() {
    }

    /** The repair an answer stands for, or null when the answer is not a repair. */
    public static PartUse use(String category, String question, String answer) {
        Map<String, PartUse> byAnswer = USES.get(normalize(category));
        return byAnswer == null ? null : byAnswer.get(question + "=" + answer);
    }

    /** Every repair answer of a category: "question=answer" → part use. */
    public static Map<String, PartUse> uses(String category) {
        return USES.getOrDefault(normalize(category), Map.of());
    }

    /** The prior cost ratio of a part, or null when the category has no prior for it. */
    public static Ratio ratio(String category, String part, boolean foldable) {
        String c = normalize(category);
        if (foldable && DISPLAY.equals(part) && "smartphone".equals(c)) {
            return FOLDABLE_DISPLAY;
        }
        Map<String, Ratio> byPart = RATIOS.get(c);
        return byPart == null ? null : byPart.get(part);
    }

    public static Labour labour(String category) {
        return LABOUR.getOrDefault(normalize(category), new Labour(400, 200));
    }

    /** A folding phone, by its name (Galaxy Z Fold / Flip, Razr, iPhone Duo, OnePlus Open, Honor Magic V, Vivo X Fold). */
    public static boolean foldable(String modelName) {
        String n = modelName == null ? "" : " " + modelName.toLowerCase(Locale.ROOT) + " ";
        for (String w : FOLD_WORDS) {
            if (n.contains(" " + w + " ") || n.contains(" " + w)) {
                return true;
            }
        }
        return false;
    }

    /** The sell category the parts are keyed by (the stored aliases mapped, as the quote maps them). */
    public static String normalize(String category) {
        String c = category == null ? "" : category.trim().toLowerCase(Locale.ROOT);
        return switch (c) {
            case "", "mobile" -> "smartphone";
            case "ipad" -> "tablet";
            case "smartwatch" -> "watch";
            case "tv" -> "smarttv";
            default -> c;
        };
    }

    private static Map<String, Map<String, PartUse>> uses() {
        Map<String, Map<String, PartUse>> all = new LinkedHashMap<>();
        all.put("smartphone", new Uses()
                .add("physical_condition", "below_average", DISPLAY, 1)
                .add("functional_issues", "wifi", BOARD, 0.7)
                .add("functional_issues", "bluetooth", BOARD, 0.6)
                .add("functional_issues", "sim1", BOARD, 0.6)
                .add("functional_issues", "sim2", BOARD, 0.3)
                .add("functional_issues", "audio_ic", BOARD, 0.7)
                .add("functional_issues", "front_camera", FRONT_CAMERA, 1)
                .add("functional_issues", "front_camera_blur", FRONT_CAMERA, 0.7)
                .add("functional_issues", "back_camera", REAR_CAMERA, 1)
                .add("functional_issues", "back_camera_blur", REAR_CAMERA, 0.7)
                .add("functional_issues", "camera_glass", CAMERA_GLASS, 1)
                .add("functional_issues", "finger_sensor", FINGERPRINT, 1)
                .add("functional_issues", "face_sensor", FACE_ID, 1)
                .add("functional_issues", "proximity", SENSORS, 1)
                .add("functional_issues", "power_button", BUTTONS, 1)
                .add("functional_issues", "volume_button", BUTTONS, 1)
                .add("functional_issues", "silent_button", BUTTONS, 0.8)
                .add("functional_issues", "speaker", SPEAKER, 1)
                .add("functional_issues", "earpiece", EARPIECE, 1)
                .add("functional_issues", "microphone", MICROPHONE, 1)
                .add("functional_issues", "vibrator", VIBRATOR, 1)
                .add("functional_issues", "charging_port", CHARGING_PORT, 1)
                .add("functional_issues", "battery", BATTERY, 1)
                .add("functional_issues", "battery_health_low", BATTERY, 1)
                .build());
        all.put("tablet", new Uses()
                .add("touch", "false", DISPLAY, 1)
                .add("wifi", "false", BOARD, 0.7)
                .add("physical_condition", "below_average", DISPLAY, 1)
                .add("functional_issues", "bluetooth", BOARD, 0.6)
                .add("functional_issues", "front_camera", FRONT_CAMERA, 1)
                .add("functional_issues", "back_camera", REAR_CAMERA, 1)
                .add("functional_issues", "camera_glass", CAMERA_GLASS, 1)
                .add("functional_issues", "power_button", BUTTONS, 1)
                .add("functional_issues", "volume_button", BUTTONS, 1)
                .add("functional_issues", "speaker", SPEAKER, 1)
                .add("functional_issues", "microphone", MICROPHONE, 1)
                .add("functional_issues", "charging_port", CHARGING_PORT, 1)
                .add("functional_issues", "battery", BATTERY, 1)
                .build());
        all.put("watch", new Uses()
                .add("touch", "false", DISPLAY, 1)
                .add("charging", "false", CHARGING_PORT, 1)
                .add("physical_condition", "damaged", DISPLAY, 1)
                .add("functional_issues", "wifi", BOARD, 0.6)
                .add("functional_issues", "bluetooth", BOARD, 0.6)
                .add("functional_issues", "heart_sensor", SENSORS, 1)
                .add("functional_issues", "crown", BUTTONS, 1)
                .add("functional_issues", "buttons", BUTTONS, 1)
                .add("functional_issues", "speaker", SPEAKER, 1)
                .add("functional_issues", "battery_low", BATTERY, 1)
                .build());
        all.put("smarttv", new Uses()
                .add("physical_condition", "damaged", DISPLAY, 1)
                .add("functional_issues", "wifi", BOARD, 0.5)
                .add("functional_issues", "bluetooth", BOARD, 0.4)
                .add("functional_issues", "ports", BOARD, 0.4)
                .add("functional_issues", "remote_sensor", SENSORS, 1)
                .add("functional_issues", "sound", SPEAKER, 1)
                .add("functional_issues", "power_fault", POWER_BOARD, 1)
                .add("functional_issues", "display_flicker", BACKLIGHT, 1)
                .build());
        all.put("laptop", new Uses()
                .add("screen_working", "false", DISPLAY, 1)
                .add("keyboard", "false", KEYBOARD, 1)
                .add("ports", "false", BOARD, 0.4)
                .add("physical_condition", "screen_damage", DISPLAY, 1)
                .add("physical_condition", "body_damage", BACK_PANEL, 1)
                .add("physical_condition", "battery_dead", BATTERY, 1)
                .add("physical_condition", "keys_missing", KEYBOARD, 0.6)
                .build());
        all.put("camera", new Uses()
                .add("screen_condition", "cracked", DISPLAY, 1)
                .add("screen_condition", "dead_pixels", DISPLAY, 0.6)
                .add("functional_issues", "buttons", BUTTONS, 1)
                .add("functional_issues", "mode_dial", BUTTONS, 1)
                .add("functional_issues", "card_slot", BOARD, 0.4)
                .add("functional_issues", "hdmi_usb", BOARD, 0.3)
                .add("functional_issues", "mic_jack", BOARD, 0.2)
                .build());
        all.put("desktop", new Uses()
                .add("display_output", "false", BOARD, 0.6)
                .add("ports", "false", BOARD, 0.3)
                .build());
        return Collections.unmodifiableMap(all);
    }

    private static Map<String, Map<String, Ratio>> ratios() {
        Map<String, Map<String, Ratio>> all = new LinkedHashMap<>();
        all.put("smartphone", Map.ofEntries(
                Map.entry(DISPLAY, new Ratio(0.26, 0.22, 0.20, 900, 60000)),
                Map.entry(BACK_PANEL, new Ratio(0.09, 0.05, 0.03, 300, 20000)),
                Map.entry(BATTERY, new Ratio(0.075, 0.04, 0.05, 700, 14000)),
                Map.entry(REAR_CAMERA, new Ratio(0.11, 0.08, 0.06, 500, 25000)),
                Map.entry(FRONT_CAMERA, new Ratio(0.045, 0.035, 0.03, 300, 9000)),
                Map.entry(CAMERA_GLASS, new Ratio(0.008, 0.006, 0.006, 150, 3000)),
                Map.entry(FACE_ID, new Ratio(0.12, 0.04, 0.04, 400, 20000)),
                Map.entry(FINGERPRINT, new Ratio(0.03, 0.03, 0.03, 300, 6000)),
                Map.entry(SENSORS, new Ratio(0.015, 0.015, 0.015, 200, 4000)),
                Map.entry(BUTTONS, new Ratio(0.012, 0.012, 0.012, 200, 3500)),
                Map.entry(SPEAKER, new Ratio(0.015, 0.015, 0.015, 250, 4500)),
                Map.entry(EARPIECE, new Ratio(0.012, 0.012, 0.012, 200, 4000)),
                Map.entry(MICROPHONE, new Ratio(0.012, 0.012, 0.012, 200, 4000)),
                Map.entry(VIBRATOR, new Ratio(0.008, 0.008, 0.008, 150, 2500)),
                Map.entry(CHARGING_PORT, new Ratio(0.03, 0.025, 0.03, 300, 9000)),
                Map.entry(BOARD, new Ratio(0.10, 0.09, 0.08, 800, 25000))));
        all.put("tablet", Map.ofEntries(
                Map.entry(DISPLAY, new Ratio(0.28, 0.24, 0.22, 1200, 70000)),
                Map.entry(BATTERY, new Ratio(0.07, 0.07, 0.07, 900, 15000)),
                Map.entry(REAR_CAMERA, new Ratio(0.06, 0.06, 0.06, 500, 15000)),
                Map.entry(FRONT_CAMERA, new Ratio(0.03, 0.03, 0.03, 300, 8000)),
                Map.entry(CAMERA_GLASS, new Ratio(0.006, 0.006, 0.006, 150, 2500)),
                Map.entry(BUTTONS, new Ratio(0.01, 0.01, 0.01, 200, 3000)),
                Map.entry(SPEAKER, new Ratio(0.015, 0.015, 0.015, 300, 5000)),
                Map.entry(MICROPHONE, new Ratio(0.01, 0.01, 0.01, 200, 3500)),
                Map.entry(CHARGING_PORT, new Ratio(0.03, 0.03, 0.03, 400, 9000)),
                Map.entry(BOARD, new Ratio(0.10, 0.10, 0.10, 1000, 30000))));
        all.put("watch", Map.ofEntries(
                Map.entry(DISPLAY, new Ratio(0.38, 0.32, 0.30, 800, 40000)),
                Map.entry(BATTERY, new Ratio(0.12, 0.12, 0.12, 500, 9000)),
                Map.entry(CHARGING_PORT, new Ratio(0.08, 0.08, 0.08, 400, 6000)),
                Map.entry(BOARD, new Ratio(0.15, 0.15, 0.15, 600, 15000)),
                Map.entry(SENSORS, new Ratio(0.12, 0.12, 0.12, 500, 10000)),
                Map.entry(BUTTONS, new Ratio(0.05, 0.05, 0.05, 300, 4000)),
                Map.entry(SPEAKER, new Ratio(0.04, 0.04, 0.04, 300, 3000))));
        all.put("laptop", Map.ofEntries(
                Map.entry(DISPLAY, new Ratio(0.20, 0.16, 0.15, 2500, 60000)),
                Map.entry(KEYBOARD, new Ratio(0.07, 0.05, 0.05, 1200, 20000)),
                Map.entry(BATTERY, new Ratio(0.08, 0.06, 0.06, 1500, 20000)),
                Map.entry(BACK_PANEL, new Ratio(0.08, 0.06, 0.06, 1000, 25000)),
                Map.entry(BOARD, new Ratio(0.22, 0.18, 0.18, 2500, 60000))));
        all.put("smarttv", Map.ofEntries(
                Map.entry(DISPLAY, new Ratio(0.65, 0.65, 0.65, 3000, 300000)),
                Map.entry(BACKLIGHT, new Ratio(0.12, 0.12, 0.12, 1200, 25000)),
                Map.entry(POWER_BOARD, new Ratio(0.08, 0.08, 0.08, 800, 15000)),
                Map.entry(BOARD, new Ratio(0.12, 0.12, 0.12, 1000, 25000)),
                Map.entry(SENSORS, new Ratio(0.02, 0.02, 0.02, 300, 3000)),
                Map.entry(SPEAKER, new Ratio(0.04, 0.04, 0.04, 500, 8000))));
        all.put("camera", Map.ofEntries(
                Map.entry(DISPLAY, new Ratio(0.07, 0.07, 0.07, 1000, 20000)),
                Map.entry(BUTTONS, new Ratio(0.04, 0.04, 0.04, 400, 8000)),
                Map.entry(BOARD, new Ratio(0.10, 0.10, 0.10, 1000, 40000))));
        all.put("desktop", Map.ofEntries(
                Map.entry(BOARD, new Ratio(0.20, 0.20, 0.20, 2000, 40000))));
        return Collections.unmodifiableMap(all);
    }

    private static Map<String, String> labels() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put(DISPLAY, "Display");
        m.put(BACK_PANEL, "Back panel / body");
        m.put(BATTERY, "Battery");
        m.put(REAR_CAMERA, "Rear camera");
        m.put(FRONT_CAMERA, "Front camera");
        m.put(CAMERA_GLASS, "Camera glass");
        m.put(FACE_ID, "Face ID / face unlock");
        m.put(FINGERPRINT, "Fingerprint sensor");
        m.put(SENSORS, "Sensors");
        m.put(BUTTONS, "Buttons");
        m.put(SPEAKER, "Speaker");
        m.put(EARPIECE, "Earpiece");
        m.put(MICROPHONE, "Microphone");
        m.put(VIBRATOR, "Vibration motor");
        m.put(CHARGING_PORT, "Charging port");
        m.put(BOARD, "Board repair (network, SIM, audio)");
        m.put(KEYBOARD, "Keyboard");
        m.put(BACKLIGHT, "Backlight");
        m.put(POWER_BOARD, "Power board");
        return Collections.unmodifiableMap(m);
    }

    private static final class Uses {
        private final Map<String, PartUse> map = new LinkedHashMap<>();

        Uses add(String question, String answer, String part, double severity) {
            map.put(question + "=" + answer, new PartUse(part, severity));
            return this;
        }

        Map<String, PartUse> build() {
            return Collections.unmodifiableMap(map);
        }
    }
}
