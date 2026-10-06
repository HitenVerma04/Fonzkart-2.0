// Staff-permission regression tests for the website's server code: which roles may grant/revoke roles, change
// pricing rules and the catalog, manage partners, zonal heads and riders, and open the admin-only pages.
// Seed: backend/src/test/resources/db/03-staff-seed.sql (all user passwords are 'pw'). Every test uses its own
// fixtures, so it does not depend on what security.test.ts changed before it.
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as admin from '@/actions/admin';
import { encrypt } from '@/lib/session';
import AdminsPage from '@/app/admin/admins/page';
import ZonalHeadsPage from '@/app/admin/zonal-heads/page';
import HomepagePage from '@/app/admin/homepage/page';
import CategoryPage from '@/app/admin/category/[slug]/page';
import PartnersPage from '@/app/admin/partners/page';
import CitiesPage from '@/app/admin/cities/page';
import RidersPage from '@/app/admin/riders/page';
import { adminPage, as, attempt, find, prisma, signIn } from './harness';

const UNAUTHORIZED = 'Unauthorized';
const FORBIDDEN_ROLE = 'Forbidden: Admin access required';
const FORBIDDEN_SCOPE = 'Forbidden: Outside your assigned cities';
const FORBIDDEN_TEAM = 'Forbidden: Outside your team';
const FORBIDDEN_TARGET = "Forbidden: Cannot change this user's role";
const FORBIDDEN_EXEC = 'Forbidden: Insufficient privileges to grant executive access';

const ADMINS = ['super', 'admin'];
const NON_ADMIN_STAFF = ['zh1', 'rm', 'p1', 'fe', 'stale'];

const userRole = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).role;
const userId = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

async function expectThrown(actor: string, run: () => Promise<any>, message: string) {
    as(actor);
    const outcome = await attempt(run);
    assert.equal(outcome.thrown, message, `${actor}: expected "${message}", got ${JSON.stringify(outcome)}`);
}

async function expectOk(actor: string, run: () => Promise<any>) {
    as(actor);
    const outcome = await attempt(run);
    assert.ok(!('thrown' in outcome) && !('redirect' in outcome), `${actor}: expected success, got ${JSON.stringify(outcome)}`);
    return outcome.returned;
}

/** A fresh ordinary account to grant roles to. */
async function account(email: string, role = 'USER', extra: Record<string, unknown> = {}) {
    await prisma.user.upsert({
        where: { email },
        update: { role, ...extra },
        create: { id: `perm-${email.split('@')[0]}`, name: email, email, passwordHash: 'x', role, ...extra },
    });
    return email;
}

// Shared set-up, run once when the first permission suite starts (not as a top-level hook, so it never overlaps
// with security.test.ts: both switch the current cookie jar).
let setUp: Promise<void> | undefined;
const setUpOnce = () => (setUp ??= signInActors());

async function signInActors() {
    for (const [actor, email] of [['super', 'admin@fonzkart.in'], ['admin', 'ops@example.test'], ['zh1', 'zh1@example.test'],
        ['zh2', 'zh2@example.test'], ['p1', 'p1@example.test'], ['rm', 'rm@example.test'], ['fe', 'fe@example.test']]) {
        await signIn(actor, email);
    }
    // A cookie that still says ADMIN for an account the database now has as USER (demoted within 7 days).
    await account('demoted@example.test');
    as('stale').set('session', {
        value: await encrypt({ user: { id: 'perm-demoted', email: 'demoted@example.test', name: 'Demoted', role: 'ADMIN' },
            expires: new Date(Date.now() + 3_600_000) }),
        opts: {},
    });
    // zh1 manages Chennai (as in the seed; security.test.ts may have unassigned it).
    await prisma.city.update({ where: { id: 'c-chennai' }, data: { managerId: 'u-zh1' } });
}

// --------------------------------------------------------------------------------------- roles

