package in.fonzkart.backend.shared.web;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A message people can act on for a database constraint error (PostgreSQL), instead of "constraint failed". The
 * known unique keys get their own sentence; any other unique key names its column; a foreign key says what is still
 * linked or missing; a missing value names its column.
 */
public final class ConstraintMessages {

    private ConstraintMessages() {
    }

    private static final Map<String, String> KNOWN = Map.of(
            "User_email_key", "An account with this email already exists.",
            "User_phone_key", "An account with this phone number already exists.",
            "City_name_key", "A city with this name already exists.",
            "Brand_name_key", "A brand with this name already exists.");

    private static final Pattern CONSTRAINT = Pattern.compile("constraint \"([^\"]+)\"");
    private static final Pattern KEY = Pattern.compile("Key \\(\"?([A-Za-z_]+)\"?\\)=");
    private static final Pattern COLUMN = Pattern.compile("column \"([^\"]+)\"");

    public static String friendly(Throwable e) {
        String text = deepest(e);
        String state = sqlState(e);
        if ("23505".equals(state) || text.contains("duplicate key value")) {
            String known = KNOWN.get(group(CONSTRAINT, text));
            if (known != null) {
                return known;
            }
            String column = group(KEY, text);
            return column == null ? "This already exists." : "Something with this " + words(column) + " already exists.";
        }
        if ("23503".equals(state) || text.contains("foreign key constraint")) {
            return text.contains("is still referenced")
                    ? "This can't be removed because other records (such as orders) still use it."
                    : "Something this refers to no longer exists. Refresh and try again.";
        }
        if ("23502".equals(state) || text.contains("null value in column")) {
            String column = group(COLUMN, text);
            return column == null ? "A required value is missing." : "Please fill in the " + words(column) + ".";
        }
        if ("23514".equals(state) || text.contains("check constraint")) {
            return "One of the values is not allowed. Check the form and try again.";
        }
        return "This change conflicts with existing data. Refresh and try again.";
    }

    private static String deepest(Throwable e) {
        Throwable t = e;
        while (t.getCause() != null && t.getCause() != t) {
            t = t.getCause();
        }
        return String.valueOf(t.getMessage()) + " " + String.valueOf(e.getMessage());
    }

    private static String sqlState(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof java.sql.SQLException sql && sql.getSQLState() != null) {
                return sql.getSQLState();
            }
        }
        return null;
    }

    private static String group(Pattern p, String text) {
        Matcher m = p.matcher(text);
        return m.find() ? m.group(1) : null;
    }

    /** "cityId" → "city", "phone_number" → "phone number". */
    private static String words(String column) {
        return column.replaceAll("Id$", "").replaceAll("([a-z])([A-Z])", "$1 $2").replace('_', ' ').toLowerCase();
    }
}
