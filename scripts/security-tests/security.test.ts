// Security regression tests for the website's server code (run with scripts/security-tests/run.sh).
// Seed: backend/src/test/resources/db/03-staff-seed.sql (all user passwords are 'pw').
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import * as executive from '@/actions/executive';
import * as cityActions from '@/app/admin/cities/actions';
import { encrypt, getSession } from '@/lib/session';
import { EXECUTIVE_TOKEN_LIFETIME_SECONDS, signExecutiveToken, verifyExecutiveToken } from '@/lib/executive-session';
import { isRiderPasswordHash, verifyRiderPassword } from '@/lib/rider-password';
import { withoutSecrets } from '@/lib/safe-records';
import { GET as diagnoseUser } from '@/app/api/diagnose-user/route';
import CitiesPage from '@/app/admin/cities/page';
import RidersPage from '@/app/admin/riders/page';
import AdminsPage from '@/app/admin/admins/page';
import RmDashboardPage from '@/app/admin/rm-dashboard/page';
import OrdersPage from '@/app/admin/orders/page';
import { adminPage, as, attempt, cookie, find, prisma, setCookie, signIn } from './harness';

const UNAUTHORIZED = 'Unauthorized';
const FORBIDDEN_ROLE = 'Forbidden: Admin access required';
const FORBIDDEN_SCOPE = 'Forbidden: Outside your assigned cities';

const id = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
const cityId = async (name: string) => (await prisma.city.findUniqueOrThrow({ where: { name } })).id;

/** Cities and every user's territory: what the city/partner actions can change. */
async function territory() {
    return JSON.stringify({
        cities: await prisma.city.findMany({ orderBy: { name: 'asc' }, select: { name: true, isActive: true, pincodes: true } }),
        users: await prisma.user.findMany({ orderBy: { email: 'asc' }, select: { email: true, cityId: true, pincodes: true } }),
    });
}

async function expectRejected(actor: string, run: () => Promise<any>, message: string) {
    as(actor);
    const before = await territory();
    const outcome = await attempt(run);
    assert.equal(outcome.thrown, message, `${actor}: expected "${message}", got ${JSON.stringify(outcome)}`);
    assert.equal(await territory(), before, `${actor}: nothing may change when the action is rejected`);
}

async function expectAllowed(actor: string, run: () => Promise<any>) {
    as(actor);
    const outcome = await attempt(run);
    assert.ok(!('thrown' in outcome), `${actor}: expected success, got ${JSON.stringify(outcome)}`);
}

before(async () => {
    for (const [actor, email] of [['super', 'admin@fonzkart.in'], ['admin', 'ops@example.test'], ['zh1', 'zh1@example.test'],
        ['zh2', 'zh2@example.test'], ['p1', 'p1@example.test'], ['rm', 'rm@example.test'], ['fe', 'fe@example.test'],
        ['user', 'user@example.test']]) {
        await signIn(actor, email);
    }
    // A user whose cookie still says ADMIN although the database says USER (demoted within the 7-day lifetime).
    as('demoted').set('session', {
        value: await encrypt({ user: { id: 'u-user', email: 'user@example.test', name: 'Plain User', role: 'ADMIN' }, expires: new Date(Date.now() + 3_600_000) }),
        opts: {},
    });
    // Something secret to leak: a pending password-reset code.
    await prisma.user.update({ where: { email: 'user@example.test' }, data: { resetToken: '424242', resetTokenExpiry: new Date(Date.now() + 900_000) } });
});

after(async () => {
    await prisma.$disconnect();
});

// ------------------------------------------------------------------------------------------------ 1. debug endpoint

