import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/staff-access";
import { ORDER_STAFF, orderInScope, orderScopeFor } from "@/lib/order-access";

// Open orders without an executive, for the admin panel's "new order waiting" buzzer: counted among the orders the
// caller sees on the Orders page (lib/order-access.ts), so a zonal head is buzzed for their own territory only.
export async function GET() {
    try {
        const staff = await getCurrentStaff();
        if (!staff) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!ORDER_STAFF.includes(staff.role)) {
            return NextResponse.json({ count: 0 });
        }

        const [scope, orders] = await Promise.all([
            orderScopeFor(staff),
            prisma.order.findMany({
                where: {
                    riderId: null,
                    status: { notIn: ['completed', 'failed'] }
                },
                select: { partnerId: true, pincode: true, address: true }
            }),
        ]);

        return NextResponse.json({ count: orders.filter(o => orderInScope(scope, o)).length });
    } catch (error) {
        console.error("Unassigned count API error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
