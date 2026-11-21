'use client';

// Field checks for the website's forms (the checks themselves are lib/validate.ts, shared with the apps). A field's
// message shows once the person leaves it, or for every field once they press submit with something wrong, so nobody is
// told off while still typing. Use with <FieldError> under each field and the `invalid` class on its box.
import { useState } from 'react';

export function useFormChecks<K extends string>(errors: Record<K, string | null>) {
    const [left, setLeft] = useState<Set<K>>(new Set());
    const [tried, setTried] = useState(false);
    return {
        /** The message to show under this field now (null: nothing to show). */
        show: (key: K): string | null => (tried || left.has(key) ? errors[key] : null),
        /** onBlur for this field. */
        leave: (key: K) => () => setLeft(now => (now.has(key) ? now : new Set(now).add(key))),
        /** Call on submit: true when every field is fine, otherwise every message shows. */
        ok: () => {
            setTried(true);
            return !Object.values<string | null>(errors).some(Boolean);
        },
        reset: () => { setTried(false); setLeft(new Set()); },
    };
}

/** The red edge for a field box with a message showing. */
export const invalidBox = 'border-red-500 ring-2 ring-red-500/20 focus:ring-red-500/40';
