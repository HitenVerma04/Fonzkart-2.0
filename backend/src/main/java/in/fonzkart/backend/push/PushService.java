package in.fonzkart.backend.push;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.fonzkart.backend.shared.text.JsText;
import in.fonzkart.backend.shared.time.JsDates;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Push notifications to the phone apps through Expo's push service (https://docs.expo.dev/push-notifications/sending-notifications/),
 * which passes them on to Firebase (Android) and Apple (iPhone). The apps register their Expo push token with
 * {@link #register}; every inbox notification a person gets ({@code OrderNotifications}) is also pushed to their phones.
 * <p>
 * Sending happens on a background thread, so it never slows down or fails the change that caused it. Tokens Expo
 * reports as no longer registered (the app was removed) are deleted.
 */
@Service
public class PushService {

    private static final Logger log = LoggerFactory.getLogger(PushService.class);
    private static final URI EXPO_SEND = URI.create("https://exp.host/--/api/v2/push/send");
    private static final int BATCH = 100; // Expo's limit per request
    private static final Set<String> PLATFORMS = Set.of("ios", "android");
    private static final Set<String> APPS = Set.of("customer", "partner", "admin");

    private final PushTokenRepository tokens;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ExecutorService sender = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "expo-push");
        t.setDaemon(true);
        return t;
    });

    public PushService(PushTokenRepository tokens, ObjectMapper json) {
        this.tokens = tokens;
        this.json = json;
    }

    @PreDestroy
    void stop() {
        sender.shutdown();
    }

    /** An Expo push token: ExponentPushToken[...] or ExpoPushToken[...]. */
    public static boolean isExpoToken(String token) {
        return token != null && token.length() < 200 && token.matches("Expo(nent)?PushToken\\[[A-Za-z0-9_\\-]+]");
    }

    /** Saves this phone's token for the signed-in user or executive (exactly one of the two). False when invalid. */
    public boolean register(String token, String platform, String app, String userId, String riderId) {
        if (!isExpoToken(token) || !PLATFORMS.contains(platform) || !APPS.contains(app)
                || (JsText.truthy(userId) == JsText.truthy(riderId))) {
            return false;
        }
        PushToken row = tokens.findById(token).orElseGet(() -> new PushToken(token, JsDates.nowUtc()));
        row.assign(JsText.truthy(userId) ? userId : null, JsText.truthy(riderId) ? riderId : null, platform, app,
                JsDates.nowUtc());
        tokens.save(row);
        return true;
    }

    /** Forgets this phone (sign-out). */
    public void unregister(String token) {
        if (isExpoToken(token)) {
            tokens.deleteTokens(List.of(token));
        }
    }

    /** Pushes to every phone of these users. */
    public void toUsers(Collection<String> userIds, String title, String body, Map<String, Object> data) {
        List<String> ids = userIds.stream().filter(JsText::truthy).distinct().toList();
        if (ids.isEmpty()) {
            return;
        }
        send(() -> tokens.findByUserIdIn(ids), title, body, data);
    }

    /** Pushes to every phone of this field executive. */
    public void toRider(String riderId, String title, String body, Map<String, Object> data) {
        if (JsText.truthy(riderId)) {
            send(() -> tokens.findByRiderId(riderId), title, body, data);
        }
    }

    private interface Lookup {
        List<PushToken> find();
    }

    private void send(Lookup lookup, String title, String body, Map<String, Object> data) {
        try {
            sender.execute(() -> {
                try {
                    List<String> to = lookup.find().stream().map(PushToken::getToken).toList();
                    for (int i = 0; i < to.size(); i += BATCH) {
                        post(to.subList(i, Math.min(to.size(), i + BATCH)), title, body, data);
                    }
                } catch (RuntimeException e) {
                    log.warn("Push failed: {}", e.getMessage());
                }
            });
        } catch (RuntimeException e) {
            log.warn("Push not queued: {}", e.getMessage());
        }
    }

    private void post(List<String> to, String title, String body, Map<String, Object> data) {
        List<Map<String, Object>> messages = new ArrayList<>();
        for (String token : to) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("to", token);
            m.put("title", title);
            m.put("body", body);
            m.put("sound", "default");
            m.put("priority", "high");
            m.put("channelId", "default");
            if (data != null && !data.isEmpty()) {
                m.put("data", data);
            }
            messages.add(m);
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(EXPO_SEND)
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(messages)))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                log.warn("Expo push returned {}: {}", response.statusCode(), response.body());
                return;
            }
            // One ticket per message, in order; drop the phones that no longer have the app.
            JsonNode tickets = json.readTree(response.body()).path("data");
            List<String> gone = new ArrayList<>();
            for (int i = 0; i < tickets.size() && i < to.size(); i++) {
                JsonNode ticket = tickets.get(i);
                if ("error".equals(ticket.path("status").asText())) {
                    if ("DeviceNotRegistered".equals(ticket.path("details").path("error").asText())) {
                        gone.add(to.get(i));
                    } else {
                        log.warn("Expo push error: {}", ticket.path("message").asText());
                    }
                }
            }
            if (!gone.isEmpty()) {
                tokens.deleteTokens(gone);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("Expo push failed: {}", e.getMessage());
        }
    }
}
