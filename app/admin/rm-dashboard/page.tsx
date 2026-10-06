import { db } from "@/lib/store";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Clock, CheckCircle2, User, Building2, Package, Search } from "lucide-react";
import RMPartnerView from "@/components/admin/RMPartnerView";
import { withoutSecrets } from '@/lib/safe-records';

export const dynamic = 'force-dynamic';

export default async function RMDashboard() {
    const session = await getSession();
    if (!session || !session.user || session.user.role !== 'RELATIONSHIP_MANAGER') {
        redirect('/login');
    }

    // Only this RM's partners ("User"."relationshipManagerId"), as on the Orders page (lib/order-access.ts).
    const partners = await prisma.user.findMany({
        where: { role: 'PARTNER', relationshipManagerId: session.user.id },
        include: {
            riders: true,
            manager: true,
            city: true
        },
        orderBy: { name: 'asc' }
    });

    const allOrders = await db.getAllOrders();
    const now = new Date();

    // An order belongs to the partner it is routed to; an order from before routing existed (no partnerId) to the
    // partner covering its pincode or owning its executive.
    const partnersWithData = partners.map(partner => {
        const partnerPincodes = partner.pincodes || [];
        const partnerOrders = allOrders.filter(o => o.partnerId
            ? o.partnerId === partner.id
            : (!!o.pincode && partnerPincodes.includes(o.pincode)) ||
              (!!o.riderId && partner.riders.some(r => r.id === o.riderId))
        );

        const unassignedOrders = partnerOrders.filter(o => !o.riderId && o.status !== 'Completed' && o.status !== 'Cancelled');
        const assignedOrders = partnerOrders.filter(o => !!o.riderId);
        
        // Orders delayed by > 5 minutes
        const delayedOrders = unassignedOrders.filter(o => {
            const diffMinutes = (now.getTime() - new Date(o.date).getTime()) / 1000 / 60;
            return diffMinutes >= 5;
        });

        return {
            ...partner,
            orders: partnerOrders,
            unassignedOrders,
            assignedOrders,
            delayedOrders,
        };
    });

    const totalDelayed = partnersWithData.reduce((acc, p) => acc + p.delayedOrders.length, 0);

    return (
        <div className="space-y-8 w-full max-w-7xl mx-auto">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Relationship Manager Dashboard</h1>
                    <p className="text-muted-foreground mt-2">Your partners, their executives and order assignments. Route and assign orders on the Orders page.</p>
                </div>
            </div>

            {totalDelayed > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-destructive">Action Required: Delayed Assignments</h3>
                        <p className="text-sm text-destructive/80 mt-1">
                            {totalDelayed} order(s) have been waiting for executive assignment for more than 5 minutes. 
                            Please follow up with the respective partners.
                        </p>
                    </div>
                </div>
            )}

            <RMPartnerView partners={withoutSecrets(partnersWithData)} />
        </div>
    );
}
