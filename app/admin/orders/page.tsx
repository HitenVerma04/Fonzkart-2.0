import { db } from "@/lib/store";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import OrderManager, { type OrderPermissions } from "@/components/admin/OrderManager";
import RiderOrderList from "@/components/admin/RiderOrderList";
import { withoutSecrets } from '@/lib/safe-records';
import { getCurrentStaff } from '@/lib/staff-access';
import {
    BULK_ORDER_STAFF, ORDER_DELETERS, ORDER_STAFF, PARTNER_ROUTERS, PRICE_APPROVERS, canRouteTo, orderInScope, orderScopeFor,
} from '@/lib/order-access';

export const dynamic = 'force-dynamic';

export default async function OrdersPage(props: { searchParams?: Promise<{ riderId?: string }> }) {
    const searchParams = await props.searchParams;
    const filterRiderId = searchParams?.riderId;

    const session = await getSession();
    if (!session || !session.user) redirect('/login');

    const currentUser: any = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { managedCities: true }
    });
    const staff = await getCurrentStaff();

    if (!currentUser || !staff) redirect('/login');

    let orders = await db.getAllOrders();

    if (staff.role === 'FIELD_EXECUTIVE') {
        const rider = await prisma.rider.findFirst({
            where: { phone: currentUser.phone || '' }
        });
        orders = rider ? orders.filter(o => o.riderId === rider.id) : [];
        return <RiderOrderList orders={orders} executiveName={currentUser.name} isEmbedded={true} />;
    }

    // Who sees which orders, executives and partners: lib/order-access.ts.
    const scope = await orderScopeFor(staff);
    orders = orders.filter(o => orderInScope(scope, o));
    if (filterRiderId) {
        orders = orders.filter(o => o.riderId === filterRiderId);
    }

    const riders = await prisma.rider.findMany({
        where: scope.all ? {} : { partnerId: { in: scope.partnerIds } },
        include: { partner: { select: { name: true, pincodes: true } } },
        orderBy: { name: 'asc' },
    });

    const referencedPartnerIds = orders.map(o => o.partnerId).filter((id): id is string => !!id);
    const partners = (await prisma.user.findMany({
        where: {
            role: 'PARTNER',
            ...(scope.all ? {} : { id: { in: [...new Set([...scope.partnerIds, ...referencedPartnerIds])] } }),
        },
        select: { id: true, name: true, phone: true, email: true, pincodes: true, relationshipManager: { select: { name: true, phone: true } } },
        orderBy: { name: 'asc' },
    })).map(p => ({ ...p, routable: canRouteTo(scope, p.id) }));

    const permissions: OrderPermissions = {
        assignPartner: PARTNER_ROUTERS.includes(staff.role),
        assignRider: ORDER_STAFF.includes(staff.role),
        approvePrice: PRICE_APPROVERS.includes(staff.role),
        manage: ORDER_STAFF.includes(staff.role),
        bulk: BULK_ORDER_STAFF.includes(staff.role),
        delete: ORDER_DELETERS.includes(staff.role),
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent uppercase">
                {filterRiderId ? `Orders for Field Executive` : `Manage Orders`}
            </h1>
            {staff.role === 'ZONAL_HEAD' && (
                <p className="text-muted-foreground text-sm font-medium text-primary">
                    Territory Overview: {currentUser.managedCities.map((c: any) => c.name).join(', ') || 'Unassigned'}
                </p>
            )}
            {staff.role === 'RELATIONSHIP_MANAGER' && (
                <p className="text-muted-foreground text-sm font-medium text-primary">
                    Your partners: {partners.filter(p => p.routable).map(p => p.name).join(', ') || 'None assigned yet'} — plus new orders not yet routed to a partner.
                </p>
            )}
            {staff.role === 'PARTNER' && <p className="text-muted-foreground text-sm font-medium text-emerald-600">Assigned Pincodes: {currentUser.pincodes?.join(', ') || 'None'}</p>}
            <p className="text-muted-foreground">
                View incoming sell requests, route them to partners and assign field executives for pickup.
            </p>
            <OrderManager
                initialOrders={orders}
                riders={withoutSecrets(riders)}
                partners={partners}
                permissions={permissions}
                userRole={staff.role}
            />
        </div>
    );
}
