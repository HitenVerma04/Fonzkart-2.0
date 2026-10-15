// Server-side calls from the website to the Spring Boot backend, the one backend the website and the apps share.
// Each part of the website moves over on its own switch: USE_API_<PART>=1 plus BACKEND_URL (in Coolify, the
// backend's address). With the switch off the website keeps using Prisma, so a part never has two writers. No silent
// fallback: if the backend fails, the error shows.
//
//   CATALOG  catalog reads                      ORDERS   orders, executive pickups, staff order actions, notifications
//   CONTENT  catalog editing, banner prices     UPLOADS  image uploads
//   AUTH     sign-in, sign-up, password reset, executive phone login
import { cookies } from 'next/headers';

const TIMEOUT_MS = 10_000;

export type ApiPart = 'CATALOG' | 'ORDERS' | 'CONTENT' | 'UPLOADS' | 'AUTH';

const announced = new Set<ApiPart>();

export function usesApi(part: ApiPart): boolean {
    const on = process.env[`USE_API_${part}`] === '1' && !!process.env.BACKEND_URL;
    if (on && !announced.has(part)) {
        announced.add(part); // once per server process, so the deploy log shows which parts use the backend
        console.info(`[backend] ${part} goes through the Spring Boot backend`);
    }
    return on;
}

/** GET a backend endpoint and return its JSON; null when the backend answers 404 (where Prisma returns null). */
export async function backendGet<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T | null> {
    const url = new URL(path, process.env.BACKEND_URL);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, value);
    }
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Backend ${res.status} for GET ${url.pathname}`);
    return (await res.json()) as T;
}

/** The caller's sign-in cookies, passed on so the backend sees the same person (same JWT, same secret). */
async function cookieHeader(): Promise<string> {
    const jar = await cookies();
    return ['session', 'executive_id']
        .map(name => [name, jar.get(name)?.value] as const)
        .filter(([, value]) => !!value)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
}

export type BackendResponse<T> = { status: number; data: T | null; setCookies: string[] };

/**
 * Calls the backend as the signed-in person. A refusal comes back as an Error with the backend's message
 * ('Unauthorized', 'Forbidden: ...', 'Invalid: ...', 'Order not found'), the same messages the website's own code
 * throws, so callers and route handlers (httpStatusFor) behave as before; a server error as 'Internal error'.
 */
export async function backendRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string,
    options: { body?: unknown; form?: FormData; query?: Record<string, string | undefined>; keepErrors?: boolean } = {}): Promise<BackendResponse<T>> {
    const url = new URL(path, process.env.BACKEND_URL);
    for (const [key, value] of Object.entries(options.query ?? {})) {
        if (value !== undefined) url.searchParams.set(key, value);
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    const cookie = await cookieHeader();
    if (cookie) headers.Cookie = cookie;
    let body: BodyInit | undefined;
    if (options.form) body = options.form;
    else if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
    }
    const res = await fetch(url, { method, headers, body, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    const setCookies = typeof (res.headers as any).getSetCookie === 'function' ? (res.headers as any).getSetCookie() as string[] : [];
    if (!res.ok && !options.keepErrors) {
        const message = data && typeof data === 'object' && typeof data.error === 'string' ? data.error : null;
        throw new Error(res.status >= 500 || !message ? 'Internal error' : message);
    }
    return { status: res.status, data: data as T, setCookies };
}

/** Puts the backend's Set-Cookie headers (sign-in, sign-out) on the website's response. */
export async function relayCookies(setCookies: string[]) {
    if (!setCookies.length) return;
    const jar = await cookies();
    for (const header of setCookies) {
        const [pair, ...attributes] = header.split(';').map(s => s.trim());
        const index = pair.indexOf('=');
        if (index <= 0) continue;
        const name = pair.slice(0, index);
        const value = pair.slice(index + 1);
        const options: Record<string, unknown> = { path: '/' };
        for (const attribute of attributes) {
            const [key, raw] = attribute.split('=');
            const k = key.toLowerCase();
            if (k === 'max-age') options.maxAge = Number(raw);
            else if (k === 'httponly') options.httpOnly = true;
            else if (k === 'secure') options.secure = true;
            else if (k === 'samesite') options.sameSite = (raw || 'lax').toLowerCase();
            else if (k === 'path') options.path = raw;
            else if (k === 'expires') options.expires = new Date(raw);
        }
        jar.set(name, value, options as any);
    }
}

/**
 * An admin API route answered by the backend: JSON on success; on refusal the route's own format — plain text with
 * the message (the order routes) or { error } JSON (jsonErrors) — and the same status codes as before.
 */
export async function backendRoute(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown, jsonErrors = false): Promise<Response> {
    const r = await backendRequest<any>(method, path, { body, keepErrors: true });
    if (r.status < 400) return Response.json(r.data);
    const message = r.status >= 500 ? 'Internal error' : (r.data && typeof r.data.error === 'string' ? r.data.error : 'Internal error');
    return jsonErrors ? Response.json({ error: message }, { status: r.status }) : new Response(message, { status: r.status });
}
