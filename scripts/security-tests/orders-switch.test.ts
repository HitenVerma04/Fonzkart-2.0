// With USE_API_ORDERS=1 the website's orders, executive pickups, staff order actions and notifications go to Spring
// Boot (the backend the apps use), as the signed-in person. A stand-in backend records each request and answers as
// scripted: the right endpoint must be called with the caller's cookies, and refusals must reach the browser as
// before. That the real backend behaves like the website's own order code is proven by OrderScenarioParityTest.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import * as orders from '@/actions/orders';
import * as executive from '@/actions/executive';
import * as admin from '@/actions/admin';
import * as notifications from '@/actions/notifications';
import { signExecutiveToken } from '@/lib/executive-session';
import { POST as orderApi, DELETE as orderDelete } from '@/app/api/admin/orders/[id]/route';
import { POST as bulkApi } from '@/app/api/admin/orders/bulk/route';
import { GET as unassignedApi } from '@/app/api/admin/orders/unassigned-count/route';
import OrdersPage from '@/app/admin/orders/page';
import OrderManager from '@/components/admin/OrderManager';
import RiderOrderList from '@/components/admin/RiderOrderList';
import { as, attempt, cookie, propsOf, setCookie, signIn } from './harness';

type Seen = { method: string; url: string; cookie: string; body: any };
type Reply = { status?: number; body?: unknown };

