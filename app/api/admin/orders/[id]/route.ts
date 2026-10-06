import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ORDER_DELETERS, ORDER_STAFF, PRICE_APPROVERS, httpStatusFor, requireOrderAccess } from '@/lib/order-access';
import * as orderWorkflow from '@/lib/order-workflow';

// Single-order actions from the admin panel. Who may act on which order: lib/order-access.ts (the order must be one
// the caller sees on the Orders page); what each action does: lib/order-workflow.ts.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => ({}));
        const { action } = body ?? {};

        if (action === 'approve_verification' || action === 'reject_verification') {
            const ctx = await requireOrderAccess(id, PRICE_APPROVERS);
            const result = await orderWorkflow.decidePrice(ctx, action === 'approve_verification',
                { overridePrice: body.overridePrice, reason: body.reason });
            return NextResponse.json({ success: true, ...result });
        }
        if (action === 'fail_order') {
            const { order, staff } = await requireOrderAccess(id, ORDER_STAFF);
            await orderWorkflow.failOrder(order, await orderWorkflow.staffActor(staff), body.reason);
            return NextResponse.json({ success: true });
        }
        if (action === 'restore_order') {
            const { order, staff } = await requireOrderAccess(id, ORDER_STAFF);
            const status = await orderWorkflow.restoreOrder(order, await orderWorkflow.staffActor(staff));
            return NextResponse.json({ success: true, status });
        }
        if (action === 'update_hub_status') {
            const { order, staff } = await requireOrderAccess(id, ORDER_STAFF);
            const hubStatus = await orderWorkflow.setHubStatus(order, await orderWorkflow.staffActor(staff), body.hubStatus);
            return NextResponse.json({ success: true, hubStatus });
        }
        if (action === 'mark_payout_paid') {
            const { order, staff } = await requireOrderAccess(id, ORDER_STAFF);
            const payout = await orderWorkflow.markPayoutPaid(order, await orderWorkflow.staffActor(staff), body.reference);
            return NextResponse.json({ success: true, payout });
        }
        if (action === 'delete_order') {
            await requireOrderAccess(id, ORDER_DELETERS);
            await prisma.order.delete({ where: { id } });
            return NextResponse.json({ success: true });
        }

        return new NextResponse('Invalid action', { status: 400 });
    } catch (error: any) {
        return errorResponse('Order API error:', error);
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        await requireOrderAccess(id, ORDER_DELETERS);
        await prisma.order.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return errorResponse('Delete order error:', error);
    }
}

function errorResponse(label: string, error: unknown) {
    const status = httpStatusFor(error);
    if (status === 500) {
        console.error(label, error);
        return new NextResponse('Internal error', { status });
    }
    return new NextResponse((error as Error).message, { status });
}
