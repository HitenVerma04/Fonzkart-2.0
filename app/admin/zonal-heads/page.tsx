import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { X, Users, MapPin } from 'lucide-react';
import { getSession } from '@/lib/session';
import { isAdmin } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';
import { addZonalHead } from '@/actions/admin';
import ZonalHeadUpgradeForm from '@/components/admin/ZonalHeadUpgradeForm';
import { ADMINS, hasStaffRole, requireStaffRole } from '@/lib/staff-access';

export const dynamic = 'force-dynamic';

export default async function ZonalHeadsPage() {
    const session = await getSession();
    if (!session || !session.user || !isAdmin(session.user)) {
        redirect('/');
    }
    // Managing zonal heads is for administrators (the sidebar shows this page to SUPER_ADMIN and ADMIN only).
    if (!(await hasStaffRole(ADMINS))) redirect('/admin');

    const zonalHeads = await prisma.user.findMany({
        where: { role: 'ZONAL_HEAD' },
        include: { 
            managedCities: true,
            managedUsers: {
                where: { role: 'PARTNER' },
                include: { city: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    const allCities = await prisma.city.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
    });

    return (
        <div className="space-y-8 w-full">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Zonal Heads</h1>
                    <p className="text-muted-foreground mt-2">Manage area directors and assign them to multiple service cities.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Create Form */}
                <div className="lg:col-span-1">
                    <div className="bg-card border rounded-xl p-6 shadow-sm sticky top-6">
                        <h2 className="text-xl font-bold mb-6">Register Zonal Head</h2>
                        <form action={async (data) => {
                            'use server';
                            await requireStaffRole(ADMINS);
                            const name = data.get('name') as string;
                            const email = data.get('email') as string;
                            const phone = data.get('phone') as string;
                            const password = data.get('password') as string;

                            if (name && email && password) {
                                const passwordHash = await bcrypt.hash(password, 10);
                                await prisma.user.create({
                                    data: {
                                        name,
                                        email,
                                        phone,
                                        passwordHash,
                                        role: 'ZONAL_HEAD'
                                    }
                                });
                                revalidatePath('/admin/zonal-heads');
                            }
                        }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Full Name</label>
                                <input name="name" required className="w-full h-10 px-3 rounded-md border text-sm outline-none focus:border-primary bg-background" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email Address</label>
                                <input name="email" type="email" required className="w-full h-10 px-3 rounded-md border text-sm outline-none focus:border-primary bg-background" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Phone Number</label>
                                <input name="phone" required className="w-full h-10 px-3 rounded-md border text-sm outline-none focus:border-primary bg-background" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Temporary Password</label>
                                <input name="password" type="password" required className="w-full h-10 px-3 rounded-md border text-sm outline-none focus:border-primary bg-background" />
                            </div>
                            <button type="submit" className="w-full h-10 mt-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
                                Create New Zonal Head
                            </button>
                        </form>

                        <ZonalHeadUpgradeForm />
                    </div>
                </div>

                {/* List View */}
                <div className="lg:col-span-2 space-y-4">
                    {zonalHeads.length === 0 ? (
                        <div className="bg-card border border-dashed rounded-xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                            <h3 className="text-lg font-medium text-foreground mb-1">No Zonal Heads Found</h3>
                            <p className="text-sm">Use the form to register directors and assign them to territories.</p>
                        </div>
                    ) : zonalHeads.map((zh: any) => (
                        <div key={zh.id} className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-lg font-bold">{zh.name}</h3>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                                            Zonal Head
                                        </span>
                                    </div>
                                    <div className="text-sm text-muted-foreground flex items-center gap-3">
                                        <span>{zh.email}</span>
                                        <span>•</span>
                                        <span>{zh.phone}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <div className="text-lg font-black text-foreground">{zh.managedCities.length}</div>
                                        <div className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Cities</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-black text-emerald-600">{zh.managedUsers.length}</div>
                                        <div className="text-[9px] text-muted-foreground uppercase font-black tracking-widest text-emerald-600">Partners</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Cities Management */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                                        <MapPin className="w-3 h-3" /> Territorial Control
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {zh.managedCities.length === 0 ? (
                                            <p className="text-[11px] text-muted-foreground italic">No cities assigned.</p>
                                        ) : (
                                            zh.managedCities.map((city: any) => (
                                                <div key={city.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
                                                    {city.name}
                                                    <form action={async () => {
                                                        'use server';
                                                        await requireStaffRole(ADMINS);
                                                        await prisma.city.update({
                                                            where: { id: city.id },
                                                            data: { managerId: null }
                                                        });
                                                        revalidatePath('/admin/zonal-heads');
                                                    }}>
                                                        <button type="submit" className="text-slate-400 hover:text-red-500 transition-colors">
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </form>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <form action={async (data) => {
                                        'use server';
                                        await requireStaffRole(ADMINS);
                                        const cityId = data.get('cityId') as string;
                                        if (cityId) {
                                            await prisma.city.update({
                                                where: { id: cityId },
                                                data: { managerId: zh.id }
                                            });
                                            revalidatePath('/admin/zonal-heads');
                                        }
                                    }} className="flex gap-2">
                                        <select name="cityId" className="flex-1 h-8 px-2 rounded-md border text-[11px] outline-none focus:border-primary bg-background">
                                            <option value="">Add city...</option>
                                            {allCities.filter((c: any) => c.managerId !== zh.id).map((city: any) => (
                                                <option key={city.id} value={city.id}>{city.name}</option>
                                            ))}
                                        </select>
                                        <button type="submit" className="h-8 px-3 bg-primary text-primary-foreground rounded-md text-[10px] font-bold uppercase transition-all hover:scale-105 active:scale-95 shrink-0">
                                            Assign
                                        </button>
                                    </form>
                                </div>

                                {/* Partners Display */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black uppercase text-emerald-400 tracking-[0.2em] flex items-center gap-2">
                                        <Users className="w-3 h-3" /> Managed Partners
                                    </h4>
                                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                                        {zh.managedUsers.length === 0 ? (
                                            <p className="text-[11px] text-muted-foreground italic">No partners assigned to this head.</p>
                                        ) : (
                                            zh.managedUsers.map((partner: any) => (
                                                <div key={partner.id} className="flex items-center justify-between p-2 bg-emerald-50/50 rounded-lg border border-emerald-100 group transition-all hover:bg-emerald-50">
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-bold text-slate-800 truncate">{partner.name}</p>
                                                        <p className="text-[9px] text-emerald-600 font-bold">{partner.city?.name || 'Remote'}</p>
                                                    </div>
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
