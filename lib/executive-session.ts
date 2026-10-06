import { createHmac } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

// Signed identity for the field-executive phone login. The "executive_id" cookie used to hold the raw rider id,
// so anyone could impersonate a rider by setting it. It now holds an HS256 token { typ: 'executive', sub: riderId }
// that expires after 7 days. The signing key is derived from AUTH_SECRET with a fixed label, so a user session
// token can never be accepted as an executive token or the other way round. The Spring Boot backend
// (ExecutiveTokenCodec) uses the same format and key, so either backend accepts the other's cookie.

export const EXECUTIVE_COOKIE = 'executive_id';
export const EXECUTIVE_TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

const KEY_LABEL = 'fonzkart:executive-session:v1';

function signingKey(): Uint8Array {
    // Same secret (and development fallback) as lib/session.ts.
    const secret = process.env.AUTH_SECRET || 'temporary_dev_key_change_me_in_production';
    return new Uint8Array(createHmac('sha256', secret).update(KEY_LABEL).digest());
}

export async function signExecutiveToken(riderId: string, issuedAtSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
    return new SignJWT({ typ: 'executive' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(riderId)
        .setIssuedAt(issuedAtSeconds)
        .setExpirationTime(issuedAtSeconds + EXECUTIVE_TOKEN_LIFETIME_SECONDS)
        .sign(signingKey());
}

/** The rider id from a valid, unexpired executive token; null for anything else (including legacy raw ids). */
export async function verifyExecutiveToken(token: string | null | undefined): Promise<string | null> {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, signingKey(), { algorithms: ['HS256'] });
        if (payload.typ !== 'executive' || typeof payload.exp !== 'number') return null;
        return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
    } catch {
        return null;
    }
}

/** Browser-session cookie, as before, now also SameSite=Lax. */
export const executiveCookieOptions = { httpOnly: true, sameSite: 'lax' as const, path: '/' };
