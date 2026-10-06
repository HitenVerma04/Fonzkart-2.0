// Everything a server page passes to a 'use client' component is serialised into the page payload that the
// browser downloads, even fields the component never shows. User and rider records must therefore be stripped of
// secret columns first: the password hash, the password-reset/OTP code and its expiry, and the rider password.

const SECRET_KEYS = new Set(['passwordHash', 'resetToken', 'resetTokenExpiry', 'password']);

/** A copy of plain objects/arrays (recursively) without secret keys. Dates and other values are kept as is. */
export function withoutSecrets<T>(value: T): T {
    if (Array.isArray(value)) return value.map(v => withoutSecrets(v)) as T;
    if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        const out: Record<string, unknown> = {};
        for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
            if (!SECRET_KEYS.has(key)) out[key] = withoutSecrets(v);
        }
        return out as T;
    }
    return value;
}
