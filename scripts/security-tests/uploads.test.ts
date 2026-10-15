// Image uploads (admin panel logos and model pictures, executives' pickup photos). Without the switch the website
// keeps the files itself, with the backend's rules: signed in, images only, 10 MB. With USE_API_UPLOADS=1 they go
// to the backend (same volume as the apps' uploads) and /uploads/<name> is served from there.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { uploadImage } from '@/actions/upload';
import { GET as serveUpload } from '@/app/uploads/[name]/route';
import { signExecutiveToken } from '@/lib/executive-session';
import { as, attempt, cookie, setCookie, signIn } from './harness';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const fileForm = (bytes: Buffer, name: string, type = 'image/png') => {
    const fd = new FormData();
    fd.append('file', new File([bytes], name, { type }));
    return fd;
};

type Seen = { method: string; url: string; cookie: string; body: Buffer; contentType: string };

async function withBackend(reply: (url: string) => { status: number; type: string; body: Buffer | string }, fn: (seen: Seen[]) => Promise<void>) {
    const seen: Seen[] = [];
    const server = createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        seen.push({ method: req.method!, url: req.url!, cookie: req.headers.cookie ?? '', body: Buffer.concat(chunks), contentType: req.headers['content-type'] ?? '' });
        const r = reply(req.url!);
        res.statusCode = r.status;
        res.setHeader('content-type', r.type);
        res.end(r.body);
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const saved = { use: process.env.USE_API_UPLOADS, url: process.env.BACKEND_URL };
    process.env.BACKEND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.USE_API_UPLOADS = '1';
    try {
        await fn(seen);
    } finally {
        if (saved.use === undefined) delete process.env.USE_API_UPLOADS; else process.env.USE_API_UPLOADS = saved.use;
        if (saved.url === undefined) delete process.env.BACKEND_URL; else process.env.BACKEND_URL = saved.url;
        await new Promise(r => server.close(r));
    }
}

const serve = (name: string) => serveUpload(new Request('http://test/uploads/' + name), { params: Promise.resolve({ name }) });

describe('image uploads', () => {
    test('without the switch: only signed-in people and executives, only images; the type comes from the content', async () => {
        as('up-nobody');
        assert.deepEqual(await attempt(() => uploadImage(fileForm(PNG, 'logo.png'))), { thrown: 'Unauthorized' });

        await signIn('up-cust', 'cust@example.test');
        assert.deepEqual(await attempt(() => uploadImage(fileForm(Buffer.from('<script>alert(1)</script>'), 'x.html', 'text/html'))),
            { thrown: 'Only images can be uploaded' });
        assert.deepEqual(await attempt(() => uploadImage(fileForm(Buffer.from('<svg onload="alert(1)"/>'), 'x.svg', 'image/svg+xml'))),
            { thrown: 'Only images can be uploaded' });
        assert.deepEqual(await attempt(() => uploadImage(fileForm(Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]), 'big.png'))),
            { thrown: 'File too large (max 10 MB)' });

        // A PNG named .html is stored as .png; the name keeps only safe characters.
        const url = await uploadImage(fileForm(PNG, '../../front photo.html'));
        assert.match(url, /^\/uploads\/\d+-\d+-frontphoto\.png$/);
        const stored = join(process.cwd(), 'public', url);
        assert.deepEqual(await readFile(stored), PNG);
        await rm(stored);

        setCookie('up-r1', 'executive_id', await signExecutiveToken('r1'));
        as('up-r1');
        const photo = await uploadImage(fileForm(PNG, 'pickup.png'));
        assert.match(photo, /^\/uploads\/.+-pickup\.png$/);
        await rm(join(process.cwd(), 'public', photo));

        // Nothing is served through the backend route without the switch.
        assert.equal((await serve('a.png')).status, 404);
    });

    test('with USE_API_UPLOADS: the file goes to the backend as the caller, and /uploads is served from there', async () => {
        await signIn('up-cust', 'cust@example.test');
        await withBackend(url => url === '/api/uploads'
            ? { status: 200, type: 'application/json', body: JSON.stringify({ url: '/uploads/1-2-logo.png' }) }
            : url === '/uploads/1-2-logo.png' ? { status: 200, type: 'image/png', body: PNG }
            : { status: 404, type: 'text/plain', body: '' }, async seen => {
            as('up-cust');
            assert.equal(await uploadImage(fileForm(PNG, 'logo.png')), '/uploads/1-2-logo.png');
            assert.equal(seen[0].method, 'POST');
            assert.equal(seen[0].url, '/api/uploads');
            assert.equal(seen[0].cookie, `session=${cookie('up-cust', 'session')}`);
            assert.match(seen[0].contentType, /^multipart\/form-data; boundary=/);
            assert.ok(seen[0].body.includes(PNG) && seen[0].body.includes('filename="logo.png"'));

            const res = await serve('1-2-logo.png');
            assert.equal(res.status, 200);
            assert.equal(res.headers.get('content-type'), 'image/png');
            assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
            assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);

            assert.equal((await serve('missing.png')).status, 404);
            const before = seen.length;
            assert.equal((await serve('..')).status, 404);
            assert.equal((await serve('a%2Fb.png')).status, 404);
            assert.equal(seen.length, before); // unsafe names never reach the backend
        });

        await withBackend(() => ({ status: 415, type: 'application/json', body: JSON.stringify({ error: 'Only images can be uploaded' }) }), async () => {
            as('up-cust');
            assert.deepEqual(await attempt(() => uploadImage(fileForm(Buffer.from('hello'), 'a.txt', 'text/plain'))), { thrown: 'Only images can be uploaded' });
        });
    });
});
