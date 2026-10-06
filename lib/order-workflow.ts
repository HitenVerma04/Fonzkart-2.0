import type { Order } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { StaffUser } from '@/lib/staff-access';
import {
    FORBIDDEN_ASSIGNEE, INVALID_ORDER_STATE, OrderScope, canAssignRider, canRouteTo,
} from '@/lib/order-access';
import {
    ORDER_STATUS as S, PriceReview, isAssignable, isCompleted, isFailed, normalizeStatus, parseAnswers, payoutOf,
    priceReviewOf,
} from '@/lib/order-status';

// Every change of an order's state, shared by the server actions (actions/admin.ts, actions/executive.ts) and the
// API routes (app/api/admin/orders). Callers check WHO may act (lib/order-access.ts); these functions check that the
// change makes sense for the order's current status and record it. Logs in `answers` name the actor by role and id,
// never by email, because customers can see their own order's data.

export type Actor = { role: string; id: string; name?: string | null };
export type OrderContext = { staff: StaffUser; order: Order; scope: OrderScope };

const now = () => new Date().toISOString();
const by = (actor: Actor) => ({ byRole: actor.role, byId: actor.id });

function requireStatus(ok: boolean) {
    if (!ok) throw new Error(INVALID_ORDER_STATE);
}

/** A display name for logs shown to staff (hub receipts, payouts). */
export async function staffActor(staff: StaffUser): Promise<Actor> {
    const user = await prisma.user.findUnique({ where: { id: staff.id }, select: { name: true } });
    return { role: staff.role, id: staff.id, name: user?.name || staff.role };
}

// ------------------------------------------------------------------------------------------------ notifications

async function notifyUsers(userIds: Array<string | null | undefined>, title: string, message: string, type: string, orderId: string) {
    const ids = [...new Set(userIds.filter((id): id is string => !!id))];
    try {
        await Promise.all(ids.map(userId => prisma.notification.create({ data: { userId, title, message, type, orderId } })));
    } catch (e) {
        console.error('Order notification failed:', e instanceof Error ? e.message : e);
    }
}

async function notifyRider(riderId: string | null, title: string, message: string, type: string, orderId: string) {
    if (!riderId) return;
    try {
        await prisma.notification.create({ data: { riderId, title, message, type, orderId } });
    } catch (e) {
        console.error('Rider notification failed:', e instanceof Error ? e.message : e);
    }
}

/** The people who look after an order: its partner, the partner's RM and zonal head (all RMs if unrouted). */
export async function orderCaretakers(partnerId: string | null): Promise<string[]> {
    if (partnerId) {
        const partner = await prisma.user.findUnique({
            where: { id: partnerId }, select: { id: true, relationshipManagerId: true, managerId: true },
        });
        if (partner) return [partner.id, partner.relationshipManagerId, partner.managerId].filter((id): id is string => !!id);
    }
    return (await prisma.user.findMany({ where: { role: 'RELATIONSHIP_MANAGER' }, select: { id: true } })).map(u => u.id);
}

const adminIds = async () =>
    (await prisma.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } }, select: { id: true } })).map(u => u.id);

// ------------------------------------------------------------------------------------------------ routing

/**
 * The partner a new order is routed to: a PARTNER whose pincodes include the order's pincode. When several cover
 * it, the longest-registered one (oldest account, then lowest id) is chosen, so routing is predictable; an RM or
 * admin can re-route afterwards. Null when no partner covers the pincode (the order stays unrouted and every RM
 * sees it).
 */
export async function partnerForPincode(pincode: string | null | undefined) {
    if (!pincode) return null;
    return prisma.user.findFirst({
        where: { role: 'PARTNER', pincodes: { has: pincode } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, relationshipManagerId: true, managerId: true },
    });
}

/** Routes (or re-routes) an order to a partner. A different partner takes over: the executive is released. */
export async function assignPartner({ order, scope }: OrderContext, partnerId: string) {
    requireStatus(isAssignable(order.status));
    const partner = typeof partnerId === 'string' && partnerId
        ? await prisma.user.findUnique({ where: { id: partnerId }, select: { id: true, role: true, name: true } })
        : null;
    if (!partner || partner.role !== 'PARTNER') throw new Error('Invalid: Not a partner');
    if (!canRouteTo(scope, partner.id)) throw new Error(FORBIDDEN_ASSIGNEE);
    if (order.partnerId === partner.id) return { changed: false };

    const answers = parseAnswers(order.answers);
    (answers.routingLog ??= []).push({ date: now(), partnerId: partner.id, previousPartnerId: order.partnerId, ...by(scope.staff) });
    await prisma.order.update({
        where: { id: order.id },
        data: {
            partnerId: partner.id,
            ...(order.riderId ? { riderId: null, status: S.PENDING } : {}),
            answers: JSON.stringify(answers),
        },
    });

    await notifyUsers([partner.id], 'Order routed to you',
        `Order #${order.orderNumber} (${order.device}) is now yours to assign.`, 'order_new', order.id);
    if (order.riderId) {
        await notifyRider(order.riderId, 'Order reassigned',
            `Order #${order.orderNumber} was moved to another partner and is no longer yours.`, 'order_assigned', order.id);
    }
    return { changed: true };
}

