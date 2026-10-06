// Nothing the authentication flows log may contain a password, password hash, reset/verification code, session or
// executive token, or the session secret. Every console call made while the flows run is captured and searched.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import * as auth from '@/actions/auth';
import * as inline from '@/actions/inlineAuth';
import * as executive from '@/actions/executive';
import { as, attempt, cookie, form, prisma } from './harness';

const METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;

describe('authentication flows never log secrets', () => {
    const logged: string[] = [];
    const originals = new Map<string, (...args: any[]) => void>();

    before(() => {
        for (const m of METHODS) {
            originals.set(m, (console as any)[m]);
            (console as any)[m] = (...args: any[]) => {
                logged.push(args.map(a => (typeof a === 'string' ? a : inspect(a, { depth: Infinity }))).join(' '));
            };
        }
    });

    after(() => {
        for (const m of METHODS) (console as any)[m] = originals.get(m);
    });

    test('sign-in, sign-up, verification, password reset, quick login and executive login', async () => {
        const secrets = new Set<string>([process.env.AUTH_SECRET!, 'pw', 'log-pass-1', 'log-pass-2', 'log-quick-pw', 'log-rider-pw']);
        const remember = async (email: string) => {
            const u = await prisma.user.findUnique({ where: { email } });
            if (u?.passwordHash) secrets.add(u.passwordHash);
            if (u?.resetToken) secrets.add(u.resetToken);
        };

        // A verified customer with a pending reset code signs in (the old debug line printed both).
        await prisma.user.update({ where: { email: 'cust@example.test' }, data: { resetToken: '777123', resetTokenExpiry: new Date(Date.now() + 900_000) } });
        await remember('cust@example.test');
        as('log-cust');
        assert.deepEqual(await attempt(() => auth.signin(null, form({ email: 'cust@example.test', password: 'pw' }))), { redirect: '/' });

        // Super admin (role sync), wrong password, phone number sign-in.
        await remember('admin@fonzkart.in');
        as('log-super');
        await attempt(() => auth.signin(null, form({ email: 'admin@fonzkart.in', password: 'pw' })));
        as('log-wrong');
        await attempt(() => auth.signin(null, form({ email: 'cust@example.test', password: 'wrong-password' })));
        secrets.add('wrong-password');
        as('log-phone');
        await attempt(() => auth.signin(null, form({ email: '+916000000001', password: 'pw' })));

        // Sign-up → unverified sign-in (new code) → verification with the code.
        as('log-new');
        await attempt(() => auth.signup(null, form({ name: 'Log New', email: 'log-new@example.test', phone: '9123456780', password: 'log-pass-1' })));
        await remember('log-new@example.test');
        await attempt(() => auth.signin(null, form({ email: 'log-new@example.test', password: 'log-pass-1' })));
        await remember('log-new@example.test');
        const code = (await prisma.user.findUniqueOrThrow({ where: { email: 'log-new@example.test' } })).resetToken!;
        await attempt(() => auth.verifyEmailSignup(null, form({ email: 'log-new@example.test', otp: code })));

        // Password reset: request a code, then use it.
        as('log-reset');
        await attempt(() => auth.requestPasswordReset(null, form({ email: 'log-new@example.test' })));
        await prisma.user.update({ where: { email: 'log-new@example.test' }, data: { resetToken: '424299', resetTokenExpiry: new Date(Date.now() + 900_000) } });
        await remember('log-new@example.test');
        await attempt(() => auth.verifyAndResetPassword(null, form({ email: 'log-new@example.test', otp: '424299', password: 'log-pass-2' })));
        await remember('log-new@example.test');

        // Quick register / quick login (booking flow).
        as('log-quick');
        await attempt(() => inline.quickRegister(form({ name: 'Quick', email: 'log-quick@example.test', password: 'log-quick-pw' })));
        await attempt(() => inline.quickLogin(form({ email: 'log-quick@example.test', password: 'log-quick-pw' })));
        await remember('log-quick@example.test');

        // Executive phone login (legacy plain-text password upgraded to a hash).
        await prisma.rider.create({ data: { id: 'log-rider', name: 'Log Rider', phone: '+917800000001', password: 'log-rider-pw' } });
        as('log-exec');
        await attempt(() => executive.loginExecutive('+917800000001', 'log-rider-pw'));
        secrets.add((await prisma.rider.findUniqueOrThrow({ where: { id: 'log-rider' } })).password!);

        for (const actor of ['log-cust', 'log-super', 'log-phone', 'log-new', 'log-reset', 'log-quick', 'log-exec']) {
            for (const name of ['session', 'executive_id']) {
                const value = cookie(actor, name);
                if (value) secrets.add(value);
            }
        }

        const output = logged.join('\n');
        for (const secret of secrets) {
            if (secret.length >= 2 && secret !== 'pw') assert.ok(!output.includes(secret), `logged a secret: ${secret.slice(0, 12)}…`);
        }
        assert.ok(!/passwordHash|resetToken|\$2[aby]\$\d\d\$/.test(output), 'no password-hash or reset-code fields in the logs');
        assert.ok(output.includes('[Auth] Sign-in succeeded'), 'sign-in is still logged, without secrets');
    });
});
