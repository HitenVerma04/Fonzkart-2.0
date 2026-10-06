// Order flow: routing to partners, relationship managers, price approval before pickup, payouts and the customer
// tracker. Every rule is tested from both sides: who may do it, and who is refused (with nothing changed).
// Seed: backend/src/test/resources/db/03-staff-seed.sql — Partner One (600001, 600002; RM Rita, zonal head zh1),
// Partner Two (625001; RM Rita), Partner Three (no pincodes, no RM; zonal head zh1). Executives: r1, r4 (Partner
// One; r4 is the fe@example.test account), r2 (Partner Two), r3 (no partner), u-fe2 (Partner Three).
// Every test creates its own orders, so it does not depend on what other test files changed.
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as admin from '@/actions/admin';
import * as orders from '@/actions/orders';
import * as executive from '@/actions/executive';
import { signExecutiveToken } from '@/lib/executive-session';
import { trackerSteps } from '@/lib/order-status';
import { POST as orderApi, DELETE as orderDelete } from '@/app/api/admin/orders/[id]/route';
import { POST as bulkApi } from '@/app/api/admin/orders/bulk/route';
import OrdersPage from '@/app/admin/orders/page';
import RmDashboardPage from '@/app/admin/rm-dashboard/page';
import PartnersPage from '@/app/admin/partners/page';
import OrderManager from '@/components/admin/OrderManager';
import RMPartnerView from '@/components/admin/RMPartnerView';
import { adminPage, as, attempt, find, prisma, propsOf, setCookie, signIn } from './harness';

const UNAUTHORIZED = 'Unauthorized';
const FORBIDDEN_ROLE = 'Forbidden: Admin access required';
const FORBIDDEN_ORDER = 'Forbidden: Outside your orders';
const FORBIDDEN_ASSIGNEE = 'Forbidden: Outside your partners and executives';
const INVALID_STATE = "Invalid: Not possible in the order's current status";
const NOT_YOUR_ORDER = 'Forbidden: Not your order';

let n = 0;
/** A fresh order (id `of-<n>`) for the test customer. */
async function order(data: Record<string, unknown> = {}) {
    n++;
    return prisma.order.create({
        data: {
            id: `of-${n}`, userId: 'u-cust', device: `Test Phone ${n}`, price: 10000, status: 'Pending Pickup',
            address: `${n} Test Street`, answers: JSON.stringify({ paymentMethod: 'amazon_voucher', phone: '9000000000' }),
            ...data,
        },
    });
}
const get = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });
const answersOf = async (id: string) => JSON.parse((await get(id)).answers || '{}');

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

/** Calls the single-order API as `actor`; returns the HTTP status (and parsed body when JSON). */
async function api(actor: string, id: string, body: Record<string, unknown>) {
    as(actor);
    const res = await orderApi(new Request('http://test/api/admin/orders/' + id, { method: 'POST', body: JSON.stringify(body) }),
        { params: Promise.resolve({ id }) });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* plain text */ }
    return { status: res.status, body: json ?? text };
}
async function bulk(actor: string, body: Record<string, unknown>) {
    as(actor);
    const res = await bulkApi(new Request('http://test/api/admin/orders/bulk', { method: 'POST', body: JSON.stringify(body) }));
    return { status: res.status, body: await res.text() };
}

/** The orders, partners and permissions the Orders page gives OrderManager for `actor`. */
async function ordersPageFor(actor: string) {
    as(actor);
    const props = propsOf(await adminPage(() => OrdersPage({} as any)), OrderManager)[0];
    return { ids: new Set<string>(props.initialOrders.map((o: any) => o.id)), props };
}

