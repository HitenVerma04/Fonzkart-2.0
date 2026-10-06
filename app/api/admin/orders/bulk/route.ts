import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaffRole } from '@/lib/staff-access';
import { BULK_ORDER_STAFF, FORBIDDEN_ORDER, ORDER_DELETERS, httpStatusFor, orderInScope, orderScopeFor } from '@/lib/order-access';
import * as orderWorkflow from '@/lib/order-workflow';

// Bulk actions from the admin panel's order lists. Every selected order must be one the caller may act on, or
// nothing is changed. Orders whose status does not allow the action (e.g. restoring an order that is not failed)
// are skipped; `count` is the number actually changed.
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { action, ids, reason } = body ?? {};

        if (!ids || !Array.isArray(ids) || ids.length === 0 || !ids.every((i: unknown) => typeof i === 'string')) {
            return new NextResponse('No IDs provided', { status: 400 });
        }

        const staff = await requireStaffRole(action === 'bulk_delete' ? ORDER_DELETERS : BULK_ORDER_STAFF);
        const scope = await orderScopeFor(staff);
        const orders = await prisma.order.findMany({ where: { id: { in: ids } } });
        if (orders.some(o => !orderInScope(scope, o))) throw new Error(FORBIDDEN_ORDER);
        const actor = await orderWorkflow.staffActor(staff);

        const apply = async (change: (order: (typeof orders)[number]) => Promise<unknown>) => {
            let count = 0;
            for (const order of orders) {
                try {
                    await change(order);
                    count++;
                } catch (e) {
                    if (httpStatusFor(e) !== 400) throw e; // not possible in this order's status: skip it
                }
            }
            return NextResponse.json({ success: true, count });
        };

        if (action === 'bulk_fail') return apply(o => orderWorkflow.failOrder(o, actor, reason || 'Bulk failure'));
        if (action === 'bulk_restore') return apply(o => orderWorkflow.restoreOrder(o, actor));
        if (action === 'bulk_hub_handover') return apply(o => orderWorkflow.setHubStatus(o, actor, body.hubStatus || 'handed_over'));
        if (action === 'bulk_delete') {
            const { count } = await prisma.order.deleteMany({ where: { id: { in: orders.map(o => o.id) } } });
            return NextResponse.json({ success: true, count });
        }

        return new NextResponse('Invalid action', { status: 400 });
    } catch (error: any) {
        const status = httpStatusFor(error);
        if (status === 500) {
            console.error('Bulk Order API error:', error);
            return new NextResponse('Internal error', { status });
        }
        return new NextResponse(error.message, { status });
    }
}
