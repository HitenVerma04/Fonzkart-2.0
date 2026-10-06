package in.fonzkart.backend.support;

import in.fonzkart.backend.shared.mail.MailTransport;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/** Test transport that records messages instead of sending them over SMTP. */
public class RecordingMailTransport implements MailTransport {

    public record Sent(SmtpTarget target, Message message) {
    }

    private final List<Sent> sent = new CopyOnWriteArrayList<>();

    @Override
    public void send(SmtpTarget target, Message message) {
        sent.add(new Sent(target, message));
    }

    public List<Sent> sent() {
        return new ArrayList<>(sent);
    }

    public void clear() {
        sent.clear();
    }

    /** Waits briefly for fire-and-forget emails (sent on the mail executor). */
    public List<Sent> awaitCount(int atLeast, long timeoutMillis) throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeoutMillis;
        while (sent.size() < atLeast && System.currentTimeMillis() < deadline) {
            Thread.sleep(50);
        }
        return sent();
    }
}