let setUp: Promise<void> | undefined;
const setUpOnce = () => (setUp ??= (async () => {
    for (const [actor, email] of [['super', 'admin@fonzkart.in'], ['admin', 'ops@example.test'], ['zh1', 'zh1@example.test'],
        ['p1', 'p1@example.test'], ['p2', 'p2@example.test'], ['rm', 'rm@example.test'], ['fe', 'fe@example.test'],
        ['cust', 'cust@example.test']]) {
        await signIn(actor, email);
    }
    // A second RM with no partners, and an executive cookie for r1 (Partner One's other executive).
    await prisma.user.upsert({
        where: { email: 'rm2@example.test' }, update: { role: 'RELATIONSHIP_MANAGER' },
        create: { id: 'u-rm2', name: 'Second RM', email: 'rm2@example.test', role: 'RELATIONSHIP_MANAGER',
            passwordHash: (await prisma.user.findUniqueOrThrow({ where: { id: 'u-rm' } })).passwordHash },
    });
    await signIn('rm2', 'rm2@example.test');
    setCookie('r1', 'executive_id', await signExecutiveToken('r1'));
    // The seed's relationships (other test files may have changed them).
    await prisma.user.updateMany({ where: { id: { in: ['u-p1', 'u-p2'] } }, data: { relationshipManagerId: 'u-rm', role: 'PARTNER' } });
    await prisma.user.update({ where: { id: 'u-p1' }, data: { pincodes: ['600001', '600002'], cityId: 'c-chennai', managerId: 'u-zh1' } });
    await prisma.user.update({ where: { id: 'u-p3' }, data: { relationshipManagerId: null, role: 'PARTNER', managerId: 'u-zh1' } });
    await prisma.rider.update({ where: { id: 'r4' }, data: { partnerId: 'u-p1', phone: '+917000000004' } });
    await prisma.rider.update({ where: { id: 'r1' }, data: { partnerId: 'u-p1' } });
    await prisma.rider.update({ where: { id: 'r2' }, data: { partnerId: 'u-p2' } });
    await prisma.city.update({ where: { id: 'c-chennai' }, data: { managerId: 'u-zh1' } });
    // Earlier test files may have given Rita more partners or zh1 more cities and partners.
    await prisma.user.updateMany({ where: { relationshipManagerId: 'u-rm', id: { notIn: ['u-p1', 'u-p2'] } }, data: { relationshipManagerId: null } });
    await prisma.city.updateMany({ where: { managerId: 'u-zh1', id: { not: 'c-chennai' } }, data: { managerId: null } });
    await prisma.user.update({ where: { id: 'u-p2' }, data: { managerId: null, cityId: 'c-madurai', pincodes: ['625001'] } });
})());

// ------------------------------------------------------------------------------------------------ routing

describe('new orders are routed to the partner covering the pincode', () => {
    before(setUpOnce);

    test('covered pincode: the longest-registered partner; their RM and the partner are notified', async () => {
        // A newer partner also covering 600001 does not take the order over.
        await prisma.user.upsert({ where: { email: 'p-late@example.test' }, update: {},
            create: { id: 'u-p-late', name: 'Late Partner', email: 'p-late@example.test', passwordHash: 'x', role: 'PARTNER', pincodes: ['600001'] } });
        await expectOk('cust', () => orders.placeOrder('Pixel 9', '128GB', 20000, '9 Beach Rd, Chennai', '600001', null, { phone: '9000000001' }));
        const placed = await prisma.order.findFirstOrThrow({ where: { device: 'Pixel 9 (128GB)' }, orderBy: { createdAt: 'desc' } });
        assert.equal(placed.partnerId, 'u-p1');
        assert.equal(placed.status, 'Pending Pickup');
        const notified = (await prisma.notification.findMany({ where: { orderId: placed.id, type: 'order_new' } })).map(x => x.userId);
        for (const id of ['u-p1', 'u-rm', 'u-super', 'u-admin']) assert.ok(notified.includes(id), `${id} notified`);
        for (const id of ['u-p2', 'u-p-late', 'u-rm2']) assert.ok(!notified.includes(id), `${id} not notified`);
        await prisma.user.delete({ where: { id: 'u-p-late' } });
    });

    test('uncovered pincode: unrouted, every RM is notified', async () => {
        await expectOk('cust', () => orders.placeOrder('Nokia X', '64GB', 3000, 'Far away', '111111', null, {}));
        const placed = await prisma.order.findFirstOrThrow({ where: { device: 'Nokia X (64GB)' } });
        assert.equal(placed.partnerId, null);
        const notified = (await prisma.notification.findMany({ where: { orderId: placed.id } })).map(x => x.userId);
        assert.ok(notified.includes('u-rm') && notified.includes('u-rm2'));
    });
});

