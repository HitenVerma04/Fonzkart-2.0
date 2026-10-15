// Guessing limits while the website signs people in itself (lib/attempt-limits.ts; the backend has the same,
// AuthAttemptLimitIntegrationTest): 10 wrong passwords lock an account's sign-in for 15 minutes, and the 5th wrong
// email code cancels the code. Uses its own accounts, so the other test files are not affected.
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as auth from '@/actions/auth';
import * as inline from '@/actions/inlineAuth';
import * as executive from '@/actions/executive';
import { MAX_CODE_FAILURES, MAX_SIGNIN_FAILURES, TOO_MANY_CODES, TOO_MANY_SIGNINS } from '@/lib/attempt-limits';
import { as, attempt, form, prisma } from './harness';

describe('guessing limits on the website', () => {
    before(async () => {
        const pw = (await prisma.user.findUniqueOrThrow({ where: { id: 'u-cust' } })).passwordHash;
        for (const [id, email] of [['u-limit1', 'limit1@example.test'], ['u-limit2', 'limit2@example.test'], ['u-limit3', 'limit3@example.test']]) {
            await prisma.user.upsert({ where: { email }, update: { passwordHash: pw, role: 'USER' },
                create: { id, email, name: 'Limit Test', passwordHash: pw, role: 'USER' } });
        }
        const riderPw = (await prisma.rider.findUniqueOrThrow({ where: { id: 'r1' } })).password;
        await prisma.rider.upsert({ where: { id: 'r-limit' }, update: { password: riderPw },
            create: { id: 'r-limit', name: 'Limit Rider', phone: '+917000000077', password: riderPw } });
    });

    test('ten wrong passwords lock the account, for the sign-in page and the quick login alike', async () => {
        as('lim-guesser');
        for (let i = 0; i < MAX_SIGNIN_FAILURES; i++) {
            assert.deepEqual(await auth.signin(null, form({ email: 'limit1@example.test', password: `guess${i}` })), { error: 'Invalid email/phone or password' });
        }
        assert.deepEqual(await auth.signin(null, form({ email: 'limit1@example.test', password: 'pw' })), { error: TOO_MANY_SIGNINS });
        assert.deepEqual(await inline.quickLogin(form({ email: 'limit1@example.test', password: 'pw' })), { error: TOO_MANY_SIGNINS });
        // Another account is not affected.
        as('lim-other');
        assert.deepEqual(await attempt(() => auth.signin(null, form({ email: 'limit2@example.test', password: 'pw' }))), { redirect: '/' });
    });

    test('the fifth wrong code cancels the password-reset code', async () => {
        as('lim-reset');
        await prisma.user.update({ where: { email: 'limit3@example.test' },
            data: { resetToken: '123456', resetTokenExpiry: new Date(Date.now() + 15 * 60 * 1000) } });
        const reset = (otp: string) => auth.verifyAndResetPassword(null, form({ email: 'limit3@example.test', otp, password: 'new-pw' }));
        for (let i = 1; i < MAX_CODE_FAILURES; i++) {
            assert.deepEqual(await reset(`00000${i}`), { error: 'Invalid OTP provided.' });
        }
        assert.deepEqual(await reset('999999'), { error: TOO_MANY_CODES });
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { email: 'limit3@example.test' } })).resetToken, null);
        assert.deepEqual(await reset('123456'), { error: 'Invalid OTP provided.' });
    });

    test('executive passwords are limited too', async () => {
        as('lim-rider');
        for (let i = 0; i < MAX_SIGNIN_FAILURES; i++) {
            assert.deepEqual(await executive.loginExecutive('+917000000077', `guess${i}`), { success: false, error: 'Invalid password' });
        }
        assert.deepEqual(await executive.loginExecutive('+917000000077', 'riderpw'), { success: false, error: TOO_MANY_SIGNINS });
    });
});