describe('only administrators grant or revoke ADMIN, ZONAL_HEAD and RELATIONSHIP_MANAGER', () => {
    before(setUpOnce);

    const grants: Array<[string, (email: string) => Promise<any>, string]> = [
        ['addAdmin', admin.addAdmin, 'ADMIN'],
        ['addZonalHead', admin.addZonalHead, 'ZONAL_HEAD'],
        ['addRelationshipManager', admin.addRelationshipManager, 'RELATIONSHIP_MANAGER'],
    ];

    test('partners, field executives, zonal heads, RMs, stale admin cookies and visitors are refused', async () => {
        const target = await account('grant-target@example.test');
        for (const [name, grant] of grants) {
            for (const actor of NON_ADMIN_STAFF) await expectThrown(actor, () => grant(target), FORBIDDEN_ROLE);
            await expectThrown('anon', () => grant(target), UNAUTHORIZED);
            assert.equal(await userRole(target), 'USER', `${name}: role unchanged`);
        }
        for (const actor of NON_ADMIN_STAFF) {
            await expectThrown(actor, () => admin.removeUserRole('ops@example.test'), FORBIDDEN_ROLE);
            await expectThrown(actor, () => admin.removeAdmin('ops@example.test'), FORBIDDEN_ROLE);
            await expectThrown(actor, () => admin.getAdmins(), FORBIDDEN_ROLE);
        }
        assert.equal(await userRole('ops@example.test'), 'ADMIN', 'the admin was not demoted');
    });

    test('SUPER_ADMIN and ADMIN can grant and revoke them', async () => {
        for (const actor of ADMINS) {
            for (const [name, grant, role] of grants) {
                const target = await account(`grant-${actor}-${name.toLowerCase()}@example.test`);
                assert.deepEqual(await expectOk(actor, () => grant(target)), { success: true });
                assert.equal(await userRole(target), role);
                assert.deepEqual(await expectOk(actor, () => admin.removeUserRole(target)), { success: true });
                assert.equal(await userRole(target), 'USER');
            }
            assert.ok(Array.isArray(await expectOk(actor, () => admin.getAdmins())));
        }
    });
});

describe('partner and field-executive grants', () => {
    before(setUpOnce);

    test('PARTNER: admins, zonal heads (own cities, under themselves) and RMs, for ordinary accounts only', async () => {
        const chennai = 'c-chennai';
        const madurai = 'c-madurai';
        for (const actor of ['p1', 'fe', 'stale']) {
            await expectThrown(actor, async () => admin.addPartner(await account('pp-1@example.test')), FORBIDDEN_ROLE);
        }
        await expectThrown('zh1', () => admin.addPartner('ops@example.test'), FORBIDDEN_TARGET);
        await expectThrown('rm', () => admin.addPartner('zh2@example.test'), FORBIDDEN_TARGET);
        await expectThrown('zh1', async () => admin.addPartner(await account('pp-2@example.test'), madurai), FORBIDDEN_SCOPE);
        await expectThrown('zh1', async () => admin.addPartner(await account('pp-2@example.test'), chennai, 'u-zh2'), FORBIDDEN_SCOPE);
        assert.equal(await userRole('ops@example.test'), 'ADMIN');
        assert.equal(await userRole('pp-2@example.test'), 'USER');

        await expectOk('zh1', async () => admin.addPartner(await account('pp-3@example.test'), chennai));
        await expectOk('rm', async () => admin.addPartner(await account('pp-4@example.test'), madurai, 'u-zh2'));
        await expectOk('admin', () => admin.addPartner('zh2@example.test'));
        assert.deepEqual([await userRole('pp-3@example.test'), await userRole('pp-4@example.test'), await userRole('zh2@example.test')],
            ['PARTNER', 'PARTNER', 'PARTNER']);
        await prisma.user.update({ where: { email: 'zh2@example.test' }, data: { role: 'ZONAL_HEAD' } });
    });

    test('FIELD_EXECUTIVE: admins, zonal heads and partners, for ordinary accounts only', async () => {
        for (const actor of ['rm', 'fe', 'stale']) {
            await expectThrown(actor, async () => admin.addFieldExecutive(await account('fe-1@example.test')), FORBIDDEN_EXEC);
        }
        await expectThrown('p1', () => admin.addFieldExecutive('ops@example.test'), FORBIDDEN_TARGET);
        await expectThrown('p1', () => admin.addFieldExecutive('zh2@example.test'), FORBIDDEN_TARGET);
        await expectThrown('zh1', () => admin.addFieldExecutive('rm@example.test'), FORBIDDEN_TARGET);
        assert.deepEqual([await userRole('ops@example.test'), await userRole('zh2@example.test'), await userRole('rm@example.test')],
            ['ADMIN', 'ZONAL_HEAD', 'RELATIONSHIP_MANAGER']);

        await expectOk('p1', async () => admin.addFieldExecutive(await account('fe-2@example.test', 'USER', { phone: '+917400000001' })));
        assert.equal(await userRole('fe-2@example.test'), 'FIELD_EXECUTIVE');
        assert.equal((await prisma.rider.findFirstOrThrow({ where: { phone: '+917400000001' } })).partnerId, 'u-p1');
        await expectOk('zh1', async () => admin.addFieldExecutive(await account('fe-3@example.test', 'UNVERIFIED')));
        await expectOk('admin', () => admin.addFieldExecutive('pp-3@example.test'));
    });

    test('partner manager changes and partner lists', async () => {
        for (const actor of NON_ADMIN_STAFF) {
            await expectThrown(actor, () => admin.updatePartnerManager('u-p3', null), FORBIDDEN_ROLE);
        }
        await expectOk('admin', () => admin.updatePartnerManager('u-p3', 'u-zh1'));

        await expectThrown('anon', () => admin.getPartnersManagedBy('u-zh1'), UNAUTHORIZED);
        for (const actor of ['p1', 'rm', 'fe']) await expectThrown(actor, () => admin.getPartnersManagedBy('u-zh1'), FORBIDDEN_ROLE);
        await expectThrown('zh1', () => admin.getPartnersManagedBy('u-zh2'), FORBIDDEN_SCOPE);
        const own = await expectOk('zh1', () => admin.getPartnersManagedBy('u-zh1'));
        assert.ok(own.some((p: any) => p.id === 'u-p3'));
        await expectOk('super', () => admin.getPartnersManagedBy('u-zh2'));
    });
});