// ------------------------------------------------------------------------------------------------ visibility

describe('who sees which orders on the Orders page', () => {
    before(setUpOnce);

    test('RMs: their partners\' orders and unrouted ones; partners: their own and legacy ones in their pincodes', async () => {
        const toP1 = await order({ partnerId: 'u-p1', pincode: '600001' });
        const toP2 = await order({ partnerId: 'u-p2', pincode: '625001' });
        const toP3 = await order({ partnerId: 'u-p3', pincode: '600002' }); // re-routed away from Partner One's pincode
        const unrouted = await order({ pincode: '600002' });
        const unroutedElsewhere = await order({ pincode: '999998', address: 'Somewhere' });

        const sees = async (actor: string) => (await ordersPageFor(actor)).ids;
        const expect = async (actor: string, visible: any[], hidden: any[]) => {
            const ids = await sees(actor);
            for (const o of visible) assert.ok(ids.has(o.id), `${actor} should see ${o.id}`);
            for (const o of hidden) assert.ok(!ids.has(o.id), `${actor} must not see ${o.id}`);
        };
        await expect('super', [toP1, toP2, toP3, unrouted, unroutedElsewhere], []);
        await expect('rm', [toP1, toP2, unrouted, unroutedElsewhere], [toP3]);
        await expect('rm2', [unrouted, unroutedElsewhere], [toP1, toP2, toP3]);
        await expect('p1', [toP1, unrouted], [toP2, toP3, unroutedElsewhere]);
        await expect('p2', [toP2], [toP1, toP3, unrouted, unroutedElsewhere]);
        await expect('zh1', [toP1, toP3, unrouted], [toP2, unroutedElsewhere]); // team partners + Chennai territory
    });

    test('controls offered match the role; RMs may route only to their own partners', async () => {
        const rm = (await ordersPageFor('rm')).props;
        assert.deepEqual(rm.permissions, { assignPartner: true, assignRider: true, approvePrice: true, manage: true, bulk: true, delete: false });
        assert.deepEqual(rm.partners.filter((p: any) => p.routable).map((p: any) => p.id).sort(), ['u-p1', 'u-p2']);
        assert.ok(rm.riders.every((r: any) => ['u-p1', 'u-p2'].includes(r.partnerId)), 'only their partners\' executives');
        const p1 = (await ordersPageFor('p1')).props;
        assert.deepEqual(p1.permissions, { assignPartner: false, assignRider: true, approvePrice: true, manage: true, bulk: false, delete: false });
        assert.ok(p1.riders.every((r: any) => r.partnerId === 'u-p1'));
        assert.equal((await ordersPageFor('admin')).props.permissions.delete, true);
    });
});

// ------------------------------------------------------------------------------------------------ routing changes