/** Gives the order to an executive; the order follows the executive's partner. */
export async function assignRider({ order, scope }: OrderContext, riderId: string) {
    requireStatus(isAssignable(order.status));
    const rider = typeof riderId === 'string' && riderId ? await prisma.rider.findUnique({ where: { id: riderId } }) : null;
    if (!rider) throw new Error('Invalid: Executive not found');
    if (!canAssignRider(scope, rider)) throw new Error(FORBIDDEN_ASSIGNEE);

    await prisma.order.update({
        where: { id: order.id },
        data: { riderId: rider.id, status: S.ASSIGNED, partnerId: rider.partnerId ?? order.partnerId },
    });
    await notifyRider(rider.id, 'New Task Assigned', `You have been assigned order #${order.orderNumber} for pickup.`, 'order_assigned', order.id);
    if (order.riderId && order.riderId !== rider.id) {
        await notifyRider(order.riderId, 'Order reassigned', `Order #${order.orderNumber} was given to another executive.`, 'order_assigned', order.id);
    }
    return rider;
}

// ------------------------------------------------------------------------------------------------ price review

/**
 * The executive's pickup decision. The quoted price stands: picked up. A different price: the order waits for
 * approval (partner, RM, zonal head or admin) before the device may be collected.
 */
export async function submitPickup(order: Order, input: { price: unknown; riderAnswers: unknown; images: unknown; updatedAnswers?: unknown }) {
    requireStatus(normalizeStatus(order.status) === S.ASSIGNED);
    const price = Math.round(Number(input.price));
    if (!Number.isFinite(price) || price < 0) throw new Error('Invalid: Price');

    const answers = { ...parseAnswers(order.answers), ...parseAnswers(input.updatedAnswers) };
    const images = Array.isArray(input.images) ? input.images.filter((i): i is string => typeof i === 'string') : [];
    const common = {
        riderAnswers: JSON.stringify(input.riderAnswers ?? null),
        verificationImages: images,
        offeredPrice: price,
    };

    if (price === order.price) {
        answers.hubStatus ||= 'pending';
        await prisma.order.update({ where: { id: order.id }, data: { ...common, status: S.PICKED_UP, answers: JSON.stringify(answers) } });
        return { status: S.PICKED_UP };
    }

    const review: PriceReview = {
        quotedPrice: typeof answers.quotedPrice === 'number' ? answers.quotedPrice : order.price,
        requestedPrice: price,
        requestedAt: now(),
        decision: 'pending',
    };
    answers.priceReview = review;
    await prisma.order.update({ where: { id: order.id }, data: { ...common, status: S.PRICE_REVIEW, answers: JSON.stringify(answers) } });

    await notifyUsers([...await orderCaretakers(order.partnerId), ...await adminIds()], 'Price approval needed',
        `Order #${order.orderNumber}: the executive offers ₹${price} instead of ₹${order.price}. Approve or reject it.`,
        'order_price_review', order.id);
    return { status: S.PRICE_REVIEW };
}

/** Approve (optionally at another price) or reject the executive's revised price. Either way the executive continues. */
export async function decidePrice({ order, staff }: OrderContext, approve: boolean, options: { overridePrice?: unknown; reason?: unknown }) {
    requireStatus(normalizeStatus(order.status) === S.PRICE_REVIEW);
    const answers = parseAnswers(order.answers);
    const review: PriceReview = priceReviewOf({ answers }) ?? {
        quotedPrice: order.price, requestedPrice: order.offeredPrice ?? order.price, decision: 'pending',
    };
    const decided = { decidedAt: now(), decidedBy: staff.role };

    if (approve) {
        const override = options.overridePrice;
        const price = override === undefined || override === null || override === ''
            ? (order.offeredPrice ?? order.price)
            : Math.round(Number(override));
        if (!Number.isFinite(price) || price < 0) throw new Error('Invalid: Price');
        if (typeof answers.quotedPrice !== 'number') answers.quotedPrice = review.quotedPrice;
        answers.priceReview = { ...review, ...decided, decision: 'approved', approvedPrice: price };
        // Back to the executive at the approved price: they now pay and collect the device ("Confirm pickup").
        await prisma.order.update({
            where: { id: order.id },
            data: { status: S.ASSIGNED, price, offeredPrice: price, answers: JSON.stringify(answers) },
        });
        await notifyRider(order.riderId, 'Price approved',
            `Order #${order.orderNumber}: ₹${price} approved. Pay the customer and confirm the pickup.`, 'order_assigned', order.id);
        return { price };
    }

    const reason = typeof options.reason === 'string' ? options.reason.slice(0, 500) : '';
    if (reason) (answers.adminRejectionLog ??= []).push({ date: now(), reason });
    answers.priceReview = { ...review, ...decided, decision: 'rejected', reason: reason || undefined };
    await prisma.order.update({
        where: { id: order.id },
        data: { status: S.ASSIGNED, verificationImages: { set: [] }, offeredPrice: null, riderAnswers: null, answers: JSON.stringify(answers) },
    });
    await notifyRider(order.riderId, 'Revised price rejected',
        `Order #${order.orderNumber}: the revised price was not approved. ${reason}`.trim(), 'order_assigned', order.id);
    return { price: order.price };
}

