import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';

// Passwords for the field-executive phone login (actions/executive.ts), stored in "Rider"."password".
// They used to be stored in plain text. New and changed passwords are stored as bcrypt hashes in the same format
// and cost as user passwords. Existing plain-text values still verify, so no executive is locked out; the caller
// replaces them with a hash after a successful login (scripts/hash-rider-passwords.ts converts the rest).

const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function isRiderPasswordHash(stored: string | null | undefined): boolean {
    return typeof stored === 'string' && BCRYPT_HASH.test(stored);
}

export async function hashRiderPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

/** ok: the password is correct. needsRehash: it matched a legacy plain-text value that should now be hashed. */
export async function verifyRiderPassword(
    stored: string | null | undefined,
    supplied: string | null | undefined,
): Promise<{ ok: boolean; needsRehash: boolean }> {
    if (!stored || typeof supplied !== 'string' || !supplied) return { ok: false, needsRehash: false };
    if (isRiderPasswordHash(stored)) {
        return { ok: await bcrypt.compare(supplied, stored), needsRehash: false };
    }
    const expected = Buffer.from(stored, 'utf8');
    const actual = Buffer.from(supplied, 'utf8');
    const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
    return { ok, needsRehash: ok };
}
