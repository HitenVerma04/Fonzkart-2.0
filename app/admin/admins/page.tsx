import { prisma } from '@/lib/db';
import AdminManager from '@/components/admin/AdminManager';
import { SUPER_ADMIN_EMAILS } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export default async function AdminsPage() {
    const allUsers = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
    });

    const riders = await prisma.rider.findMany({
        orderBy: { createdAt: 'desc' }
    });

    const superAdmins = allUsers.filter(u => u.role === 'SUPER_ADMIN' || SUPER_ADMIN_EMAILS.includes(u.email.toLowerCase()));

    // Ensure all configured super admins appear even if not yet in database
    for (const email of SUPER_ADMIN_EMAILS) {
        if (!superAdmins.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            superAdmins.push({
                id: `superadmin-${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
                name: email === 'noumaanraihaan@gmail.com' ? 'Noumaan Raihaan' : email.split('@')[0],
                email: email,
                role: 'SUPER_ADMIN',
                createdAt: new Date(),
                updatedAt: new Date(),
                phone: null,
                cityId: null,
                pincodes: [],
                managerId: null,
                resetToken: null,
                resetTokenExpiry: null,
                passwordHash: ''
            } as any);
        }
    }

    const admins = allUsers.filter(u => u.role === 'ADMIN' && !SUPER_ADMIN_EMAILS.includes(u.email.toLowerCase()));
    const zonalHeads = allUsers.filter(u => u.role === 'ZONAL_HEAD' && !SUPER_ADMIN_EMAILS.includes(u.email.toLowerCase()));
    const relationshipManagers = allUsers.filter(u => u.role === 'RELATIONSHIP_MANAGER' && !SUPER_ADMIN_EMAILS.includes(u.email.toLowerCase()));
    const partners = allUsers.filter(u => u.role === 'PARTNER' && !SUPER_ADMIN_EMAILS.includes(u.email.toLowerCase()));
    
    // Combine native riders with users granted FIELD_EXECUTIVE privilege
    const fieldExecutiveUsers = allUsers.filter(u => u.role === 'FIELD_EXECUTIVE').map(u => ({
        id: u.id,
        name: u.name,
        phone: u.phone || u.email,
        status: 'available',
        partnerId: null
    }));
    
    const combinedRiders = [...riders, ...fieldExecutiveUsers];

    return (
        <div className="container mx-auto max-w-6xl w-full">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Role Management Directory</h1>
                <p className="text-muted-foreground">View system administrators, zonal heads, partners, and field executives.</p>
            </div>

            <AdminManager
                superAdmins={superAdmins}
                admins={admins}
                zonalHeads={zonalHeads}
                relationshipManagers={relationshipManagers}
                partners={partners}
                riders={combinedRiders}
            />
        </div>
    );
}
