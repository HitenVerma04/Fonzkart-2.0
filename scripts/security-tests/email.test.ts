// The email system (app/api/email/*, actions/email-hub.ts) was open to anyone: create or delete mailboxes, read any
// inbox, send as any Fonzkart address — and the mailbox routes put the request's email and password into a root
// shell command on the mail server. Each case below is refused for the wrong caller with nothing changed, and the
// command can no longer carry anything but a validated mailbox and base64 text.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as accountsGet, POST as accountsPost, DELETE as accountsDelete } from '@/app/api/email/account/route';
import { GET as inboxGet } from '@/app/api/email/inbox/route';
import { POST as sendPost } from '@/app/api/email/send/route';
import { POST as webhookPost } from '@/app/api/webhooks/email/route';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as hub from '@/actions/email-hub';
import { mailboxAddress, mailserverCommand } from '@/lib/mail-admin';
import { as, attempt, prisma, signIn } from './harness';

const commands = () => ((globalThis as any).__sshCommands ??= []) as { host: string; cmd: string }[];
const json = (url: string, method: string, body?: unknown) =>
    new NextRequest(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });

async function setUp() {
    for (const [actor, email] of [['super', 'admin@fonzkart.in'], ['admin', 'ops@example.test'], ['p1', 'p1@example.test'],
        ['cust', 'cust@example.test']]) {
        await signIn(actor, email);
    }
    await prisma.emailAccount.upsert({ where: { email: 'support@fonzkart.in' }, update: {}, create: { email: 'support@fonzkart.in', password: 'x' } });
    await prisma.emailMessage.upsert({
        where: { messageId: 'm-1' }, update: {},
        create: { messageId: 'm-1', from: 'someone@example.com', to: 'support@fonzkart.in', subject: 'Private', bodyText: 'secret' },
    });
}

describe('email system: only the right people, and no shell injection', () => {
    before(setUp);
    after(() => { delete process.env.MAILSERVER_SSH_HOST; });

    test('nobody signed in: every email route and action is refused', async () => {
        as('anonymous');
        assert.equal((await accountsGet()).status, 401);
        assert.equal((await accountsPost(json('http://t/api/email/account', 'POST', { email: 'evil', password: 'pw' }))).status, 401);
        assert.equal((await accountsDelete(json('http://t/api/email/account?email=support@fonzkart.in', 'DELETE'))).status, 401);
        assert.equal((await inboxGet(json('http://t/api/email/inbox?account=support@fonzkart.in', 'GET'))).status, 401);
        const form = new FormData();
        for (const [k, v] of Object.entries({ fromAccount: 'support@fonzkart.in', to: 'x@example.com', subject: 's', text: 't' })) form.append(k, v);
        assert.equal((await sendPost(new NextRequest('http://t/api/email/send', { method: 'POST', body: form }))).status, 401);
        assert.equal((await attempt(() => hub.syncImapEmails('support@fonzkart.in'))).thrown, 'Unauthorized');
        assert.equal((await attempt(() => hub.fetchEmailById('x'))).thrown, 'Unauthorized');
        assert.ok(await prisma.emailAccount.findUnique({ where: { email: 'support@fonzkart.in' } }), 'account still there');
        assert.equal(await prisma.emailAccount.count({ where: { email: 'evil@fonzkart.in' } }), 0);
    });

    test('customers and partners cannot manage mailboxes or use other people\'s', async () => {
        for (const actor of ['cust', 'p1']) {
            as(actor);
            assert.equal((await accountsGet()).status, 403, actor);
            assert.equal((await accountsPost(json('http://t/api/email/account', 'POST', { email: 'evil', password: 'pw' }))).status, 403, actor);
            assert.equal((await accountsDelete(json('http://t/api/email/account?email=support@fonzkart.in', 'DELETE'))).status, 403, actor);
            assert.equal((await inboxGet(json('http://t/api/email/inbox?account=support@fonzkart.in', 'GET'))).status, 403, actor);
            assert.equal((await attempt(() => hub.deleteEmailAccountAction('support@fonzkart.in'))).returned?.error, 'Forbidden: Admin access required');
            const messageId = (await prisma.emailMessage.findUniqueOrThrow({ where: { messageId: 'm-1' } })).id;
            assert.equal((await attempt(() => hub.fetchEmailById(messageId))).returned, null, `${actor} cannot read support's mail`);
        }
        assert.ok(await prisma.emailAccount.findUnique({ where: { email: 'support@fonzkart.in' } }));
    });

    test('a password or address cannot break out of the mail server command', async () => {
        assert.equal(mailboxAddress('sales'), 'sales@fonzkart.in');
        for (const bad of ['a; rm -rf /', 'x@evil.com', "a'b@fonzkart.in", '$(id)@fonzkart.in', '']) assert.equal(mailboxAddress(bad), null, bad);
        const cmd = mailserverCommand('add', 'sales', "x'; touch /tmp/pwned; echo '$(id)`id`");
        const tail = cmd.slice(cmd.indexOf('setup email add'));
        assert.match(tail, /^setup email add sales@fonzkart\.in "\$\(printf %s [A-Za-z0-9+/=]+ \| base64 -d\)"$/);
        assert.ok(!tail.includes('touch') && !tail.includes("'"));
        assert.throws(() => mailserverCommand('del', '$(reboot)'));
    });

    test('administrators manage mailboxes; the mail server is changed only when MAILSERVER_SSH_HOST is set', async () => {
        as('admin');
        commands().length = 0;
        const created = await accountsPost(json('http://t/api/email/account', 'POST', { email: 'Sales', password: "pa'ss" }));
        assert.equal(created.status, 200);
        assert.equal((await created.json()).vpsStatus, 'skipped');
        assert.equal(commands().length, 0, 'no SSH without MAILSERVER_SSH_HOST');
        assert.ok(await prisma.emailAccount.findUnique({ where: { email: 'sales@fonzkart.in' } }));

        process.env.MAILSERVER_SSH_HOST = 'mail.test.invalid';
        const removed = await accountsDelete(json('http://t/api/email/account?email=sales@fonzkart.in', 'DELETE'));
        assert.equal(removed.status, 200);
        assert.equal(commands().length, 1);
        assert.equal(commands()[0]!.host, 'mail.test.invalid');
        assert.match(commands()[0]!.cmd, /setup email del sales@fonzkart\.in$/);
        assert.equal((await accountsDelete(json('http://t/api/email/account?email=;reboot', 'DELETE'))).status, 400);
        delete process.env.MAILSERVER_SSH_HOST;

        const listed = await (await accountsGet()).json();
        assert.ok(listed.accounts.some((a: any) => a.email === 'support@fonzkart.in'));
        assert.ok(!JSON.stringify(listed).includes('"password"'), 'passwords are never listed');
        const messageId = (await prisma.emailMessage.findUniqueOrThrow({ where: { messageId: 'm-1' } })).id;
        assert.equal((await attempt(() => hub.fetchEmailById(messageId))).returned?.subject, 'Private');
    });
});

