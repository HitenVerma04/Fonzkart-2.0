// Notification actions identify the caller from the session and database, never from browser-supplied arguments.
// Seed: backend/src/test/resources/db/03-staff-seed.sql (all passwords 'pw').
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as notifications from '@/actions/notifications';
import { GET as unassignedCount } from '@/app/api/admin/orders/unassigned-count/route';
import { as, prisma, signIn } from './harness';

const titles = (r: any) => (r.notifications ?? []).map((x: any) => x.title).sort();

let setUp: Promise<void> | undefined;
const setUpOnce = () => (setUp ??= (async () => {
    for (const [actor, email] of [['p1', 'p1@example.test'], ['p2', 'p2@example.test'], ['zh1', 'zh1@example.test'],
        ['nf-admin', 'ops@example.test'], ['nf-cust', 'cust@example.test']]) {
        await signIn(actor, email);
    }
    await prisma.notification.deleteMany({ where: { title: { startsWith: 'nf-' } } });
    await prisma.notification.createMany({
        data: [
            { id: 'nf-p1', userId: 'u-p1', title: 'nf-for-p1', message: 'm' },
            { id: 'nf-p2', userId: 'u-p2', title: 'nf-for-p2', message: 'm' },
            { id: 'nf-zh', role: 'ZONAL_HEAD', title: 'nf-for-zonal-heads', message: 'm' },
            { id: 'nf-rider', riderId: 'r1', title: 'nf-for-rider', message: 'm' },
            { id: 'nf-all', title: 'nf-system-wide', message: 'm' },
        ],
    });
})());

const mine = async (actor: string, ...args: any[]) => {
    as(actor);
    const r = await (notifications.getNotifications as any)(...args);
    return titles(r).filter((t: string) => t.startsWith('nf-'));
};

describe('notifications belong to the signed-in user', () => {
    before(setUpOnce);

    test('each user reads only their own, their role\'s and system-wide ones, whatever they claim to be', async () => {
        assert.deepEqual(await mine('p1'), ['nf-for-p1', 'nf-system-wide']);
        // Claiming another identity changes nothing (the old code trusted these arguments).
        assert.deepEqual(await mine('p1', 'ZONAL_HEAD', 'u-p2'), ['nf-for-p1', 'nf-system-wide']);
        assert.deepEqual(await mine('zh1'), ['nf-for-zonal-heads', 'nf-system-wide']);
        // Executives' notifications are theirs alone; customers and visitors get nothing.
        assert.ok(!(await mine('nf-admin')).includes('nf-for-rider'));
        assert.deepEqual(await mine('nf-cust', 'ADMIN', 'u-p1'), []);
        assert.deepEqual(await mine('anon', 'ADMIN', 'u-p1'), []);
    });

    test('marking read: only notifications addressed to the caller', async () => {
        as('p1');
        assert.deepEqual(await notifications.markAsRead('nf-p2'), { success: false });
        assert.deepEqual(await notifications.markAsRead('nf-rider'), { success: false });
        as('anon');
        assert.deepEqual(await notifications.markAsRead('nf-p1'), { success: false });
        assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: 'nf-p2' } })).isRead, false);
        as('p1');
        assert.deepEqual(await notifications.markAsRead('nf-p1'), { success: true });

        await prisma.notification.update({ where: { id: 'nf-p1' }, data: { isRead: false } });
        as('p1');
        await notifications.markAllAsRead('PARTNER', 'u-p2');
        const after = await prisma.notification.findMany({ where: { id: { in: ['nf-p1', 'nf-p2', 'nf-all'] } } });
        assert.deepEqual(Object.fromEntries(after.map(x => [x.id, x.isRead])), { 'nf-p1': true, 'nf-p2': false, 'nf-all': false });
    });

    test('notifications cannot be created from the browser; the pulse test only notifies the caller', async () => {
        assert.equal((notifications as any).createNotification, undefined);
        as('anon');
        assert.deepEqual(await notifications.sendPulseTest(), { success: false });
        as('nf-cust');
        assert.deepEqual(await notifications.sendPulseTest(), { success: false });
        const before = await prisma.notification.count({ where: { title: 'DB Heartbeat Pulse' } });
        as('p2');
        assert.deepEqual(await notifications.sendPulseTest(), { success: true });
        const pulses = await prisma.notification.findMany({ where: { title: 'DB Heartbeat Pulse' }, orderBy: { createdAt: 'desc' } });
        assert.equal(pulses.length, before + 1);
        assert.deepEqual([pulses[0].userId, pulses[0].role], ['u-p2', null]);
    });

    test('the "order waiting" buzzer counts only the caller\'s own orders', async () => {
        await prisma.order.createMany({
            data: [
                { id: 'nf-o1', userId: 'u-cust', device: 'D', price: 1, address: 'A', status: 'Pending Pickup', partnerId: 'u-p1' },
                { id: 'nf-o2', userId: 'u-cust', device: 'D', price: 1, address: 'A', status: 'Pending Pickup', partnerId: 'u-p2' },
            ],
        });
        const count = async (actor: string) => {
            as(actor);
            const res = await unassignedCount();
            return { status: res.status, body: await res.json() };
        };
        const all = (await count('nf-admin')).body.count;
        const p1 = (await count('p1')).body.count;
        assert.ok(all >= 2 && p1 >= 1 && p1 < all, `admin ${all}, partner one ${p1}`);
        assert.deepEqual((await count('nf-cust')).body, { count: 0 });
        assert.equal((await count('anon')).status, 401);
        await prisma.order.deleteMany({ where: { id: { in: ['nf-o1', 'nf-o2'] } } });
    });
});