/** Runs `fn` with USE_API_ORDERS on (unless `on` is false) against a stand-in backend answering `replies`. */
async function withBackend(replies: Record<string, Reply>, fn: (seen: Seen[]) => Promise<void>, on = true) {
    const seen: Seen[] = [];
    const server = createServer(async (req, res) => {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        seen.push({ method: req.method!, url: req.url!, cookie: req.headers.cookie ?? '', body: raw ? JSON.parse(raw) : undefined });
        const reply = replies[`${req.method} ${req.url!.split('?')[0]}`] ?? { body: { success: true } };
        res.statusCode = reply.status ?? 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(reply.body ?? null));
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const saved = { use: process.env.USE_API_ORDERS, url: process.env.BACKEND_URL };
    process.env.BACKEND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    if (on) process.env.USE_API_ORDERS = '1'; else delete process.env.USE_API_ORDERS;
    try {
        await fn(seen);
    } finally {
        if (saved.use === undefined) delete process.env.USE_API_ORDERS; else process.env.USE_API_ORDERS = saved.use;
        if (saved.url === undefined) delete process.env.BACKEND_URL; else process.env.BACKEND_URL = saved.url;
        await new Promise(r => server.close(r));
    }
}

const calls = (seen: Seen[]) => seen.map(s => `${s.method} ${s.url}`);
const text = async (res: Response) => ({ status: res.status, body: await res.text() });
const orderPost = (id: string, body: unknown) =>
    orderApi(new Request('http://test/api/admin/orders/' + id, { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

let setUp: Promise<void> | undefined;
const setUpOnce = () => (setUp ??= (async () => {
    await signIn('sw-cust', 'cust@example.test');
    await signIn('sw-admin', 'ops@example.test');
    setCookie('sw-r1', 'executive_id', await signExecutiveToken('r1'));
})());

describe('website orders through Spring Boot (USE_API_ORDERS)', () => {
    test('customer: quote, booking, my orders, pincode check and service-area request, as the signed-in customer', async () => {
        await setUpOnce();
        await withBackend({
            'POST /api/orders/quote': { body: { price: 17200, basePrice: 20000, category: 'smartphone' } },
            'GET /api/orders': { body: [{ id: 'o1', status: 'Pending Pickup', executive: null }] },
            'GET /api/cities/pincode-availability': { body: true },
        }, async seen => {
            as('sw-cust');
            const answers = { physical_condition: 'good' };
            assert.equal(await orders.quotePrice('iPhone 13', '128GB', 99999, answers, 'smartphone'), 17200);
            // The price argument is not sent: the backend prices the order itself.
            assert.deepEqual(await orders.placeOrder('iPhone 13', '128GB', 1, '12 Test Rd', '600001', null, answers), { success: true });
            assert.deepEqual(await orders.getUserOrders(), [{ id: 'o1', status: 'Pending Pickup', executive: null }]);
            assert.equal(await orders.checkPincodeAvailability('600001'), true);
            await orders.requestServiceArea('999999', '9000000000', 'Somewhere');

            assert.deepEqual(calls(seen), [
                'POST /api/orders/quote',
                'POST /api/orders',
                'GET /api/orders',
                'GET /api/cities/pincode-availability?pincode=600001',
                'POST /api/orders/service-area-requests',
            ]);
            assert.deepEqual(seen[0].body, { device: 'iPhone 13', variant: '128GB', answers });
            assert.deepEqual(seen[1].body, { device: 'iPhone 13', variant: '128GB', address: '12 Test Rd', pincode: '600001', location: null, answers });
            assert.deepEqual(seen[4].body, { pincode: '999999', phone: '9000000000', address: 'Somewhere' });
            for (const s of seen) assert.equal(s.cookie, `session=${cookie('sw-cust', 'session')}`);
        });
    });

    test('executive: their orders and pickup steps, with the executive cookie', async () => {
        await setUpOnce();
        await withBackend({
            'GET /api/executive/orders': { body: [{ id: 'o2', riderId: 'r1' }] },
            'POST /api/executive/orders/o2/verification': { body: { success: true, status: 'pending_verification' } },
            'POST /api/executive/orders/o2/payout': { body: { success: true, payout: { status: 'paid' } } },
        }, async seen => {
            as('sw-r1');
            assert.deepEqual(await executive.getExecutiveOrders(), [{ id: 'o2', riderId: 'r1' }]);
            assert.deepEqual(await executive.updateOrderStatus('o2', 'picked_up'), { success: true });
            const verification = { riderAnswers: { notes: 'scratch' }, verificationImages: ['/uploads/a.png'], offeredPrice: 9000 };
            assert.deepEqual(await executive.submitVerification('o2', verification), { success: true, status: 'pending_verification' });
            assert.deepEqual(await executive.markPayoutPaidByExecutive('o2', 'UPI-1'), { success: true, payout: { status: 'paid' } });

            assert.deepEqual(calls(seen), [
                'GET /api/executive/orders',
                'POST /api/executive/orders/o2/status',
                'POST /api/executive/orders/o2/verification',
                'POST /api/executive/orders/o2/payout',
            ]);
            assert.deepEqual(seen[1].body, { status: 'picked_up' });
            assert.deepEqual(seen[2].body, verification);
            assert.deepEqual(seen[3].body, { reference: 'UPI-1' });
            for (const s of seen) assert.equal(s.cookie, `executive_id=${cookie('sw-r1', 'executive_id')}`);
        });
    });

    test('staff: order actions and notifications, as the signed-in staff member', async () => {
        await setUpOnce();
        await withBackend({
            'POST /api/staff/orders/o3/partner': { body: { success: true, changed: true } },
            'POST /api/staff/orders/o3': { body: { success: true, status: 'pending' } },
            'GET /api/notifications': { body: { success: true, notifications: [{ id: 'n1', title: 'New Order Placed' }] } },
        }, async seen => {
            as('sw-admin');
            assert.deepEqual(await admin.assignPartner('o3', 'u-p1'), { success: true, changed: true });
            assert.deepEqual(await admin.assignRider('o3', 'r1'), { success: true });
            assert.deepEqual(await admin.restoreOrder('o3'), { success: true, status: 'pending' });
            await admin.updateOrderHubStatus('o3', 'handed_over');
            await admin.markPayoutPaid('o3', 'REF-9');
            assert.deepEqual(await admin.deleteOrder('o3'), { success: true });
            assert.deepEqual(await notifications.getNotifications(), { success: true, notifications: [{ id: 'n1', title: 'New Order Placed' }] });
            await notifications.markAsRead('n1');
            await notifications.markAllAsRead();
            await notifications.sendPulseTest();

            assert.deepEqual(calls(seen), [
                'POST /api/staff/orders/o3/partner',
                'POST /api/staff/orders/o3/rider',
                'POST /api/staff/orders/o3',
                'POST /api/staff/orders/o3',
                'POST /api/staff/orders/o3',
                'DELETE /api/staff/orders/o3',
                'GET /api/notifications',
                'POST /api/notifications/n1/read',
                'POST /api/notifications/read-all',
                'POST /api/notifications/pulse-test',
            ]);
            assert.deepEqual(seen.slice(0, 5).map(s => s.body), [
                { partnerId: 'u-p1' },
                { riderId: 'r1' },
                { action: 'restore_order' },
                { action: 'update_hub_status', hubStatus: 'handed_over' },
                { action: 'mark_payout_paid', reference: 'REF-9' },
            ]);
            for (const s of seen) assert.equal(s.cookie, `session=${cookie('sw-admin', 'session')}`);
        });
    });

    test('refusals keep their message; a backend failure shows only "Internal error"', async () => {
        await setUpOnce();
        await withBackend({
            'POST /api/executive/orders/o4/status': { status: 403, body: { error: 'Forbidden: Not your order' } },
            'POST /api/staff/orders/o4/partner': { status: 500, body: { error: 'stack trace with secrets' } },
            'POST /api/staff/orders/o4': { status: 400, body: { error: "Invalid: Not possible in the order's current status" } },
            'DELETE /api/staff/orders/o4': { status: 403, body: { error: 'Forbidden: Outside your orders' } },
            'POST /api/staff/orders/bulk': { body: { success: true, count: 2 } },
            'GET /api/staff/orders/unassigned-count': { status: 401, body: { error: 'Unauthorized' } },
        }, async seen => {
            as('sw-r1');
            assert.deepEqual(await attempt(() => executive.updateOrderStatus('o4', 'failed', 'no show')), { thrown: 'Forbidden: Not your order' });
            as('sw-admin');
            assert.deepEqual(await attempt(() => admin.assignPartner('o4', 'u-p1')), { thrown: 'Internal error' });

            // The admin order routes answer in their own format with the backend's status.
            assert.deepEqual(await text(await orderPost('o4', { action: 'restore_order' })),
                { status: 400, body: "Invalid: Not possible in the order's current status" });
            assert.deepEqual(await text(await orderDelete(new Request('http://test/x', { method: 'DELETE' }), { params: Promise.resolve({ id: 'o4' }) })),
                { status: 403, body: 'Forbidden: Outside your orders' });
            const bulk = await bulkApi(new Request('http://test/api/admin/orders/bulk', { method: 'POST',
                body: JSON.stringify({ action: 'bulk_fail', ids: ['o4', 'o5'], reason: 'test' }) }));
            assert.deepEqual(await bulk.json(), { success: true, count: 2 });
            const unassigned = await unassignedApi();
            assert.equal(unassigned.status, 401);
            assert.deepEqual(await unassigned.json(), { error: 'Unauthorized' });

            assert.deepEqual(seen.find(s => s.url === '/api/staff/orders/bulk')!.body, { action: 'bulk_fail', ids: ['o4', 'o5'], reason: 'test' });
        });
    });

    test('Orders page: the backend decides what the caller sees', async () => {
        await setUpOnce();
        const page = {
            view: 'staff', role: 'ZONAL_HEAD', orders: [{ id: 'o6' }], riders: [{ id: 'r1', partner: { name: 'Partner One', pincodes: ['600001'] } }],
            partners: [{ id: 'u-p1', name: 'Partner One', routable: true }],
            permissions: { assignPartner: true, assignRider: true, approvePrice: true, manage: true, bulk: true, delete: true },
            pincodes: [], territory: ['Chennai'],
        };
        await withBackend({ 'GET /api/staff/orders': { body: page } }, async seen => {
            as('sw-admin');
            const props = propsOf(await OrdersPage({ searchParams: Promise.resolve({ riderId: 'r1' }) }), OrderManager)[0];
            assert.deepEqual(props, { initialOrders: page.orders, riders: page.riders, partners: page.partners,
                permissions: page.permissions, userRole: 'ZONAL_HEAD' });
            assert.deepEqual(calls(seen), ['GET /api/staff/orders?riderId=r1']);
        });

        await withBackend({ 'GET /api/staff/orders': { body: { ...page, view: 'executive', orders: [{ id: 'o7' }] } } }, async () => {
            as('sw-admin');
            const list = propsOf(await OrdersPage({}), RiderOrderList)[0];
            assert.deepEqual(list.orders, [{ id: 'o7' }]);
            assert.equal(list.isEmbedded, true);
        });

        await withBackend({ 'GET /api/staff/orders': { status: 403, body: { error: 'Forbidden: Admin access required' } } }, async () => {
            as('sw-admin');
            assert.deepEqual(await attempt(() => OrdersPage({})), { redirect: '/login' });
        });
    });

    test('switch off: the website keeps using Prisma and never calls the backend', async () => {
        await setUpOnce();
        await withBackend({}, async seen => {
            as('sw-cust');
            assert.ok(Array.isArray(await orders.getUserOrders()));
            assert.equal(typeof await orders.quotePrice('iPhone 13', '128GB', 20000, {}, 'smartphone'), 'number');
            as('sw-admin');
            assert.equal((await notifications.getNotifications()).success, true);
            assert.deepEqual(seen, []);
        }, false);
    });
});