// ------------------------------------------------------------------------------------------------ other changes

export async function failOrder(order: Order, actor: Actor, reason: unknown) {
    requireStatus(!isCompleted(order.status) && !isFailed(order.status));
    const answers = parseAnswers(order.answers);
    (answers.failLog ??= []).push({
        date: now(),
        reason: (typeof reason === 'string' && reason.trim() ? reason.trim() : 'Marked as failed').slice(0, 500),
        by: actor.role === 'FIELD_EXECUTIVE' ? 'executive' : actor.role,
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: S.FAILED, answers: JSON.stringify(answers) } });
}

export async function restoreOrder(order: Order, actor: Actor) {
    requireStatus(isFailed(order.status));
    const answers = parseAnswers(order.answers);
    (answers.restoreLog ??= []).push({ date: now(), previousStatus: order.status, ...by(actor) });
    // With an executive: back to them (In Progress). Without: back to "To Be Assigned".
    const status = order.riderId ? S.ASSIGNED : S.PENDING;
    await prisma.order.update({ where: { id: order.id }, data: { status, answers: JSON.stringify(answers) } });
    return status;
}

export async function setHubStatus(order: Order, actor: Actor, hubStatus: unknown) {
    if (hubStatus !== 'handed_over' && hubStatus !== 'pending') throw new Error('Invalid: Hub status');
    requireStatus(isCompleted(order.status));
    const answers = parseAnswers(order.answers);
    answers.hubStatus = hubStatus;
    answers.hubHandoverAt = hubStatus === 'handed_over' ? now() : null;
    answers.hubReceivedBy = hubStatus === 'handed_over' ? (actor.name || 'Hub Staff') : null;
    await prisma.order.update({ where: { id: order.id }, data: { answers: JSON.stringify(answers) } });
    return hubStatus;
}

/** The executive delivered the device to the hub. */
export async function completeAtHub(order: Order) {
    requireStatus(normalizeStatus(order.status) === S.PICKED_UP);
    const answers = parseAnswers(order.answers);
    answers.hubStatus ||= 'pending';
    await prisma.order.update({ where: { id: order.id }, data: { status: S.COMPLETED, answers: JSON.stringify(answers) } });
}

/** The executive confirms the pickup at the order's current (quoted or approved) price. */
export async function confirmPickup(order: Order) {
    requireStatus(normalizeStatus(order.status) === S.ASSIGNED);
    const answers = parseAnswers(order.answers);
    answers.hubStatus ||= 'pending';
    await prisma.order.update({ where: { id: order.id }, data: { status: S.PICKED_UP, answers: JSON.stringify(answers) } });
}

/**
 * Records that the customer was paid (cash handed over, gift card / UPI / bank transfer sent). Once the device is
 * collected; once only. `reference` is a transaction or gift-card ORDER id — never the gift card code itself.
 */
export async function markPayoutPaid(order: Order, actor: Actor, reference: unknown) {
    requireStatus([S.PICKED_UP, S.COMPLETED].includes(normalizeStatus(order.status) as any));
    if (payoutOf(order).paid) throw new Error('Invalid: Payout already recorded');
    const ref = typeof reference === 'string' ? reference.trim().slice(0, 100) : '';
    const answers = parseAnswers(order.answers);
    answers.payout = {
        status: 'paid',
        method: answers.paymentMethod || 'cash',
        amount: order.price,
        reference: ref || null,
        paidAt: now(),
        paidBy: actor.name || actor.role,
        ...by(actor),
    };
    await prisma.order.update({ where: { id: order.id }, data: { answers: JSON.stringify(answers) } });
    return answers.payout;
}
