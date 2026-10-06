'use server';

import { db } from '@/lib/store';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { hashRiderPassword, verifyRiderPassword } from '@/lib/rider-password';
import { EXECUTIVE_COOKIE, executiveCookieOptions, signExecutiveToken, verifyExecutiveToken } from '@/lib/executive-session';
import { Actor, completeAtHub, confirmPickup, failOrder, markPayoutPaid, submitPickup } from '@/lib/order-workflow';

async function startExecutiveSession(riderId: string) {
    const cookieStore = await cookies();
    cookieStore.set(EXECUTIVE_COOKIE, await signExecutiveToken(riderId), executiveCookieOptions);
}

export async function loginExecutive(phone: string, password?: string) {
    const riders = await db.getRiders();
    const executive = riders.find(r => r.phone === phone);

    if (!executive) {
        return { success: false, error: 'Phone number not found. Access denied.' };
    }

    // Check if onboarding is needed
    if (!executive.password) {
        return { success: true, needsOnboarding: true, id: executive.id };
    }

    // If already onboarded, verify password
    if (!password) {
        return { success: false, error: 'Password required' };
    }

    const check = await verifyRiderPassword(executive.password, password);
    if (!check.ok) {
        return { success: false, error: 'Invalid password' };
    }

    // A legacy plain-text password was correct: store it as a hash from now on.
    if (check.needsRehash) {
        await db.updateRiderPassword(executive.id, await hashRiderPassword(password));
    }

    await startExecutiveSession(executive.id);

    redirect('/admin/orders');
}

export async function onboardExecutive(id: string, password: string) {
    const riders = await db.getRiders();
    const executive = riders.find(r => r.id === id);

    if (!executive) return { success: false, error: 'Executive not found' };

    // Onboarding only sets a FIRST password. Without this check anyone could replace any executive's password.
    if (executive.password) return { success: false, error: 'Executive already onboarded' };
    if (typeof password !== 'string' || !password) return { success: false, error: 'Password required' };

    await db.updateRiderPassword(id, await hashRiderPassword(password));

    await startExecutiveSession(executive.id);

    redirect('/admin/orders');
}

export async function logoutExecutive() {
    const cookieStore = await cookies();
    cookieStore.delete(EXECUTIVE_COOKIE);
    redirect('/login');
}

export async function getExecutiveSession() {
    const cookieStore = await cookies();
    // Only a signed token counts; a missing, forged, expired or legacy raw-id cookie is ignored.
    const executiveId = await verifyExecutiveToken(cookieStore.get(EXECUTIVE_COOKIE)?.value);

    if (executiveId) {
        const riders = await db.getRiders();
        return withoutPassword(riders.find(r => r.id === executiveId) || null);
    }

    // Try main session
    const session = await getSession();
    if (session?.user?.role === 'FIELD_EXECUTIVE') {
        const riders = await db.getRiders();
        
        // 1. Try to find user record to get phone
        const { prisma } = await import('@/lib/db');
        const prismaUser = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (prismaUser?.phone) {
            const executive = riders.find(r => r.phone === prismaUser.phone);
            if (executive) return withoutPassword(executive);
        }

        // 2. Fallback to ID match
        const executiveById = riders.find(r => r.id === session.user.id);
        if (executiveById) return withoutPassword(executiveById);
    }

    return null;
}

function withoutPassword<T extends { password?: string | null }>(rider: T | null): Omit<T, 'password'> | null {
    if (!rider) return null;
    const { password, ...rest } = rider;
    return rest;
}

export async function getExecutiveOrders() {
    const executive = await getExecutiveSession();
    if (!executive) return [];

    const allOrders = await db.getAllOrders();
    // Filter orders assigned to this executive
    return allOrders.filter(o => o.riderId === executive.id);
}

/** The signed-in executive and one of THEIR orders; anything else is refused. */
async function requireOwnOrder(orderId: string) {
    const executive = await getExecutiveSession();
    if (!executive) throw new Error('Unauthorized');
    const { prisma } = await import('@/lib/db');
    const order = typeof orderId === 'string' && orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
    if (!order || order.riderId !== executive.id) throw new Error('Forbidden: Not your order');
    const actor: Actor = { role: 'FIELD_EXECUTIVE', id: executive.id, name: executive.name };
    return { executive, order, actor };
}

function revalidateOrderPages() {
    revalidatePath('/pickup/dashboard');
    revalidatePath('/admin/orders');
    revalidatePath('/orders');
}

// The executive's own status changes: fail an open pickup, confirm a pickup at the current (quoted or approved)
// price, or report the device delivered to the hub. A changed price goes through submitVerification instead.
export async function updateOrderStatus(orderId: string, status: string, reason?: string) {
    const { order, actor } = await requireOwnOrder(orderId);

    if (status === 'failed') await failOrder(order, actor, reason || 'Handled by executive');
    else if (status === 'picked_up') await confirmPickup(order);
    else if (status === 'completed') await completeAtHub(order);
    else throw new Error('Invalid: Status');

    revalidateOrderPages();
    return { success: true };
}

// Verification result. Decline: the order fails. Pickup at the quoted price: picked up. Pickup at another price:
// the order waits for approval (status pending_verification) — the device may not be collected until it is approved.
export async function submitVerification(orderId: string, payload: { riderAnswers: any, verificationImages: string[], offeredPrice: number, status?: string }) {
    const { order, actor } = await requireOwnOrder(orderId);

    if (payload?.status === 'failed') {
        await failOrder(order, actor, payload.riderAnswers?.notes || 'Verification declined by executive');
        const { prisma } = await import('@/lib/db');
        await prisma.order.update({
            where: { id: order.id },
            data: {
                riderAnswers: JSON.stringify(payload.riderAnswers ?? null),
                verificationImages: Array.isArray(payload.verificationImages) ? payload.verificationImages.filter(i => typeof i === 'string') : [],
                offeredPrice: Number.isFinite(Number(payload.offeredPrice)) ? Math.round(Number(payload.offeredPrice)) : null,
            },
        });
        revalidateOrderPages();
        return { success: true, status: 'failed' };
    }

    const result = await submitPickup(order, {
        price: payload?.offeredPrice,
        riderAnswers: payload?.riderAnswers,
        images: payload?.verificationImages,
        updatedAnswers: payload?.riderAnswers?.answers,
    });
    revalidateOrderPages();
    return { success: true, status: result.status };
}

// The executive paid the customer (cash at the door, or a gift card / UPI / bank transfer they sent).
export async function markPayoutPaidByExecutive(orderId: string, reference?: string) {
    const { order, actor } = await requireOwnOrder(orderId);
    const payout = await markPayoutPaid(order, actor, reference);
    revalidateOrderPages();
    return { success: true, payout };
}
