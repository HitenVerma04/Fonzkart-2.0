// With USE_API_STAFF=1 staff roles, partners, zonal heads, executives, cities and pricing rules are changed by Spring
// Boot (the endpoints the Admin app uses), as the signed-in staff member: the actions in actions/admin.ts and
// app/admin/cities/actions.ts, and the forms' own server actions on the Cities, Partners and Zonal Heads pages. That
// the backend makes the same changes with the same checks is proven by StaffScenarioParityTest.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as admin from '@/actions/admin';
import * as cities from '@/app/admin/cities/actions';
import CitiesPage from '@/app/admin/cities/page';
import PartnersPage from '@/app/admin/partners/page';
import ZonalHeadsPage from '@/app/admin/zonal-heads/page';
import { calls, withBackend } from './fake-backend';
import { adminPage, as, attempt, cookie, find, form, signIn } from './harness';

let setUp: Promise<void> | undefined;
const setUpOnce = () => (setUp ??= signIn('st-super', 'admin@fonzkart.in'));

/** Runs every <form action={...}> of a page with the same submitted fields. */
async function submitEveryForm(tree: any, fields: Record<string, string>) {
    for (const f of find(tree, e => e.type === 'form' && typeof e.props.action === 'function')) {
        await f.props.action(form(fields));
    }
}

describe('website staff management through Spring Boot (USE_API_STAFF)', () => {
    test('role, executive, city and pricing actions call the backend as the signed-in admin', async () => {
        await setUpOnce();
        await withBackend(['STAFF'], {
            'POST /api/staff/admins': { body: { success: false, error: 'User not found. They must register first.' } },
        }, async seen => {
            as('st-super');
            assert.deepEqual(await admin.addAdmin('nobody@example.test'), { success: false, error: 'User not found. They must register first.' });
            await admin.addZonalHead('zh@example.test');
            await admin.addRelationshipManager('rm@example.test');
            await admin.addPartner('p@example.test', 'c-chennai', 'u-zh1');
            await admin.updatePartnerManager('u-p1', null);
            await admin.toggleFeaturedCity('c-chennai', true);
            await admin.updateCityDisplayOrder('c-chennai', 2);
            await admin.addFieldExecutive('fe@example.test');
            await admin.removeAdmin('ops@example.test');
            await admin.removeUserRole('ops@example.test');
            await admin.addRider('Ravi', '+917000000001', null, 'u-p1');
            await admin.deleteRider('r9');
            await admin.updateRiderPartner('r1', 'u-p2');
            const rule = { category: 'smartphone', questionKey: 'screen', answerKey: 'cracked', label: 'Cracked', deductionAmount: 1000, deductionPercent: 0 };
            await admin.upsertEvaluationRule(rule);
            await cities.updateCityPincodes('c-chennai', ['600001']);
            await cities.toggleCityActive('c-chennai', false);
            await cities.updatePartnerPincodes('u-p1', ['600002']);
            await cities.removePartnerFromCity('u-p1');

            assert.deepEqual(calls(seen), [
                'POST /api/staff/admins',
                'POST /api/staff/zonal-heads/grant',
                'POST /api/staff/relationship-managers/grant',
                'POST /api/staff/partners/grant',
                'PUT /api/staff/partners/u-p1/manager',
                'PUT /api/cities/c-chennai/featured',
                'PUT /api/cities/c-chennai/display-order',
                'POST /api/riders/field-executives',
                'POST /api/staff/admins/remove',
                'POST /api/staff/roles/remove',
                'POST /api/riders',
                'DELETE /api/riders/r9',
                'PUT /api/riders/r1/partner',
                'PUT /api/pricing/rules',
                'PUT /api/cities/c-chennai/pincodes',
                'PUT /api/cities/c-chennai/active',
                'PUT /api/cities/partners/u-p1/pincodes',
                'POST /api/cities/partners/u-p1/remove',
            ]);
            assert.deepEqual(seen[3].body, { email: 'p@example.test', cityId: 'c-chennai', managerId: 'u-zh1' });
            assert.deepEqual(seen[4].body, { managerId: null });
            assert.deepEqual(seen[10].body, { name: 'Ravi', phone: '+917000000001', email: null, partnerId: 'u-p1' });
            assert.deepEqual(seen[13].body, rule);
            assert.deepEqual(seen[14].body, { pincodes: ['600001'] });
            for (const s of seen) assert.equal(s.cookie, `session=${cookie('st-super', 'session')}`);
        });
    });

    test('the page forms (register hub, partner, zonal head; assignments) call the backend', async () => {
        await setUpOnce();
        const fields = { cityName: 'Mysuru', name: 'New Person', email: 'new@example.test', phone: '9000000009', password: 'temp-pw',
            cityId: 'c-chennai', managerId: 'none', relationshipManagerId: 'none' };
        await withBackend(['STAFF'], {}, async seen => {
            as('st-super');
            await submitEveryForm(await adminPage(() => CitiesPage()), fields);
            await submitEveryForm(await adminPage(() => PartnersPage()), fields);
            await submitEveryForm(await adminPage(() => ZonalHeadsPage()), fields);
            const made = new Set(calls(seen).map(c => c.replace(/\/u-[\w-]+|\/c-[\w-]+/g, '/{id}')));
            for (const expected of ['POST /api/cities/hubs', 'POST /api/staff/partners', 'PUT /api/staff/partners/{id}/assignment',
                'POST /api/staff/zonal-heads', 'POST /api/staff/zonal-heads/{id}/cities']) {
                assert.ok(made.has(expected), `${expected} not called; calls: ${[...made].join(', ')}`);
            }
            assert.deepEqual(seen.find(s => s.url === '/api/cities/hubs')!.body, { cityName: 'Mysuru' });
            assert.deepEqual(seen.find(s => s.url === '/api/staff/partners')!.body,
                { name: 'New Person', email: 'new@example.test', phone: '9000000009', password: 'temp-pw', cityId: 'c-chennai', managerId: 'none', relationshipManagerId: 'none' });
            assert.deepEqual(seen.find(s => s.url === '/api/staff/zonal-heads')!.body,
                { name: 'New Person', email: 'new@example.test', phone: '9000000009', password: 'temp-pw' });
        });
    });

    test('a refusal from the backend reaches the admin panel with its message', async () => {
        await setUpOnce();
        await withBackend(['STAFF'], {
            'POST /api/riders': { status: 403, body: { error: 'Forbidden: Outside your team' } },
        }, async () => {
            as('st-super');
            assert.deepEqual(await attempt(() => admin.addRider('X', '+917000000099')), { thrown: 'Forbidden: Outside your team' });
        });
    });

    test('switch off: staff changes stay on Prisma and the backend is never called', async () => {
        await setUpOnce();
        await withBackend(['STAFF'], {}, async seen => {
            as('st-super');
            assert.deepEqual(await admin.addAdmin('nobody@example.test'), { success: false, error: 'User not found. They must register first.' });
            assert.deepEqual(seen, []);
        }, false);
    });
});