describe('assigning partners and executives', () => {
    before(setUpOnce);

    test('assignPartner: RMs within their partners, admins anywhere; partners, executives and visitors never', async () => {
        const o = await order({ partnerId: 'u-p1', pincode: '600001', riderId: 'r1', status: 'assigned' });
        await expectThrown('p1', () => admin.assignPartner(o.id, 'u-p2'), FORBIDDEN_ROLE);
        await expectThrown('fe', () => admin.assignPartner(o.id, 'u-p2'), FORBIDDEN_ROLE);
        await expectThrown('anon', () => admin.assignPartner(o.id, 'u-p2'), UNAUTHORIZED);
        await expectThrown('rm2', () => admin.assignPartner(o.id, 'u-p2'), FORBIDDEN_ORDER);
        await expectThrown('rm', () => admin.assignPartner(o.id, 'u-p3'), FORBIDDEN_ASSIGNEE);
        await expectThrown('rm', () => admin.assignPartner(o.id, 'u-rm'), 'Invalid: Not a partner');
        assert.equal((await get(o.id)).partnerId, 'u-p1');

        // Re-routing releases the executive and puts the order back to "to be assigned".
        await expectOk('rm', () => admin.assignPartner(o.id, 'u-p2'));
        const moved = await get(o.id);
        assert.deepEqual([moved.partnerId, moved.riderId, moved.status], ['u-p2', null, 'Pending Pickup']);
        assert.ok(await prisma.notification.findFirst({ where: { orderId: o.id, userId: 'u-p2' } }), 'new partner notified');

        await expectOk('admin', () => admin.assignPartner(o.id, 'u-p3'));
        assert.equal((await get(o.id)).partnerId, 'u-p3');

        // Not once the device is collected.
        const picked = await order({ partnerId: 'u-p1', riderId: 'r1', status: 'picked_up' });
        await expectThrown('admin', () => admin.assignPartner(picked.id, 'u-p2'), INVALID_STATE);
    });

    test('assignRider: only executives of the actor\'s partners; the order follows the executive\'s partner', async () => {
        const o = await order({ pincode: '600001' }); // unrouted
        await expectThrown('p1', () => admin.assignRider(o.id, 'r2'), FORBIDDEN_ASSIGNEE);
        await expectThrown('rm', () => admin.assignRider(o.id, 'u-fe2'), FORBIDDEN_ASSIGNEE); // Partner Three's
        await expectThrown('rm2', () => admin.assignRider(o.id, 'r1'), FORBIDDEN_ASSIGNEE);
        await expectThrown('fe', () => admin.assignRider(o.id, 'r1'), FORBIDDEN_ROLE);
        assert.equal((await get(o.id)).riderId, null);

        await expectOk('rm', () => admin.assignRider(o.id, 'r2'));
        let now = await get(o.id);
        assert.deepEqual([now.riderId, now.status, now.partnerId], ['r2', 'assigned', 'u-p2']);
        // Partner One no longer sees it, so may not touch it.
        await expectThrown('p1', () => admin.assignRider(o.id, 'r1'), FORBIDDEN_ORDER);
        await expectOk('p2', () => admin.assignRider(o.id, 'r2'));
        await expectOk('admin', () => admin.assignRider(o.id, 'r3')); // admins: any executive (r3 has no partner)
        now = await get(o.id);
        assert.deepEqual([now.riderId, now.partnerId], ['r3', 'u-p2']);
    });
});

// ------------------------------------------------------------------------------------------------ price approval