// -------------------------------------------------------------------- pricing, catalog, landing page

describe('pricing rules, catalog and landing page are for administrators', () => {
    before(setUpOnce);

    const rule = { category: 'perm-test', questionKey: 'q', answerKey: 'a', label: 'L', deductionAmount: 1, deductionPercent: 0 };

    test('pricing rules', async () => {
        for (const actor of NON_ADMIN_STAFF) await expectThrown(actor, () => admin.upsertEvaluationRule(rule), FORBIDDEN_ROLE);
        await expectThrown('anon', () => admin.upsertEvaluationRule(rule), UNAUTHORIZED);
        assert.equal(await prisma.evaluationRule.count({ where: { category: 'perm-test' } }), 0);
        for (const actor of ADMINS) {
            await expectOk(actor, () => admin.upsertEvaluationRule({ ...rule, deductionAmount: actor === 'super' ? 2 : 3 }));
        }
        assert.equal((await prisma.evaluationRule.findFirstOrThrow({ where: { category: 'perm-test' } })).deductionAmount, 3);
    });

    test('catalog changes', async () => {
        const attempts: Array<[string, () => Promise<any>]> = [
            ['addBrand', () => admin.addBrand('Perm Brand', '/x.png', 'smartphone')],
            ['updateBrand', () => admin.updateBrand('apple', 'Hacked', '/x.png')],
            ['deleteBrand', () => admin.deleteBrand('apple')],
            ['addModel', () => admin.addModel('apple', 'Perm Model', '/x.png')],
            ['updateModel', () => admin.updateModel('m', 'apple', 'X', '/x.png')],
            ['reorderModels', () => admin.reorderModels([])],
            ['deleteModel', () => admin.deleteModel('m')],
            ['addVariant', () => admin.addVariant('m', 'V', 1)],
            ['updateVariant', () => admin.updateVariant('v', 'm', 'V', 1)],
            ['deleteVariant', () => admin.deleteVariant('v')],
        ];
        const brandsBefore = JSON.stringify(await prisma.brand.findMany({ orderBy: { id: 'asc' } }));
        for (const [, run] of attempts) {
            for (const actor of NON_ADMIN_STAFF) await expectThrown(actor, run, FORBIDDEN_ROLE);
            await expectThrown('anon', run, UNAUTHORIZED);
        }
        assert.equal(JSON.stringify(await prisma.brand.findMany({ orderBy: { id: 'asc' } })), brandsBefore, 'catalog unchanged');
        await expectOk('admin', () => admin.addBrand('Perm Brand', '/x.png', 'smartphone'));
        assert.equal(await prisma.brand.count({ where: { id: 'perm-brand' } }), 1);
    });

    test('landing-page settings', async () => {
        const before = await prisma.city.findUniqueOrThrow({ where: { id: 'c-chennai' } });
        for (const actor of NON_ADMIN_STAFF) {
            await expectThrown(actor, () => admin.toggleFeaturedCity('c-chennai', !before.isFeatured), FORBIDDEN_ROLE);
            await expectThrown(actor, () => admin.updateCityDisplayOrder('c-chennai', 9), FORBIDDEN_ROLE);
            await expectThrown(actor, () => admin.getDeviceDisplayPrices(), FORBIDDEN_ROLE);
            await expectThrown(actor, () => admin.updateDeviceDisplayPrice('x', '₹1'), FORBIDDEN_ROLE);
        }
        const unchanged = await prisma.city.findUniqueOrThrow({ where: { id: 'c-chennai' } });
        assert.deepEqual([unchanged.isFeatured, unchanged.displayOrder], [before.isFeatured, before.displayOrder]);
        await expectOk('admin', () => admin.updateCityDisplayOrder('c-chennai', 9));
        assert.equal((await prisma.city.findUniqueOrThrow({ where: { id: 'c-chennai' } })).displayOrder, 9);
    });
});

