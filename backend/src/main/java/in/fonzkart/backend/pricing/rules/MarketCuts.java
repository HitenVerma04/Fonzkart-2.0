package in.fonzkart.backend.pricing.rules;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * What the used-phone market takes off for each answer, in percent of a flawless phone's price: the average of Cashify
 * and Cashkr, measured in November 2026 by changing one answer at a time from a flawless phone (Cashify: 4 Android
 * phones signed in plus its iPhones; Cashkr: 7 phones). The figures and how each was measured are in the
 * Fonzkart-Phone-Resale-Prices spreadsheet, sheet "Average cut (both platforms)".
 * <p>
 * {@link in.fonzkart.backend.pricing.service.PriceSheetService} uses them for smartphones so offers land near the
 * market: a cosmetic answer takes this share (an admin's rule still replaces it); a repair answer costs this share of
 * the max value, or the part's repair estimate when that is more (a foldable's display costs more than the market's
 * usual cut, and Fonzkart must not pay above what it costs to repair).
 * <p>
 * Where our answer has no exact counterpart on the platforms, the nearest one is used and noted. Answers not listed
 * (camera glass, bought abroad) keep the built-in figures. A few cuts are Fonzkart's own choice rather than the
 * market's (the screen, a non-original screen, an Android fingerprint sensor); each says so.
 */
public final class MarketCuts {

    private static final Map<String, Map<String, Double>> BY_CATEGORY = Map.of("smartphone", smartphone());

    private MarketCuts() {
    }

    /**
     * Fonzkart's own cut for a faulty fingerprint sensor on an Android phone (set 2026-11-28): most Androids read the
     * finger through the display, so a dead sensor usually means a display repair. iPhones keep the market's figure.
     */
    static final double ANDROID_FINGERPRINT = 50;

    /** The market's cut for this answer in percent, or null when there is none. */
    public static Double percent(String category, String question, String answer) {
        Map<String, Double> cuts = BY_CATEGORY.get(category);
        return cuts == null ? null : cuts.get(question + "=" + answer);
    }

    /** As {@link #percent(String, String, String)}, with the cuts that differ between iPhones and Android phones. */
    public static Double percent(String category, String brandId, String question, String answer) {
        boolean apple = brandId != null && brandId.trim().equalsIgnoreCase("apple");
        if ("smartphone".equals(category) && !apple && "functional_issues".equals(question) && "finger_sensor".equals(answer)) {
            return ANDROID_FINGERPRINT;
        }
        return percent(category, question, answer);
    }

    private static Map<String, Double> smartphone() {
        Map<String, Double> m = new LinkedHashMap<>();
        // Screen: Fonzkart's own figures (set 2026-11-28), above the market's (good 9.8%, average 14.0%, below average
        // 37.1%).
        m.put("physical_condition=good", 15.0);
        m.put("physical_condition=average", 30.0);
        m.put("physical_condition=below_average", 50.0);
        // A replaced, non-original screen (Fonzkart's own figure, 2026-11-28). It is a display repair, so with a cracked
        // screen too it is taken once.
        m.put("functional_issues=screen_replaced", 50.0);
        // Body. "Below average" (heavy dents, cracks or bent): the average of major dents (19.3%), cracked back or side
        // panel (23.4%) and bent (25.4%).
        m.put("body_condition=good", 5.4);
        m.put("body_condition=average", 12.6);
        m.put("body_condition=below_average", 22.7);
        // Functional problems.
        m.put("functional_issues=wifi", 23.4);
        m.put("functional_issues=bluetooth", 23.8);
        // A SIM slot: Cashkr's "network problem" (31.4%). Cashify's "cannot make calls at all" (97.8%) treats the phone
        // as dead, which one faulty slot is not. The second slot takes half, as before.
        m.put("functional_issues=sim1", 31.4);
        m.put("functional_issues=sim2", 15.7);
        m.put("functional_issues=front_camera", 12.0);
        m.put("functional_issues=back_camera", 15.4);
        m.put("functional_issues=front_camera_blur", 8.4);  // 0.7 × front camera, as the repair severity
        m.put("functional_issues=back_camera_blur", 10.8);  // 0.7 × back camera
        m.put("functional_issues=finger_sensor", 23.5);     // iPhones; Android phones take ANDROID_FINGERPRINT
        m.put("functional_issues=face_sensor", 21.4);
        m.put("functional_issues=proximity", 8.5);
        m.put("functional_issues=power_button", 7.1);
        m.put("functional_issues=volume_button", 7.1);
        m.put("functional_issues=silent_button", 5.7);      // 0.8 × buttons
        m.put("functional_issues=speaker", 7.9);
        m.put("functional_issues=earpiece", 7.9);           // no separate answer on the platforms: as the speaker
        m.put("functional_issues=microphone", 9.4);
        m.put("functional_issues=audio_ic", 16.6);          // microphone and speaker together: 1 − (1 − 9.4%)(1 − 7.9%)
        m.put("functional_issues=vibrator", 7.9);
        m.put("functional_issues=charging_port", 9.1);
        m.put("functional_issues=battery", 14.5);
        m.put("functional_issues=battery_health_low", 14.5);
        // Accessories.
        m.put("accessories=!box", 3.9);
        m.put("accessories=!charger", 1.2);
        m.put("accessories=!bill", 4.8);
        // Age (0–3 months takes nothing; unanswered counts as out of warranty).
        m.put("warranty=3_6_months", 7.1);
        m.put("warranty=6_11_months", 9.1);
        m.put("warranty=no", 16.4);
        return Collections.unmodifiableMap(m);
    }
}