describe('a revised price must be approved before pickup', () => {
    before(setUpOnce);

    test('same price: picked up at once; changed price: waits for approval and approvers are notified', async () => {
        const same = await order({ partnerId: 'u-p1', riderId: 'r4', status: 'assigned' });
        const result = await expectOk('fe', () => executive.submitVerification(same.id,
            { riderAnswers: { notes: 'ok' }, verificationImages: ['a.jpg'], offeredPrice: 10000, status: 'picked_up' }));
        assert.equal(result.status, 'picked_up');
        assert.equal((await get(same.id)).status, 'picked_up');

        const changed = await order({ partnerId: 'u-p1', riderId: 'r4', status: 'assigned' });
        // The client still says "picked_up": the server decides.
        const r2 = await expectOk('fe', () => executive.submitVerification(changed.id,
            { riderAnswers: { notes: 'scratches' }, verificationImages: ['b.jpg'], offeredPrice: 8000, status: 'picked_up' }));
        assert.equal(r2.status, 'pending_verification');
        const waiting = await get(changed.id);
        assert.deepEqual([waiting.status, waiting.price, waiting.offeredPrice], ['pending_verification', 10000, 8000]);
        assert.deepEqual((await answersOf(changed.id)).priceReview.decision, 'pending');
        const notified = (await prisma.notification.findMany({ where: { orderId: changed.id, type: 'order_price_review' } })).map(x => x.userId);
        for (const id of ['u-p1', 'u-rm', 'u-zh1', 'u-super', 'u-admin']) assert.ok(notified.includes(id), `${id} notified`);
        assert.ok(!notified.includes('u-p2') && !notified.includes('u-rm2'));

        // While waiting, the executive can neither pick up nor deliver.
        await expectThrown('fe', () => executive.updateOrderStatus(changed.id, 'picked_up'), INVALID_STATE);
        await expectThrown('fe', () => executive.updateOrderStatus(changed.id, 'completed'), INVALID_STATE);
        assert.equal((await get(changed.id)).status, 'pending_verification');
    });

    test('only the assigned executive acts on an order', async () => {
        const o = await order({ partnerId: 'u-p1', riderId: 'r4', status: 'assigned' });
        await expectThrown('r1', () => executive.submitVerification(o.id, { riderAnswers: {}, verificationImages: [], offeredPrice: 1 }), NOT_YOUR_ORDER);
        await expectThrown('r1', () => executive.updateOrderStatus(o.id, 'failed', 'x'), NOT_YOUR_ORDER);
        await expectThrown('r1', () => executive.markPayoutPaidByExecutive(o.id, 'x'), NOT_YOUR_ORDER);
        await expectThrown('anon', () => executive.updateOrderStatus(o.id, 'failed', 'x'), UNAUTHORIZED);
        const after = await get(o.id);
        assert.deepEqual([after.status, after.offeredPrice], ['assigned', null]);
        await expectThrown('fe', () => executive.updateOrderStatus(o.id, 'Pending Pickup'), 'Invalid: Status');
    });

    test('approvers: the partner, their RM, zonal head and admins — nobody else', async () => {
        const o = await order({ partnerId: 'u-p1', riderId: 'r4', status: 'assigned' });
        await expectOk('fe', () => executive.submitVerification(o.id, { riderAnswers: {}, verificationImages: [], offeredPrice: 8000 }));

        for (const actor of ['p2', 'rm2']) assert.equal((await api(actor, o.id, { action: 'approve_verification' })).status, 403, actor);
        assert.equal((await api('fe', o.id, { action: 'approve_verification' })).status, 403);
        assert.equal((await api('anon', o.id, { action: 'approve_verification' })).status, 401);
        assert.equal((await get(o.id)).status, 'pending_verification');

        // Rejected by the partner: back to the executive with the reason.
        assert.equal((await api('p1', o.id, { action: 'reject_verification', reason: 'Offer at most 9000' })).status, 200);
        let now = await get(o.id);
        assert.deepEqual([now.status, now.offeredPrice, now.price], ['assigned', null, 10000]);
        let answers = await answersOf(o.id);
        assert.equal(answers.priceReview.decision, 'rejected');
        assert.equal(answers.adminRejectionLog.at(-1).reason, 'Offer at most 9000');

        // Revised again and approved by the RM at an adjusted price: the executive may now collect at that price.
        await expectOk('fe', () => executive.submitVerification(o.id, { riderAnswers: {}, verificationImages: [], offeredPrice: 8500 }));
        assert.equal((await api('rm', o.id, { action: 'approve_verification', overridePrice: 8700 })).status, 200);
        now = await get(o.id);
        assert.deepEqual([now.status, now.price], ['assigned', 8700]);
        answers = await answersOf(o.id);
        assert.deepEqual([answers.quotedPrice, answers.priceReview.decision, answers.priceReview.approvedPrice], [10000, 'approved', 8700]);

        // Deciding twice, or on an order not in review: refused.
        assert.equal((await api('admin', o.id, { action: 'approve_verification' })).status, 400);
        await expectOk('fe', () => executive.updateOrderStatus(o.id, 'picked_up'));
        assert.equal((await get(o.id)).status, 'picked_up');

        // Zonal head and admin can approve too; a nonsense price is refused.
        for (const actor of ['zh1', 'admin']) {
            const x = await order({ partnerId: 'u-p1', riderId: 'r4', status: 'assigned' });
            await expectOk('fe', () => executive.submitVerification(x.id, { riderAnswers: {}, verificationImages: [], offeredPrice: 7000 }));
            assert.equal((await api(actor, x.id, { action: 'approve_verification', overridePrice: 'abc' })).status, 400);
            assert.equal((await api(actor, x.id, { action: 'approve_verification' })).status, 200, actor);
            assert.equal((await get(x.id)).price, 7000);
        }
    });
});

