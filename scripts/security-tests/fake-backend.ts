// A stand-in for the Spring Boot backend in the USE_API_* switch tests: records every request (method, URL, the
// cookies the website forwarded, the JSON body) and answers as scripted per "METHOD /path" (default 200
// {"success": true}). The switches named in `parts` are on while `fn` runs, unless `on` is false.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export type Seen = { method: string; url: string; cookie: string; body: any };
export type Reply = { status?: number; body?: unknown; setCookie?: string[] };

export async function withBackend(parts: string[], replies: Record<string, Reply>, fn: (seen: Seen[]) => Promise<void>, on = true) {
    const seen: Seen[] = [];
    const server = createServer(async (req, res) => {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        seen.push({ method: req.method!, url: req.url!, cookie: req.headers.cookie ?? '', body: raw ? JSON.parse(raw) : undefined });
        const reply = replies[`${req.method} ${req.url!.split('?')[0]}`] ?? { body: { success: true } };
        res.statusCode = reply.status ?? 200;
        res.setHeader('content-type', 'application/json');
        if (reply.setCookie) res.setHeader('set-cookie', reply.setCookie);
        res.end(JSON.stringify(reply.body ?? null));
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const names = ['BACKEND_URL', ...parts.map(p => `USE_API_${p}`)];
    const saved = Object.fromEntries(names.map(n => [n, process.env[n]]));
    process.env.BACKEND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    for (const p of parts) {
        if (on) process.env[`USE_API_${p}`] = '1'; else delete process.env[`USE_API_${p}`];
    }
    try {
        await fn(seen);
    } finally {
        for (const n of names) {
            if (saved[n] === undefined) delete process.env[n]; else process.env[n] = saved[n];
        }
        await new Promise(r => server.close(r));
    }
}

export const calls = (seen: Seen[]) => seen.map(s => `${s.method} ${s.url}`);
