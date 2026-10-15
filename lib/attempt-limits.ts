// Limits guessing, as the backend does (backend/.../auth/rules/AttemptLimiter.java):
// - sign-in: after 10 wrong passwords for one account (email or phone) within 15 minutes, that account's sign-in is
//   refused until 15 minutes after the first of them;
// - one-time codes: after 5 wrong codes for one email, the code is cancelled and a new one must be requested (the
//   caller clears it), so a 6-digit code cannot be guessed.
// Kept in memory: a restart forgets the counts, which only gives back a few attempts. The map is bounded so that
// made-up account names cannot fill the memory.

export const MAX_SIGNIN_FAILURES = 10;
export const MAX_CODE_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const TOO_MANY_SIGNINS = 'Too many sign-in attempts. Please try again in 15 minutes.';
export const TOO_MANY_CODES = 'Too many wrong codes. Please request a new one.';

export type AttemptKind = 'SIGNIN' | 'EXECUTIVE_SIGNIN' | 'CODE';

const MAX_ENTRIES = 50_000;
const windows = new Map<string, { failures: number; start: number }>();

const key = (kind: AttemptKind, account: string | null | undefined) => `${kind}:${(account ?? '').trim().toLowerCase()}`;
const expired = (w: { start: number }, now: number) => now >= w.start + WINDOW_MS;

/** True while sign-in for this account is refused. */
export function blocked(kind: AttemptKind, account: string | null | undefined): boolean {
    const k = key(kind, account);
    const w = windows.get(k);
    if (w && expired(w, Date.now())) {
        windows.delete(k);
        return false;
    }
    return !!w && w.failures >= MAX_SIGNIN_FAILURES;
}

/** Records a wrong password or code; returns true when this one reached the limit. */
export function failed(kind: AttemptKind, account: string | null | undefined): boolean {
    const now = Date.now();
    if (windows.size >= MAX_ENTRIES) {
        for (const [k, w] of windows) if (expired(w, now)) windows.delete(k);
        if (windows.size >= MAX_ENTRIES) windows.clear();
    }
    const k = key(kind, account);
    const old = windows.get(k);
    const w = !old || expired(old, now) ? { failures: 1, start: now } : { failures: old.failures + 1, start: old.start };
    windows.set(k, w);
    return w.failures >= (kind === 'CODE' ? MAX_CODE_FAILURES : MAX_SIGNIN_FAILURES);
}

/** A successful sign-in, a used code or a newly issued code starts the count again. */
export function reset(kind: AttemptKind, account: string | null | undefined) {
    windows.delete(key(kind, account));
}