// ------------------------------------------------------------------------------------------------ payouts

describe('payouts are confirmed once, after the device is collected', () => {
    before(setUpOnce);

    test('the executive marks it paid; method and amount are recorded; not twice, not before pickup', async () => {
        const o = await order({ partnerId: 'u-p1', riderId: 'r4', status: 'assigned', price: 9100 });
        await expectThrown('fe', () => executive.markPayoutPaidByExecutive(o.id, 'X'), INVALID_STATE);
        await expectOk('fe', () => executive.updateOrderStatus(o.id, 'picked_up'));
        await expectOk('fe', () => executive.markPayoutPaidByExecutive(o.id, ' AMZ-ORDER-77 '));
        const payout = (await answersOf(o.id)).payout;
        assert.deepEqual([payout.status, payout.method, payout.amount, payout.reference, payout.byRole],
            ['paid', 'amazon_voucher', 9100, 'AMZ-ORDER-77', 'FIELD_EXECUTIVE']);
        await expectThrown('fe', () => executive.markPayoutPaidByExecutive(o.id, 'again'), 'Invalid: Payout already recorded');
        await expectOk('fe', () => executive.updateOrderStatus(o.id, 'completed'));
        assert.equal((await get(o.id)).status, 'completed');
    });

    test('staff: only for orders they see', async () => {
        const o = await order({ partnerId: 'u-p1', riderId: 'r4', status: 'picked_up' });
        await expectThrown('p2', () => admin.markPayoutPaid(o.id, 'x'), FORBIDDEN_ORDER);
        await expectThrown('fe', () => admin.markPayoutPaid(o.id, 'x'), FORBIDDEN_ROLE);
        assert.equal((await answersOf(o.id)).payout, undefined);
        assert.equal((await api('p1', o.id, { action: 'mark_payout_paid', reference: 'UPI-1' })).status, 200);
        assert.equal((await answersOf(o.id)).payout.reference, 'UPI-1');
    });
});

// ------------------------------------------------------------------------------------------------ other order actions

