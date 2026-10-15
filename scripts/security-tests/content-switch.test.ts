// With USE_API_CONTENT=1 catalog editing (brands, models, variants) and the home page banner prices go to Spring Boot,
// the backend the Admin app uses, as the signed-in admin. That the backend makes the same changes as the website's
// own code is proven by ContentScenarioParityTest.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as admin from '@/actions/admin';
import Home from '@/app/page';
import { HomeClient } from '@/components/HomeClient';
import { calls, withBackend } from './fake-backend';
import { as, attempt, cookie, propsOf, signIn } from './harness';

let setUp: Promise<void> | undefined;
const setUpOnce = () => (setUp ??= signIn('ct-admin', 'ops@example.test'));

describe('website content editing through Spring Boot (USE_API_CONTENT)', () => {
    test('catalog editing and banner prices call the backend as the signed-in admin', async () => {
        await setUpOnce();
        await withBackend(['CONTENT'], {
            'POST /api/catalog/admin/brands': { body: { success: true, id: 'acme' } },
            'POST /api/catalog/admin/models': { body: { success: true, id: 'm-new' } },
            'POST /api/catalog/admin/variants': { body: { success: true, id: 'v-new' } },
            'GET /api/content/banner-prices/admin': { body: [{ id: 'p1', categoryKey: 'smartphone', categoryName: 'Phones', displayPrice: '₹45,000' }] },
            'PUT /api/content/banner-prices/p1': { body: { success: true, item: { id: 'p1', displayPrice: '₹50,000' } } },
        }, async seen => {
            as('ct-admin');
            assert.deepEqual(await admin.addBrand('Acme', '/uploads/acme.png', 'tv', 5), { success: true, id: 'acme' });
            await admin.updateBrand('acme', 'Acme', '/uploads/acme2.png');
            await admin.deleteBrand('acme', 'tv');
            assert.deepEqual(await admin.addModel('acme', 'Acme TV', '/uploads/tv.png', 'tv', 7), { success: true, id: 'm-new' });
            await admin.updateModel('m-new', 'acme', 'Acme TV 2', '/uploads/tv.png', 'tv', 8);
            await admin.reorderModels([{ id: 'm-new', priority: 1 }]);
            await admin.deleteModel('m-new');
            assert.deepEqual(await admin.addVariant('m-new', '55 inch', 20000), { success: true, id: 'v-new' });
            await admin.updateVariant('v-new', 'm-new', '55 inch', 21000);
            await admin.deleteVariant('v-new');
            assert.equal((await admin.getDeviceDisplayPrices())[0].displayPrice, '₹45,000');
            assert.deepEqual(await admin.updateDeviceDisplayPrice('p1', '₹50,000'), { success: true, item: { id: 'p1', displayPrice: '₹50,000' } });

            assert.deepEqual(calls(seen), [
                'POST /api/catalog/admin/brands',
                'PUT /api/catalog/admin/brands/acme',
                'DELETE /api/catalog/admin/brands/acme?category=tv',
                'POST /api/catalog/admin/models',
                'PUT /api/catalog/admin/models/m-new',
                'PUT /api/catalog/admin/models/order',
                'DELETE /api/catalog/admin/models/m-new',
                'POST /api/catalog/admin/variants',
                'PUT /api/catalog/admin/variants/v-new',
                'DELETE /api/catalog/admin/variants/v-new',
                'GET /api/content/banner-prices/admin',
                'PUT /api/content/banner-prices/p1',
            ]);
            assert.deepEqual(seen.map(s => s.body), [
                { name: 'Acme', logo: '/uploads/acme.png', category: 'tv', priority: 5 },
                { name: 'Acme', logo: '/uploads/acme2.png' },
                undefined,
                { brandId: 'acme', name: 'Acme TV', img: '/uploads/tv.png', category: 'tv', priority: 7 },
                { brandId: 'acme', name: 'Acme TV 2', img: '/uploads/tv.png', category: 'tv', priority: 8 },
                [{ id: 'm-new', priority: 1 }],
                undefined,
                { modelId: 'm-new', name: '55 inch', basePrice: 20000 },
                { modelId: 'm-new', name: '55 inch', basePrice: 21000 },
                undefined,
                undefined,
                { displayPrice: '₹50,000' },
            ]);
            for (const s of seen) assert.equal(s.cookie, `session=${cookie('ct-admin', 'session')}`);
        });
    });

    test('a refusal from the backend reaches the admin panel with its message', async () => {
        await setUpOnce();
        await withBackend(['CONTENT'], {
            'POST /api/catalog/admin/brands': { status: 403, body: { error: 'Forbidden: Admin access required' } },
        }, async () => {
            as('ct-admin');
            assert.deepEqual(await attempt(() => admin.addBrand('Acme', '')), { thrown: 'Forbidden: Admin access required' });
        });
    });

    test('home page: banner prices come from the backend; a failure shows no internals', async () => {
        const prices = [{ id: 'p1', categoryKey: 'smartphone', categoryName: 'Phones', displayPrice: '₹45,000' }];
        await withBackend(['CONTENT'], { 'GET /api/content/banner-prices': { body: prices } }, async seen => {
            as('ct-visitor');
            assert.deepEqual(propsOf(await Home(), HomeClient)[0].displayPrices, prices);
            assert.deepEqual(calls(seen), ['GET /api/content/banner-prices']);
        });
        await withBackend(['CONTENT'], { 'GET /api/content/banner-prices': { status: 500, body: { error: 'db down at 10.0.0.5' } } }, async () => {
            as('ct-visitor');
            const page = JSON.stringify(await Home());
            assert.match(page, /Something went wrong/);
            assert.doesNotMatch(page, /Backend 500|banner-prices|at .*\.ts/);
        });
    });

    test('switch off: content stays on Prisma and the backend is never called', async () => {
        await setUpOnce();
        await withBackend(['CONTENT'], {}, async seen => {
            as('ct-admin');
            assert.ok(Array.isArray(await admin.getDeviceDisplayPrices()));
            as('ct-visitor');
            assert.ok(Array.isArray(propsOf(await Home(), HomeClient)[0].displayPrices));
            assert.deepEqual(seen, []);
        }, false);
    });
});
