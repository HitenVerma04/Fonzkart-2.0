// With USE_API_CATALOG=1 the website reads the catalog from Spring Boot (the same API the apps use) instead of
// Prisma. A stand-in backend records each request; the answers must reach the caller unchanged. That the real
// backend answers exactly like the Prisma code is proven by CatalogPostgresIntegrationTest (golden recording).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { db } from '@/lib/store';
import { findVariantByName, searchGlobalModels } from '@/actions/catalog';

async function withFakeBackend(fn: (seen: string[]) => Promise<void>) {
    const seen: string[] = [];
    const server = createServer((req, res) => {
        seen.push(req.url || '');
        const path = (req.url || '').split('?')[0];
        if (path === '/api/catalog/brands/missing') { res.statusCode = 404; res.end(); return; }
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ from: 'backend', url: req.url }));
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const saved = { use: process.env.USE_API_CATALOG, url: process.env.BACKEND_URL };
    process.env.BACKEND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
        await fn(seen);
    } finally {
        if (saved.use === undefined) delete process.env.USE_API_CATALOG; else process.env.USE_API_CATALOG = saved.use;
        if (saved.url === undefined) delete process.env.BACKEND_URL; else process.env.BACKEND_URL = saved.url;
        await new Promise(r => server.close(r));
    }
}

describe('website catalog reads through Spring Boot (USE_API_CATALOG)', () => {
    test('switch on: every catalog read goes to the matching backend endpoint', async () => {
        await withFakeBackend(async seen => {
            process.env.USE_API_CATALOG = '1';
            assert.deepEqual(await db.getBrands('tv'), { from: 'backend', url: '/api/catalog/brands?category=tv' });
            await db.getBrands();
            await db.getBrand('apple');
            assert.equal(await db.getBrand('missing'), null); // 404 → null, like Prisma's findUnique
            await db.getModels('apple', 'smartphone');
            await db.getModels();
            await searchGlobalModels('galaxy s24');
            await db.getVariants('m1');
            await findVariantByName('iPhone 14 (128 GB)');
            assert.deepEqual(seen, [
                '/api/catalog/brands?category=tv',
                '/api/catalog/brands',
                '/api/catalog/brands/apple',
                '/api/catalog/brands/missing',
                '/api/catalog/models?brandId=apple&category=smartphone',
                '/api/catalog/models',
                '/api/catalog/models/search?query=galaxy+s24',
                '/api/catalog/variants?modelId=m1',
                '/api/catalog/variants/lookup?deviceName=iPhone+14+%28128+GB%29',
            ]);
        });
    });

    test('switch off: the website keeps reading through Prisma and never calls the backend', async () => {
        await withFakeBackend(async seen => {
            delete process.env.USE_API_CATALOG;
            const brands = await db.getBrands();
            assert.ok(Array.isArray(brands) && brands.length > 0);
            assert.deepEqual(seen, []);
        });
    });
});