describe('fail, restore, hub, delete and bulk actions are scoped', () => {
    before(setUpOnce);

    test('single-order actions', async () => {
        const mine = await order({ partnerId: 'u-p1', pincode: '600001' });
        const other = await order({ partnerId: 'u-p2', pincode: '625001' });
        assert.equal((await api('p1', other.id, { action: 'fail_order', reason: 'x' })).status, 403);
        assert.equal((await get(other.id)).status, 'Pending Pickup');
        assert.equal((await api('rm', mine.id, { action: 'fail_order', reason: 'Customer cancelled' })).status, 200);
        assert.equal((await get(mine.id)).status, 'failed');
        assert.equal((await api('rm', mine.id, { action: 'fail_order' })).status, 400); // already failed
        assert.equal((await api('p1', mine.id, { action: 'restore_order' })).status, 200);
        assert.equal((await get(mine.id)).status, 'Pending Pickup');
        assert.equal((await api('p1', mine.id, { action: 'update_hub_status', hubStatus: 'handed_over' })).status, 400); // not completed

        // Deleting: admins and zonal heads (their orders) only, on every path.
        for (const actor of ['p1', 'rm']) {
            assert.equal((await api(actor, mine.id, { action: 'delete_order' })).status, 403);
            await expectThrown(actor, () => admin.deleteOrder(mine.id), FORBIDDEN_ROLE);
        }
        as('zh1');
        assert.equal((await orderDelete(new Request('http://test', { method: 'DELETE' }), { params: Promise.resolve({ id: other.id }) })).status, 403);
        assert.ok(await prisma.order.findUnique({ where: { id: other.id } }));
        assert.equal((await api('zh1', mine.id, { action: 'delete_order' })).status, 200);
        assert.equal(await prisma.order.findUnique({ where: { id: mine.id } }), null);
    });

    test('bulk: all selected orders must be the caller\'s, or nothing changes', async () => {
        const a = await order({ partnerId: 'u-p1' });
        const b = await order({ partnerId: 'u-p2' });
        const c = await order({ partnerId: 'u-p3' });
        assert.equal((await bulk('rm', { action: 'bulk_fail', ids: [a.id, c.id], reason: 'x' })).status, 403);
        assert.deepEqual([(await get(a.id)).status, (await get(c.id)).status], ['Pending Pickup', 'Pending Pickup']);
        assert.equal((await bulk('p1', { action: 'bulk_fail', ids: [a.id] })).status, 403);
        assert.equal((await bulk('rm', { action: 'bulk_delete', ids: [a.id] })).status, 403);
        const ok = await bulk('rm', { action: 'bulk_fail', ids: [a.id, b.id], reason: 'Bulk' });
        assert.deepEqual([ok.status, JSON.parse(ok.body).count], [200, 2]);
        assert.deepEqual([(await get(a.id)).status, (await get(b.id)).status], ['failed', 'failed']);
    });
});

// ------------------------------------------------------------------------------------------------ RM dashboard, partners

describe('relationship managers and their partners', () => {
    before(setUpOnce);

    test('the RM dashboard lists only the RM\'s own partners', async () => {
        as('rm');
        const partners = propsOf(await adminPage(() => RmDashboardPage()), RMPartnerView)[0].partners;
        assert.deepEqual(partners.map((p: any) => p.id), ['u-p1', 'u-p2']);
        as('rm2');
        assert.deepEqual(propsOf(await adminPage(() => RmDashboardPage()), RMPartnerView)[0].partners, []);
    });

    test('partners an RM registers are theirs; only admins and zonal heads choose a partner\'s RM', async () => {
        as('super');
        const [create] = find(await adminPage(() => PartnersPage()), e => e.type === 'form' && typeof e.props.action === 'function').map(e => e.props.action);
        const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

        await expectOk('rm2', () => create(fd({ name: 'RM2 Partner', email: 'rm2-partner@example.test', phone: '+917600000091', password: 'pw', cityId: 'c-chennai', managerId: 'none', relationshipManagerId: 'u-rm' })));
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { email: 'rm2-partner@example.test' } })).relationshipManagerId, 'u-rm2');
        await expectOk('admin', () => create(fd({ name: 'Admin Partner', email: 'admin-partner@example.test', phone: '+917600000092', password: 'pw', cityId: 'c-chennai', managerId: 'none', relationshipManagerId: 'u-rm' })));
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { email: 'admin-partner@example.test' } })).relationshipManagerId, 'u-rm');
        // Not a relationship manager: ignored.
        await expectOk('admin', () => create(fd({ name: 'Bad RM', email: 'bad-rm@example.test', phone: '+917600000093', password: 'pw', cityId: 'c-chennai', managerId: 'none', relationshipManagerId: 'u-zh1' })));
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { email: 'bad-rm@example.test' } })).relationshipManagerId, null);

        // Partner "update" forms (one per partner, keyed by the partner card): RMs cannot move partners between RMs.
        as('super');
        const tree = await adminPage(() => PartnersPage());
        const card = find(tree, e => e.key === 'u-p2')[0];
        const update = find(card, e => e.type === 'form')[0].props.action;
        await expectOk('rm2', () => update(fd({ cityId: 'c-madurai', managerId: 'none', relationshipManagerId: 'u-rm2' })));
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: 'u-p2' } })).relationshipManagerId, 'u-rm');
        await expectOk('admin', () => update(fd({ cityId: 'c-madurai', managerId: 'none', relationshipManagerId: 'u-rm2' })));
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: 'u-p2' } })).relationshipManagerId, 'u-rm2');
        await prisma.user.update({ where: { id: 'u-p2' }, data: { relationshipManagerId: 'u-rm' } });

        // addPartner (Users page / upgrade form) by an RM.
        await prisma.user.upsert({ where: { email: 'upgrade-me@example.test' }, update: { role: 'USER' },
            create: { id: 'u-upgrade', name: 'Upgrade', email: 'upgrade-me@example.test', passwordHash: 'x' } });
        await expectOk('rm2', () => admin.addPartner('upgrade-me@example.test'));
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { email: 'upgrade-me@example.test' } })).relationshipManagerId, 'u-rm2');
    });
});