describe('/api/diagnose-user no longer exposes user records and password hashes', () => {
    async function call(actor: string, query: string) {
        as(actor);
        const res = await diagnoseUser(new NextRequest(`http://localhost/api/diagnose-user?${query}`));
        return { status: res.status, text: await res.text() };
    }

    test('anonymous callers are rejected, with or without the old ?key, in every environment', async () => {
        const saved = { key: process.env.INTERNAL_API_KEY, env: process.env.NODE_ENV };
        try {
            for (const env of ['production', 'development']) {
                (process.env as any).NODE_ENV = env;
                process.env.INTERNAL_API_KEY = 'known-key';
                for (const query of ['email=user@example.test', 'key=known-key&email=user@example.test']) {
                    const r = await call('anon', query);
                    assert.equal(r.status, 401, `${env} ${query}`);
                    assert.ok(!r.text.includes('user@example.test'), 'no user data');
                }
            }
        } finally {
            process.env.INTERNAL_API_KEY = saved.key;
            (process.env as any).NODE_ENV = saved.env;
        }
    });

    test('signed-in staff other than SUPER_ADMIN are rejected (including a stale ADMIN cookie)', async () => {
        for (const actor of ['user', 'admin', 'zh1', 'p1', 'rm', 'fe', 'demoted']) {
            const r = await call(actor, 'email=user@example.test');
            assert.equal(r.status, 403, actor);
            assert.ok(!r.text.includes('$2'), `${actor}: no hash`);
        }
    });

    test('SUPER_ADMIN gets the profile but never the password hash or reset code', async () => {
        const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'user@example.test' } });
        const r = await call('super', 'email=user@example.test');
        assert.equal(r.status, 200);
        const user = JSON.parse(r.text).user;
        assert.equal(user.email, 'user@example.test');
        assert.equal(user.hasPassword, true);
        assert.equal(user.hasPendingResetCode, true);
        for (const key of ['passwordHash', 'resetToken', 'resetTokenExpiry']) assert.ok(!(key in user), key);
        assert.ok(!r.text.includes(stored.passwordHash), 'hash value absent');
        assert.ok(!r.text.includes('424242'), 'reset code absent');
    });
});

// --------------------------------------------------------------------------------- 2. city and partner pincodes

