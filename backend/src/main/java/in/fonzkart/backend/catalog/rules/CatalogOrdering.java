package in.fonzkart.backend.catalog.rules;

import com.ibm.icu.text.Collator;
import com.ibm.icu.util.ULocale;
import java.util.Comparator;
import java.util.function.Function;

/**
 * The sort used throughout lib/store.ts:
 * {@code (a.priority ?? 100) - (b.priority ?? 100) || a.name.localeCompare(b.name)}.
 * Node.js implements localeCompare with ICU (default locale en-US), so ICU4J is used here
 * with the same locale and default (tertiary) strength.
 */
public final class CatalogOrdering {

    private static final Collator COLLATOR = Collator.getInstance(ULocale.forLanguageTag("en-US")).freeze();

    private CatalogOrdering() {
    }

    /** JavaScript {@code a.localeCompare(b)}. */
    public static int localeCompare(String a, String b) {
        return COLLATOR.compare(a, b);
    }

    public static <T> Comparator<T> byPriorityThenName(Function<T, Integer> priority, Function<T, String> name) {
        return (a, b) -> {
            int pDiff = CatalogModelRules.priorityOrDefault(priority.apply(a))
                    - CatalogModelRules.priorityOrDefault(priority.apply(b));
            if (pDiff != 0) {
                return pDiff;
            }
            return localeCompare(name.apply(a), name.apply(b));
        };
    }
}
