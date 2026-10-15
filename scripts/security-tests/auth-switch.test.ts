// With USE_API_AUTH=1 sign-up, sign-in, email verification, password reset, quick register/login, the profile and the
// executive phone login are done by Spring Boot (the endpoints the apps use). The backend's Set-Cookie becomes the
// website's cookie and {"redirectTo"} a redirect, so the browser sees the same as before. That the backend answers
// like the website's own code is proven by AuthScenarioParityTest.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as auth from '@/actions/auth';
import * as inline from '@/actions/inlineAuth';
import * as executive from '@/actions/executive';
import * as sessionActions from '@/actions/session';
import { updateProfile } from '@/actions/profile';
import { calls, withBackend } from './fake-backend';
import { as, attempt, cookie, form } from './harness';

const SESSION = 'session=signed.jwt.value; Path=/; Max-Age=604800; Expires=Thu, 01 Jan 2099 00:00:00 GMT; HttpOnly; SameSite=Lax';

describe('website sign-in through Spring Boot (USE_API_AUTH)', () => {
    test('sign-in: the backend session cookie is set on the website and its redirect followed', async () => {
        await withBackend(['AUTH'], {
            'POST /api/auth/signin': { body: { redirectTo: '/admin' }, setCookie: [SESSION] },
        }, async seen => {
            const jar = as('au-staff');
            assert.deepEqual(await attempt(() => auth.signin(null, form({ email: 'ops@example.test', password: 'pw' }))), { redirect: '/admin' });
            assert.deepEqual(seen[0].body, { email: 'ops@example.test', password: 'pw' });
            assert.equal(cookie('au-staff', 'session'), 'signed.jwt.value');
            const opts = jar.get('session').opts;
            assert.equal(opts.httpOnly, true);
            assert.equal(opts.sameSite, 'lax');
            assert.equal(opts.maxAge, 604800);
            assert.equal(opts.path, '/');
        });
    });

    test('form errors come back unchanged, with no cookie set', async () => {
        await withBackend(['AUTH'], {
            'POST /api/auth/signin': { body: { error: 'Invalid email/phone or password' } },
        }, async () => {
            as('au-wrong');
            assert.deepEqual(await auth.signin(null, form({ email: 'ops@example.test', password: 'nope' })), { error: 'Invalid email/phone or password' });
            assert.equal(cookie('au-wrong', 'session'), undefined);
        });
    });

    test('every auth action calls its backend endpoint with the form fields', async () => {
        await withBackend(['AUTH'], {
            'POST /api/auth/signup': { body: { redirectTo: '/verify-email?email=new%40example.test' } },
            'POST /api/auth/verify-email': { body: { redirectTo: '/' }, setCookie: [SESSION] },
            'POST /api/auth/password-reset/request': { body: { success: 'OTP successfully sent to your registered email address.', email: 'new@example.test', step: 'verify' } },
            'POST /api/auth/password-reset/confirm': { body: { success: 'Password reset successfully! You can now login.' } },
            'POST /api/auth/quick-register': { body: { success: true, user: { id: 'u1', role: 'USER' } }, setCookie: [SESSION] },
            'POST /api/auth/quick-login': { body: { error: 'Invalid email or password' } },
            'PUT /api/users/me': { body: { success: true } },
        }, async seen => {
            as('au-new');
            const signup = { name: 'New', email: 'new@example.test', phone: '9000000001', password: 'pw' };
            assert.deepEqual(await attempt(() => auth.signup(null, form(signup))), { redirect: '/verify-email?email=new%40example.test' });
            assert.deepEqual(await attempt(() => auth.verifyEmailSignup(null, form({ email: 'new@example.test', otp: '123456' }))), { redirect: '/' });
            assert.equal((await auth.requestPasswordReset(null, form({ email: 'new@example.test' }))).step, 'verify');
            assert.match((await auth.verifyAndResetPassword(null, form({ email: 'new@example.test', otp: '654321', password: 'pw2' }))).success!, /reset successfully/);
            assert.equal((await inline.quickRegister(form(signup))).success, true);
            assert.deepEqual(await inline.quickLogin(form({ email: 'new@example.test', password: 'x' })), { error: 'Invalid email or password' });
            assert.deepEqual(await updateProfile(null, form({ name: 'Renamed', phone: '9000000002' })), { success: true });

            assert.deepEqual(calls(seen), [
                'POST /api/auth/signup', 'POST /api/auth/verify-email', 'POST /api/auth/password-reset/request',
                'POST /api/auth/password-reset/confirm', 'POST /api/auth/quick-register', 'POST /api/auth/quick-login', 'PUT /api/users/me',
            ]);
            assert.deepEqual(seen.map(s => s.body), [
                signup,
                { email: 'new@example.test', otp: '123456' },
                { email: 'new@example.test' },
                { email: 'new@example.test', otp: '654321', password: 'pw2' },
                signup,
                { email: 'new@example.test', password: 'x' },
                { name: 'Renamed', phone: '9000000002' },
            ]);
            // The profile update is made as the person the backend just signed in.
            assert.equal(seen[6].cookie, 'session=signed.jwt.value');
        });
    });

    test('executive phone login and onboarding: the executive cookie comes from the backend', async () => {
        await withBackend(['AUTH'], {
            'POST /api/executive/login': { body: { success: true, needsOnboarding: true, id: 'r9' } },
            'POST /api/executive/onboard': { body: { redirectTo: '/admin/orders' }, setCookie: ['executive_id=exec.token; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax'] },
        }, async seen => {
            as('au-rider');
            assert.deepEqual(await executive.loginExecutive('+917000000009'), { success: true, needsOnboarding: true, id: 'r9' });
            assert.deepEqual(await attempt(() => executive.onboardExecutive('r9', 'first-pw')), { redirect: '/admin/orders' });
            assert.equal(cookie('au-rider', 'executive_id'), 'exec.token');
            assert.deepEqual(seen.map(s => s.body), [{ phone: '+917000000009' }, { id: 'r9', password: 'first-pw' }]);
        });
    });

    test('switch off: sign-in stays on the website and the backend is never called', async () => {
        await withBackend(['AUTH'], {}, async seen => {
            as('au-local');
            assert.deepEqual(await attempt(() => auth.signin(null, form({ email: 'ops@example.test', password: 'pw' }))), { redirect: '/admin' });
            assert.ok(cookie('au-local', 'session'));
            assert.deepEqual(seen, []);
        }, false);
    });
});

describe('session code the browser can reach', () => {
    test('lib/session.ts is not a server-action module; the browser can only sign out', () => {
        const source = readFileSync(join(process.cwd(), 'lib/session.ts'), 'utf8');
        assert.doesNotMatch(source, /^\s*['"]use server['"]/m, 'encrypt() and login() must not be callable from the browser');
        assert.deepEqual(Object.keys(sessionActions).filter(k => typeof (sessionActions as any)[k] === 'function'), ['logout']);
    });

    test('signing out clears the session cookie', async () => {
        const jar = as('au-out');
        jar.set('session', { value: 'x', opts: {} });
        await sessionActions.logout();
        assert.equal(cookie('au-out', 'session'), '');
    });
});