describe('city and partner pincode changes require the right role and territory', () => {
    test('anonymous callers are rejected and nothing changes', async () => {
        const chennai = await cityId('Chennai');
        const p1 = await id('p1@example.test');
        await expectRejected('anon', () => cityActions.updateCityPincodes(chennai, ['600001']), UNAUTHORIZED);
        await expectRejected('anon', () => cityActions.toggleCityActive(chennai, false), UNAUTHORIZED);
        await expectRejected('anon', () => cityActions.updatePartnerPincodes(p1, ['600010']), UNAUTHORIZED);
        await expectRejected('anon', () => cityActions.removePartnerFromCity(p1), UNAUTHORIZED);
    });

    test('customers, partners, relationship managers, field executives and stale admin cookies are rejected', async () => {
        const chennai = await cityId('Chennai');
        const p1 = await id('p1@example.test');
        for (const actor of ['user', 'p1', 'rm', 'fe', 'demoted']) {
            await expectRejected(actor, () => cityActions.updateCityPincodes(chennai, []), FORBIDDEN_ROLE);
            await expectRejected(actor, () => cityActions.toggleCityActive(chennai, false), FORBIDDEN_ROLE);
            await expectRejected(actor, () => cityActions.updatePartnerPincodes(p1, []), FORBIDDEN_ROLE);
            await expectRejected(actor, () => cityActions.removePartnerFromCity(p1), FORBIDDEN_ROLE);
        }
    });

    test('a zonal head may manage only their own cities and the partners in them', async () => {
        const chennai = await cityId('Chennai');
        const madurai = await cityId('Madurai');
        await expectRejected('zh1', () => cityActions.toggleCityActive(chennai, false), FORBIDDEN_ROLE);
        await expectRejected('zh1', () => cityActions.updateCityPincodes(madurai, ['625001']), FORBIDDEN_SCOPE);
        await expectRejected('zh1', async () => cityActions.updatePartnerPincodes(await id('p2@example.test'), []), FORBIDDEN_SCOPE);
        await expectRejected('zh1', async () => cityActions.removePartnerFromCity(await id('p2@example.test')), FORBIDDEN_SCOPE);
        await expectRejected('zh1', async () => cityActions.updatePartnerPincodes(await id('ops@example.test'), ['600001']), FORBIDDEN_SCOPE);
        await expectRejected('zh2', () => cityActions.updateCityPincodes(chennai, []), FORBIDDEN_SCOPE);

        await expectAllowed('zh1', () => cityActions.updateCityPincodes(chennai, ['600001', '600002', '600010']));
        assert.deepEqual((await prisma.city.findUniqueOrThrow({ where: { id: chennai } })).pincodes, ['600001', '600002', '600010']);
        await expectAllowed('zh1', async () => cityActions.updatePartnerPincodes(await id('p1@example.test'), ['600010']));
        await expectAllowed('zh1', async () => cityActions.updatePartnerPincodes(await id('p3@example.test'), ['600003']));
        assert.deepEqual((await prisma.user.findUniqueOrThrow({ where: { email: 'p3@example.test' } })).pincodes, ['600003']);
    });

    test('admins and super admins keep full access', async () => {
        const salem = await cityId('Salem');
        await expectAllowed('admin', () => cityActions.toggleCityActive(salem, true));
        assert.equal((await prisma.city.findUniqueOrThrow({ where: { id: salem } })).isActive, true);
        await expectAllowed('super', () => cityActions.updateCityPincodes(salem, ['636001', '636002']));
        await expectAllowed('super', async () => cityActions.removePartnerFromCity(await id('p2@example.test')));
        const p2 = await prisma.user.findUniqueOrThrow({ where: { email: 'p2@example.test' } });
        assert.equal(p2.cityId, null);
        assert.deepEqual(p2.pincodes, []);
    });

    test('"Register Hub" checks the caller even when its action is invoked directly', async () => {
        as('super');
        const tree = await adminPage(() => CitiesPage());
        const form = find(tree, e => e.type === 'form' && find(e.props.children, c => c.props?.name === 'cityName').length > 0)[0];
        const registerHub = form.props.action as (fd: FormData) => Promise<void>;
        const hub = (name: string) => { const fd = new FormData(); fd.append('cityName', name); return registerHub(fd); };

        await expectRejected('anon', () => hub('Erode'), UNAUTHORIZED);
        await expectRejected('p1', () => hub('Erode'), FORBIDDEN_ROLE);
        await expectRejected('demoted', () => hub('Erode'), FORBIDDEN_ROLE);
        await expectAllowed('zh1', () => hub('Vellore'));
        assert.ok(await prisma.city.findUnique({ where: { name: 'Vellore' } }));
        assert.equal(await prisma.city.findUnique({ where: { name: 'Erode' } }), null);
    });
});

// -------------------------------------------------------------------------------- 3. rider passwords are hashed

