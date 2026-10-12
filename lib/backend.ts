// Server-side calls from the website to the Spring Boot backend, the one backend the website and the apps share.
// Each part of the website moves over on its own switch: USE_API_<PART>=1 plus BACKEND_URL (in Coolify, the
// backend's internal address, e.g. http://<backend container>:8080). With the switch off the website keeps using
// Prisma, so a part never has two writers. No silent fallback: if the backend fails, the error shows.
const TIMEOUT_MS = 10_000;

export type ApiPart = 'CATALOG';

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
