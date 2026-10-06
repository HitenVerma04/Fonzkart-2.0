package in.fonzkart.backend.shared.text;

import java.util.Locale;

/**
 * String helpers that reproduce JavaScript semantics used by the original Next.js code,
 * so ported business logic behaves identically.
 */
public final class JsText {

    private JsText() {
    }

    /** JavaScript truthiness for an optional string: null and "" are falsy. */
    public static boolean truthy(String value) {
        return value != null && !value.isEmpty();
    }

    /** Equivalent of {@code String.prototype.toLowerCase()} (locale-independent). */
    public static String lower(String value) {
        return value.toLowerCase(Locale.ROOT);
    }

    /** Equivalent of {@code String.prototype.trim()} (ECMAScript WhiteSpace + LineTerminator). */
    public static String trim(String value) {
        int start = 0;
        int end = value.length();
        while (start < end && isJsWhitespace(value.charAt(start))) {
            start++;
        }
        while (end > start && isJsWhitespace(value.charAt(end - 1))) {
            end--;
        }
        return value.substring(start, end);
    }

    /**
     * Equivalent of {@code parseInt(String(value))}: leading whitespace, optional sign, decimal digits; anything
     * after the digits is ignored. Returns null where JavaScript returns NaN.
     */
    public static Integer parseInt(Object value) {
        if (value == null) {
            return null;
        }
        String s = trim(String.valueOf(value));
        int i = 0;
        boolean negative = false;
        if (i < s.length() && (s.charAt(i) == '+' || s.charAt(i) == '-')) {
            negative = s.charAt(i) == '-';
            i++;
        }
        int start = i;
        while (i < s.length() && s.charAt(i) >= '0' && s.charAt(i) <= '9') {
            i++;
        }
        if (i == start) {
            return null;
        }
        try {
            int n = Integer.parseInt(s.substring(start, i));
            return negative ? -n : n;
        } catch (NumberFormatException e) {
            return null; // out of the 32-bit column range; the original fails at the database
        }
    }

    /** Equivalent of {@code encodeURIComponent()}: UTF-8, leaving A-Z a-z 0-9 - _ . ! ~ * ' ( ) unescaped. */
    public static String encodeURIComponent(String value) {
        StringBuilder sb = new StringBuilder();
        for (byte b : value.getBytes(java.nio.charset.StandardCharsets.UTF_8)) {
            int c = b & 0xFF;
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
                    || "-_.!~*'()".indexOf(c) >= 0) {
                sb.append((char) c);
            } else {
                sb.append('%').append(Character.toUpperCase(Character.forDigit(c >> 4, 16)))
                        .append(Character.toUpperCase(Character.forDigit(c & 0xF, 16)));
            }
        }
        return sb.toString();
    }

    static boolean isJsWhitespace(char c) {
        switch (c) {
            case '\t', '\n', '\u000B', '\f', '\r', ' ', ' ', ' ', ' ', ' ',
                 ' ', ' ', '　', '﻿':
                return true;
            default:
                return c >= ' ' && c <= ' ';
        }
    }
}