// ------------------------------------------------------------------------------------------ riders

describe('riders: zonal heads and partners only within their own team', () => {
    before(async () => {
        await setUpOnce();
        await prisma.rider.createMany({
            data: [
                { id: 'perm-r-p1', name: 'P1 rider', phone: '+917500000001', partnerId: 'u-p1' },
                { id: 'perm-r-p2', name: 'P2 rider', phone: '+917500000002', partnerId: 'u-p2' },
                { id: 'perm-r-loose', name: 'No partner', phone: '+917500000003', partnerId: null },
                // A rider record whose id is also the id of an ADMIN account (ids are shared, as with u-fe2 in the seed).
                { id: 'u-admin', name: 'Shadow', phone: '+917500000004', partnerId: 'u-p1' },
            ],
        });
    });

    test('adding riders', async () => {
        await expectThrown('p1', () => admin.addRider('X', '+917500000010', null, 'u-p2'), FORBIDDEN_TEAM);
        await expectThrown('p1', () => admin.addRider('X', '+917500000010', null, null), FORBIDDEN_TEAM);
        await expectThrown('zh1', () => admin.addRider('X', '+917500000010', null, 'u-p2'), FORBIDDEN_TEAM);
        for (const actor of ['rm', 'fe', 'stale']) await expectThrown(actor, () => admin.addRider('X', '+917500000010', null, 'u-p1'), FORBIDDEN_ROLE);
        assert.equal(await prisma.rider.count({ where: { phone: '+917500000010' } }), 0);

        await expectOk('p1', () => admin.addRider('Mine', '+917500000011', null, 'u-p1'));
        await expectOk('zh1', () => admin.addRider('Team', '+917500000012', null, 'u-p1'));
        await expectOk('zh1', () => admin.addRider('Loose', '+917500000013', null, null));
        await expectOk('admin', () => admin.addRider('Any', '+917500000014', null, 'u-p2'));
    });

    test('moving riders between partners', async () => {
        await expectThrown('p1', () => admin.updateRiderPartner('perm-r-p1', null), FORBIDDEN_ROLE);
        await expectThrown('zh1', () => admin.updateRiderPartner('perm-r-p1', 'u-p2'), FORBIDDEN_TEAM);
        await expectThrown('zh1', () => admin.updateRiderPartner('perm-r-p2', 'u-p1'), FORBIDDEN_TEAM);
        await expectThrown('zh1', () => admin.updateRiderPartner('perm-r-loose', 'u-p1'), FORBIDDEN_TEAM);
        assert.equal((await prisma.rider.findUniqueOrThrow({ where: { id: 'perm-r-p1' } })).partnerId, 'u-p1');
        await expectOk('zh1', () => admin.updateRiderPartner('perm-r-p1', 'u-p3'));
        await expectOk('admin', () => admin.updateRiderPartner('perm-r-loose', 'u-p2'));
    });

    test('removing riders never demotes another staff account', async () => {
        await expectThrown('p1', () => admin.deleteRider('perm-r-p2'), FORBIDDEN_TEAM);
        await expectThrown('p1', () => admin.deleteRider('u-zh1'), FORBIDDEN_TEAM);
        await expectThrown('p1', () => admin.deleteRider('u-admin'), FORBIDDEN_TARGET);
        await expectThrown('zh1', () => admin.deleteRider('perm-r-p2'), FORBIDDEN_TEAM);
        await expectThrown('rm', () => admin.deleteRider('perm-r-p1'), FORBIDDEN_ROLE);
        assert.equal(await userRole('ops@example.test'), 'ADMIN');
        assert.equal(await prisma.rider.count({ where: { id: { in: ['perm-r-p2', 'u-admin'] } } }), 2);

        const mine = (await prisma.rider.findFirstOrThrow({ where: { phone: '+917500000011' } })).id;
        await expectOk('p1', () => admin.deleteRider(mine));
        await expectOk('zh1', () => admin.deleteRider('perm-r-p1'));
        await expectOk('admin', () => admin.deleteRider('perm-r-p2'));
        assert.equal(await prisma.rider.count({ where: { id: { in: [mine, 'perm-r-p1', 'perm-r-p2'] } } }), 0);
    });
});

