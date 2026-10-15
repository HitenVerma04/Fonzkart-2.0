import { usesApi } from '@/lib/backend';

// Uploaded images. Files that came with the website build (public/uploads) are served before this route is reached;
// with USE_API_UPLOADS=1 every other /uploads/<name> is read from the backend's upload volume, where uploads from the
// website and the apps are kept, so a picture uploaded anywhere shows everywhere.
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
    const { name } = await context.params;
    if (!usesApi('UPLOADS') || !/^[A-Za-z0-9.-]+$/.test(name) || name.includes('..')) {
        return new Response('Not found', { status: 404 });
    }
    const res = await fetch(new URL(`/uploads/${name}`, process.env.BACKEND_URL), { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok || !res.body) return new Response('Not found', { status: 404 });
    return new Response(res.body, {
        headers: {
            'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
