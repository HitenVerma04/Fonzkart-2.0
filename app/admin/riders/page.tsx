
import { prisma } from '@/lib/db';
import RiderManager from "@/components/admin/RiderManager";
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { withoutSecrets } from '@/lib/safe-records';

export const dynamic = 'force-dynamic';

export default async function RidersPage() {
    const session = await getSession();
    if (!session || !['SUPER_ADMIN', 'ADMIN', 'ZONAL_HEAD', 'PARTNER'].includes(session.user?.role || '')) {
        redirect('/admin');
    }

    const currentUser: any = await prisma.user.findUnique({ 
        where: { id: session.user.id },
        include: { managedCities: true }
    });
    if (!currentUser) redirect('/admin');

    let partners: any[] = [];
    let riders: any[] = [];

    if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN') {
        partners = await prisma.user.findMany({ where: { role: 'PARTNER' } });
        riders = await prisma.rider.findMany({
            include: { partner: true, orders: true },
            orderBy: { createdAt: 'desc' }
        });
    } else if (currentUser.role === 'ZONAL_HEAD') {
        const managedCityIds = (currentUser.managedCities || []).map((c: any) => c.id);
        partners = await prisma.user.findMany({
            where: { 
                role: 'PARTNER', 
                OR: [
                    { cityId: { in: managedCityIds } },
                    { managerId: currentUser.id }
                ]
            }
        });
        const partnerIds = partners.map(p => p.id);
        riders = await prisma.rider.findMany({
            where: { partnerId: { in: partnerIds } },
            include: { partner: true, orders: true },
            orderBy: { createdAt: 'desc' }
        });
    } else if (currentUser.role === 'PARTNER') {
        partners = [currentUser];
        riders = await prisma.rider.findMany({
            where: { partnerId: currentUser.id },
            include: { partner: true, orders: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Manage Field Executives</h1>
            <p className="text-muted-foreground">Add logistics partners and field executives.</p>
            <RiderManager initialRiders={withoutSecrets(riders)} partners={withoutSecrets(partners)} currentUserRole={currentUser.role} currentUserId={currentUser.id} />
        </div>
    );
}