describe('inbound email cannot reach the admin as code', () => {
    const inbound = (secret?: string) => webhookPost(new Request('http://t/api/webhooks/email', {
        method: 'POST', headers: secret === undefined ? {} : { 'x-webhook-secret': secret },
        body: JSON.stringify({ from: 'x@evil.test', to: 'support@fonzkart.in', subject: 'Webhook test', html: '<img src=x onerror=alert(1)>' }),
    }));
    const stored = () => prisma.emailMessage.count({ where: { subject: 'Webhook test' } });

    test('the mail webhook needs the shared secret, and is off without one', async () => {
        delete process.env.EMAIL_WEBHOOK_SECRET;
        assert.equal((await inbound()).status, 401);
        assert.equal((await inbound('')).status, 401);
        process.env.EMAIL_WEBHOOK_SECRET = 'hook-secret';
        try {
            assert.equal((await inbound()).status, 401);
            assert.equal((await inbound('wrong')).status, 401);
            assert.equal(await stored(), 0);
            assert.equal((await inbound('hook-secret')).status, 200);
            assert.equal(await stored(), 1);
        } finally {
            delete process.env.EMAIL_WEBHOOK_SECRET;
            await prisma.emailMessage.deleteMany({ where: { subject: 'Webhook test' } });
        }
    });

    test('the admin email view shows email HTML only in a sandboxed frame without scripts', () => {
        const source = readFileSync(join(process.cwd(), 'app/admin/email/EmailClient.tsx'), 'utf8');
        assert.ok(!source.includes('dangerouslySetInnerHTML'), 'email HTML must not be inserted into the admin page');
        const frame = source.match(/<iframe[^>]*srcDoc=\{[^}]*bodyHtml[^>]*>/)?.[0] ?? '';
        assert.match(frame, /sandbox="[^"]*"/);
        assert.doesNotMatch(frame, /allow-scripts|allow-same-origin/);
    });
});
