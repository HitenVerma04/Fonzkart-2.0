package in.fonzkart.backend.shared.id;

import java.lang.management.ManagementFactory;
import java.security.SecureRandom;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Generates ids in the same format as Prisma's {@code @default(cuid())} (cuid v1): 25 characters,
 * starting with 'c', lowercase base-36 — timestamp (8) + counter (4) + fingerprint (4) + random (8).
 * Used where the original code lets Prisma generate the id.
 */
public final class Cuid {

    private static final int BASE = 36;
    private static final int BLOCK = 4;
    private static final int DISCRETE = (int) Math.pow(BASE, BLOCK);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final AtomicInteger COUNTER = new AtomicInteger(RANDOM.nextInt(DISCRETE));
    private static final String FINGERPRINT = fingerprint();

    private Cuid() {
    }

    public static String next() {
        return "c"
                + pad(Long.toString(System.currentTimeMillis(), BASE), 8)
                + pad(Integer.toString(Math.floorMod(COUNTER.getAndIncrement(), DISCRETE), BASE), BLOCK)
                + FINGERPRINT
                + pad(Integer.toString(RANDOM.nextInt(DISCRETE), BASE), BLOCK)
                + pad(Integer.toString(RANDOM.nextInt(DISCRETE), BASE), BLOCK);
    }

    private static String fingerprint() {
        String name = ManagementFactory.getRuntimeMXBean().getName();
        int pid = Math.floorMod(name.hashCode(), DISCRETE);
        int host = Math.floorMod(name.length() + BASE + RANDOM.nextInt(DISCRETE), DISCRETE);
        return pad(Integer.toString(pid, BASE), 2) + pad(Integer.toString(host, BASE), 2);
    }

    private static String pad(String value, int size) {
        String padded = "000000000" + value;
        return padded.substring(padded.length() - size);
    }
}