// ------------------------------------------------------------------------------- pages and inline forms

describe('admin-only pages and their built-in forms', () => {
    before(setUpOnce);

    const pages: Array<[string, () => Promise<any>, string[]]> = [
        ['users directory', () => AdminsPage(), ['super', 'admin']],
        ['zonal heads', () => ZonalHeadsPage(), ['super', 'admin']],
        ['landing page', () => HomepagePage(), ['super', 'admin']],
        ['catalog', () => CategoryPage({ params: Promise.resolve({ slug: 'smartphone' }) }), ['super', 'admin']],
        ['partners', () => PartnersPage(), ['super', 'admin', 'zh1', 'rm']],
        ['cities', () => CitiesPage(), ['super', 'admin', 'zh1']],
        ['riders (unchanged)', () => RidersPage(), ['super', 'admin', 'zh1', 'p1']],
    ];

    test('each page opens only for the roles the sidebar offers it to', async () => {
        for (const [name, page, allowed] of pages) {
            for (const actor of ['super', 'admin', 'zh1', 'rm', 'p1', 'fe']) {
                as(actor);
                const outcome = await attempt(() => adminPage(page));
                if (allowed.includes(actor)) assert.ok(!('redirect' in outcome) && !('thrown' in outcome), `${name} for ${actor}: ${JSON.stringify(outcome)}`);
                else assert.ok('redirect' in outcome, `${name} must not open for ${actor}: ${JSON.stringify(outcome)}`);
            }
        }
    });

    /** The page's built-in forms as an administrator sees them, to be submitted by someone else. */
    async function formsOf(page: () => Promise<any>) {
        as('super');
        return find(await adminPage(page), e => e.type === 'form' && typeof e.props.action === 'function').map(e => e.props.action);
    }
    const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

    test('zonal-head forms: administrators only', async () => {
        const [create, ...rest] = await formsOf(() => ZonalHeadsPage());
        for (const actor of NON_ADMIN_STAFF) {
            await expectThrown(actor, () => create(fd({ name: 'ZH', email: 'zh-new@example.test', phone: '+917600000001', password: 'pw' })), FORBIDDEN_ROLE);
            for (const action of rest) await expectThrown(actor, () => action(fd({ cityId: 'c-salem' })), FORBIDDEN_ROLE);
        }
        assert.equal(await prisma.user.count({ where: { email: 'zh-new@example.test' } }), 0);
        await expectOk('admin', () => create(fd({ name: 'ZH', email: 'zh-new@example.test', phone: '+917600000001', password: 'pw' })));
        assert.equal(await userRole('zh-new@example.test'), 'ZONAL_HEAD');
    });

    test('partner forms: administrators, zonal heads and RMs', async () => {
        const [create] = await formsOf(() => PartnersPage());
        for (const actor of ['p1', 'fe', 'stale']) {
            await expectThrown(actor, () => create(fd({ name: 'P', email: 'p-new@example.test', phone: '+917600000002', password: 'pw', cityId: 'c-chennai', managerId: 'none' })), FORBIDDEN_ROLE);
        }
        assert.equal(await prisma.user.count({ where: { email: 'p-new@example.test' } }), 0);
        await expectOk('rm', () => create(fd({ name: 'P', email: 'p-new@example.test', phone: '+917600000002', password: 'pw', cityId: 'c-chennai', managerId: 'none' })));
        assert.equal(await userRole('p-new@example.test'), 'PARTNER');
    });
});