// ------------------------------------------------------------------------------------------------ customer tracker

describe('the customer tracker follows the same data as the admin panel', () => {
    before(setUpOnce);

    const states = (o: any) => trackerSteps(o).map(s => `${s.key}:${s.state}`).join(' ');

    test('every stage', () => {
        const base = { price: 10000, answers: { paymentMethod: 'cash' } };
        assert.equal(states({ ...base, status: 'Pending Pickup' }),
            'placed:done partner:current executive:upcoming picked_up:upcoming paid:upcoming hub:upcoming');
        assert.equal(states({ ...base, status: 'Pending Pickup', partnerId: 'p' }),
            'placed:done partner:done executive:current picked_up:upcoming paid:upcoming hub:upcoming');
        assert.equal(states({ ...base, status: 'assigned', partnerId: 'p', riderId: 'r' }),
            'placed:done partner:done executive:done picked_up:current paid:upcoming hub:upcoming');
        assert.equal(states({ ...base, status: 'pending_verification', partnerId: 'p', riderId: 'r', offeredPrice: 8000,
            answers: { priceReview: { quotedPrice: 10000, requestedPrice: 8000, decision: 'pending' } } }),
            'placed:done partner:done executive:done review:current picked_up:upcoming paid:upcoming hub:upcoming');
        assert.equal(states({ status: 'assigned', partnerId: 'p', riderId: 'r', price: 8700,
            answers: { quotedPrice: 10000, priceReview: { quotedPrice: 10000, requestedPrice: 8500, decision: 'approved', approvedPrice: 8700 } } }),
            'placed:done partner:done executive:done review:done picked_up:current paid:upcoming hub:upcoming');
        assert.equal(states({ ...base, status: 'picked_up', partnerId: 'p', riderId: 'r' }),
            'placed:done partner:done executive:done picked_up:done paid:current hub:upcoming');
        assert.equal(states({ status: 'completed', partnerId: 'p', riderId: 'r', price: 10000, answers: { payout: { status: 'paid', method: 'cash', amount: 10000 } } }),
            'placed:done partner:done executive:done picked_up:done paid:done hub:done');
        assert.equal(states({ ...base, status: 'failed', partnerId: 'p' }),
            'placed:done partner:done executive:failed picked_up:upcoming paid:upcoming hub:upcoming');
        assert.equal(states({ ...base, status: 'failed' }),
            'placed:done partner:failed executive:upcoming picked_up:upcoming paid:upcoming hub:upcoming');
    });

    test('My Orders: the customer\'s own orders, with the executive who is coming', async () => {
        const o = await order({ partnerId: 'u-p1', riderId: 'r4', status: 'assigned' });
        as('cust');
        const mine = await orders.getUserOrders();
        const shown: any = mine.find(x => x.id === o.id);
        assert.equal(shown.partnerId, 'u-p1');
        assert.equal(shown.executive.phone, '+917000000004');
        assert.ok(mine.every(x => x.userId === 'u-cust'));
        as('anon');
        assert.deepEqual(await orders.getUserOrders(), []);
    });
});