describe('rider passwords are stored as bcrypt hashes', () => {
    before(async () => {
        await prisma.rider.createMany({
            data: [
                { id: 'sec-legacy', name: 'Legacy', phone: '+917100000001', password: 'legacy-pw' },
                { id: 'sec-new', name: 'New', phone: '+917100000002', password: null },
                { id: 'sec-empty', name: 'Empty', phone: '+917100000003', password: '' },
            ],
        });
    });

    const stored = async (riderId: string) => (await prisma.rider.findUniqueOrThrow({ where: { id: riderId } })).password;

    test('a legacy plain-text password still works once and is then replaced by a hash', async () => {
        as('legacy');
        assert.deepEqual(await attempt(() => executive.loginExecutive('+917100000001', 'legacy-pw')), { redirect: '/admin/orders' });
        const hash = await stored('sec-legacy');
        assert.ok(isRiderPasswordHash(hash), 'hashed after login');
        assert.ok(await bcrypt.compare('legacy-pw', hash!));

        as('legacy2');
        assert.deepEqual(await attempt(() => executive.loginExecutive('+917100000001', 'legacy-pw')), { redirect: '/admin/orders' });
        assert.equal(await stored('sec-legacy'), hash, 'not re-hashed again');
        as('legacy3');
        assert.deepEqual(await attempt(() => executive.loginExecutive('+917100000001', 'Legacy-pw')),
            { returned: { success: false, error: 'Invalid password' } });
        assert.equal(cookie('legacy3', 'executive_id'), undefined);
    });

    test('onboarding stores a hash, never the plain password', async () => {
        as('newbie');
        assert.deepEqual(await attempt(() => executive.loginExecutive('+917100000002')),
            { returned: { success: true, needsOnboarding: true, id: 'sec-new' } });
        assert.deepEqual(await attempt(() => executive.onboardExecutive('sec-new', 'first-pw')), { redirect: '/admin/orders' });
        const value = await stored('sec-new');
        assert.notEqual(value, 'first-pw');
        assert.ok(isRiderPasswordHash(value) && (await bcrypt.compare('first-pw', value!)));
        as('newbie2');
        assert.deepEqual(await attempt(() => executive.loginExecutive('+917100000002', 'first-pw')), { redirect: '/admin/orders' });
    });

    test("onboarding cannot overwrite an existing executive's password", async () => {
        const before = await stored('sec-legacy');
        as('attacker');
        assert.deepEqual(await attempt(() => executive.onboardExecutive('sec-legacy', 'hijack')),
            { returned: { success: false, error: 'Executive already onboarded' } });
        assert.equal(await stored('sec-legacy'), before);
        assert.equal(cookie('attacker', 'executive_id'), undefined, 'no session for the attacker');
        assert.deepEqual(await attempt(() => executive.loginExecutive('+917100000001', 'hijack')),
            { returned: { success: false, error: 'Invalid password' } });
    });

    test('onboarding refuses an empty password', async () => {
        as('attacker');
        assert.deepEqual(await attempt(() => executive.onboardExecutive('sec-empty', '')),
            { returned: { success: false, error: 'Password required' } });
        assert.equal(await stored('sec-empty'), '');
    });

    test('verification rules', async () => {
        const hash = await bcrypt.hash('secret', 10);
        assert.deepEqual(await verifyRiderPassword(hash, 'secret'), { ok: true, needsRehash: false });
        assert.deepEqual(await verifyRiderPassword(hash, 'Secret'), { ok: false, needsRehash: false });
        assert.deepEqual(await verifyRiderPassword('plain', 'plain'), { ok: true, needsRehash: true });
        assert.deepEqual(await verifyRiderPassword('plain', 'plain '), { ok: false, needsRehash: false });
        assert.deepEqual(await verifyRiderPassword('', ''), { ok: false, needsRehash: false });
        assert.deepEqual(await verifyRiderPassword(null, 'x'), { ok: false, needsRehash: false });
        assert.deepEqual(await verifyRiderPassword('x', ''), { ok: false, needsRehash: false });
    });
});

// ------------------------------------------------------------------------- 4. signed executive session cookie

describe('the executive_id cookie is a signed token and cannot be forged', () => {
    const derivedKey = () => new Uint8Array(createHmac('sha256', process.env.AUTH_SECRET!).update('fonzkart:executive-session:v1').digest());

    test('login sets a signed token, not the raw rider id', async () => {
        as('ravi');
        assert.deepEqual(await attempt(() => executive.loginExecutive('+917000000001', 'riderpw')), { redirect: '/admin/orders' });
        const token = cookie('ravi', 'executive_id')!;
        assert.notEqual(token, 'r1');
        assert.equal(token.split('.').length, 3);
        assert.equal(await verifyExecutiveToken(token), 'r1');
        const session = await executive.getExecutiveSession();
        assert.equal(session?.id, 'r1');
        assert.ok(!('password' in (session as object)), 'password not returned');
    });

    test('a forged raw rider id is ignored, so order actions are refused', async () => {
        setCookie('forger', 'executive_id', 'r1');
        as('forger');
        assert.equal(await executive.getExecutiveSession(), null);
        const before = await prisma.order.findUniqueOrThrow({ where: { id: 'o2' } });
        assert.deepEqual(await attempt(() => executive.updateOrderStatus('o2', 'failed', 'forged')), { thrown: UNAUTHORIZED });
        assert.deepEqual(await attempt(() => executive.submitVerification('o2', { riderAnswers: {}, verificationImages: [], offeredPrice: 1 })),
            { thrown: UNAUTHORIZED });
        const afterwards = await prisma.order.findUniqueOrThrow({ where: { id: 'o2' } });
        assert.deepEqual([afterwards.status, afterwards.offeredPrice, afterwards.answers], [before.status, before.offeredPrice, before.answers]);
    });

    test('tampered, expired, wrongly signed or wrong-type tokens are rejected', async () => {
        const now = Math.floor(Date.now() / 1000);
        const valid = await signExecutiveToken('r1', now);
        const [header, , signature] = valid.split('.');
        const payload = Buffer.from(JSON.stringify({ typ: 'executive', sub: 'r2', iat: now, exp: now + 600 })).toString('base64url');
        const rejected: Record<string, string> = {
            tampered: `${header}.${payload}.${signature}`,
            expired: await signExecutiveToken('r1', now - EXECUTIVE_TOKEN_LIFETIME_SECONDS - 60),
            otherSecret: await new SignJWT({ typ: 'executive' }).setProtectedHeader({ alg: 'HS256' }).setSubject('r1')
                .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode('not-the-secret')),
            sessionKey: await new SignJWT({ typ: 'executive' }).setProtectedHeader({ alg: 'HS256' }).setSubject('r1')
                .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_SECRET!)),
            wrongType: await new SignJWT({ typ: 'session' }).setProtectedHeader({ alg: 'HS256' }).setSubject('r1')
                .setIssuedAt().setExpirationTime('1h').sign(derivedKey()),
            noExpiry: await new SignJWT({ typ: 'executive' }).setProtectedHeader({ alg: 'HS256' }).setSubject('r1').sign(derivedKey()),
            algNone: `${Buffer.from('{"alg":"none"}').toString('base64url')}.${payload}.`,
            userSession: cookie('user', 'session')!,
        };
        for (const [name, token] of Object.entries(rejected)) {
            assert.equal(await verifyExecutiveToken(token), null, name);
            setCookie('probe', 'executive_id', token);
            as('probe');
            assert.equal(await executive.getExecutiveSession(), null, name);
        }
    });

    test('a field executive with a forged cookie still gets only their own rider record', async () => {
        as('fe');
        assert.equal((await executive.getExecutiveSession())?.id, 'r4');
        setCookie('fe', 'executive_id', 'r1');
        as('fe');
        assert.equal((await executive.getExecutiveSession())?.id, 'r4');
        setCookie('fe', 'executive_id', undefined);
    });

    test('an executive token is useless as a user session', async () => {
        setCookie('mixup', 'session', await signExecutiveToken('r1'));
        as('mixup');
        assert.equal((await getSession())?.user, undefined);
        assert.deepEqual(await attempt(() => cityActions.toggleCityActive('c-chennai', false)), { thrown: UNAUTHORIZED });
    });

    test('logout removes the cookie', async () => {
        as('ravi');
        assert.deepEqual(await attempt(() => executive.logoutExecutive()), { redirect: '/login' });
        assert.equal(cookie('ravi', 'executive_id'), undefined);
    });
});

// ------------------------------------------------------------------- 5. secrets are not sent to the browser

describe('admin pages do not send password hashes, reset codes or rider passwords to the browser', () => {
    const SECRET_KEYS = ['passwordHash', 'resetToken', 'resetTokenExpiry', 'password'];

    function secretPaths(value: any, path: string, out: string[]) {
        if (Array.isArray(value)) value.forEach((v, i) => secretPaths(v, `${path}[${i}]`, out));
        else if (value && typeof value === 'object' && !(value instanceof Date) && !value.$$el) {
            for (const [k, v] of Object.entries(value)) {
                if (SECRET_KEYS.includes(k)) out.push(`${path}.${k}`);
                secretPaths(v, `${path}.${k}`, out);
            }
        }
        return out;
    }

    /** Props of every component element: what would be serialised for client components. */
    function leaks(tree: any) {
        const out: string[] = [];
        for (const e of find(tree, el => typeof el.type === 'function')) {
            const { children, ...props } = e.props;
            secretPaths(props, e.type.name || 'component', out);
        }
        return out;
    }

    test('riders, admins, cities and orders pages (super admin) and the RM dashboard', async () => {
        await prisma.user.update({ where: { email: 'p1@example.test' }, data: { resetToken: '515151' } });
        const pages: Array<[string, () => Promise<any>]> = [
            ['super', () => RidersPage()], ['super', () => AdminsPage()], ['super', () => CitiesPage()],
            ['super', () => OrdersPage({} as any)], ['zh1', () => CitiesPage()], ['rm', () => RmDashboardPage()],
        ];
        for (const [actor, page] of pages) {
            as(actor);
            const tree = await adminPage(page);
            assert.deepEqual(leaks(tree), [], `${actor} ${page.toString()}`);
            assert.ok(find(tree, el => typeof el.type === 'function').length > 0, 'page rendered components');
        }
    });

    test('withoutSecrets removes secret keys at any depth and keeps everything else', () => {
        const when = new Date();
        assert.deepEqual(withoutSecrets({ a: 1, passwordHash: 'h', nested: [{ password: 'p', b: when, resetToken: 't', resetTokenExpiry: when }] }),
            { a: 1, nested: [{ b: when }] });
    });
});

// ------------------------------------------------------------------ 6. one-time conversion of plain passwords

describe('scripts/hash-rider-passwords.ts', () => {
    const run = (...args: string[]) => execFileSync('/app/node_modules/.bin/tsx', ['scripts/hash-rider-passwords.ts', ...args],
        { cwd: '/app', env: process.env, encoding: 'utf8' });

    test('dry run changes nothing; --apply hashes only plain-text values and is safe to repeat', async () => {
        const existingHash = await bcrypt.hash('mig-three', 10);
        await prisma.rider.createMany({
            data: [
                { id: 'mig-1', name: 'M1', phone: '+917200000001', password: 'mig-one' },
                { id: 'mig-2', name: 'M2', phone: '+917200000002', password: 'mig two ✓' },
                { id: 'mig-3', name: 'M3', phone: '+917200000003', password: existingHash },
                { id: 'mig-4', name: 'M4', phone: '+917200000004', password: '' },
                { id: 'mig-5', name: 'M5', phone: '+917200000005', password: null },
            ],
        });
        const values = async () => Object.fromEntries((await prisma.rider.findMany({ where: { id: { startsWith: 'mig-' } } })).map(r => [r.id, r.password]));
        const before = await values();

        const dry = run();
        assert.match(dry, /Dry run/);
        assert.ok(!dry.includes('mig-one') && !dry.includes('mig-1'), 'never prints passwords or ids');
        assert.deepEqual(await values(), before);

        const applied = run('--apply');
        assert.match(applied, /Hashed \d+ password\(s\)\./);
        const after = await values();
        assert.ok(isRiderPasswordHash(after['mig-1']) && (await bcrypt.compare('mig-one', after['mig-1']!)));
        assert.ok(isRiderPasswordHash(after['mig-2']) && (await bcrypt.compare('mig two ✓', after['mig-2']!)));
        assert.equal(after['mig-3'], existingHash);
        assert.equal(after['mig-4'], '');
        assert.equal(after['mig-5'], null);

        assert.match(run('--apply'), /Hashed 0 password\(s\)\./);
        assert.deepEqual(await values(), after);

        as('migrated');
        assert.deepEqual(await attempt(() => executive.loginExecutive('+917200000001', 'mig-one')), { redirect: '/admin/orders' });
    });
});
