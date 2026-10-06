import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import CityCard from '@/components/admin/CityCard';
import { CITY_ADMIN_ROLES, CITY_STAFF, hasStaffRole, requireStaffRole } from '@/lib/staff-access';
import { withoutSecrets } from '@/lib/safe-records';

export const dynamic = 'force-dynamic';

export default async function CitiesAdminPage() {
    const session = await getSession();
    if (!session || !session.user) redirect('/login');
    // The sidebar offers the Cities workspace to administrators and zonal heads only.
    if (!(await hasStaffRole(CITY_STAFF))) redirect('/admin');

    const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    const isZonalHead = currentUser?.role === 'ZONAL_HEAD';

    const defaultCities = ['Madurai', 'Chennai', 'Coimbatore', 'Bangalore'];

    // Auto-seed default cities and their full master pincode lists if they don't exist/are empty
    if (!isZonalHead) {
        for (const city of defaultCities) {
            let defaultPincodes: string[] = [];
            if (city === 'Bangalore') {
                defaultPincodes = Array.from({ length: 110 }, (_, i) => `560${String(i + 1).padStart(3, '0')}`);
            } else if (city === 'Chennai') {
                defaultPincodes = Array.from({ length: 130 }, (_, i) => `600${String(i + 1).padStart(3, '0')}`);
            } else if (city === 'Coimbatore') {
                defaultPincodes = Array.from({ length: 60 }, (_, i) => `641${String(i + 1).padStart(3, '0')}`);
            } else if (city === 'Madurai') {
                defaultPincodes = Array.from({ length: 25 }, (_, i) => `625${String(i + 1).padStart(3, '0')}`);
            }

            const existingCity = await prisma.city.findUnique({ where: { name: city } });
            if (!existingCity) {
                await prisma.city.create({
                    data: { name: city, isActive: true, pincodes: defaultPincodes }
                });
            } else if (existingCity.pincodes.length === 0) {
                await prisma.city.update({
                    where: { id: existingCity.id },
                    data: { pincodes: defaultPincodes }
                });
            }
        }
    }

    const cities = await prisma.city.findMany({
        where: isZonalHead && currentUser?.cityId ? { id: currentUser.cityId } : {},
        include: {
            users: true
        },
        orderBy: { name: 'asc' }
    });

    return (
        <div className="space-y-8 w-full">
            <div className="flex flex-col gap-6 p-8 bg-slate-950 text-white rounded-[2rem] shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] -mr-32 -mt-32 rounded-full group-hover:bg-emerald-500/20 transition-all duration-700"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="max-w-xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                            Operational Control
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none mb-4">
                            Service <span className="text-emerald-500 underline decoration-8 decoration-emerald-500/20 underline-offset-8">Cities</span>
                        </h1>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed">
                            Expand Fonzkart's footprint. Register new operational hubs and manage the master pincode directory for each territory below.
                        </p>
                    </div>

                    <form action={async (data) => {
                        'use server';
                        // Server actions can be called directly, so check access here, not only in the layout.
                        await requireStaffRole([...CITY_ADMIN_ROLES, 'ZONAL_HEAD']);
                        const name = data.get('cityName') as string;
                        if (name) {
                            await prisma.city.upsert({
                                where: { name },
                                update: { isActive: true },
                                create: { name, isActive: true }
                            });
                            revalidatePath('/admin/cities');
                        }
                    }} className="relative z-10 flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <input
                                name="cityName"
                                required
                                placeholder="Enter City Name (e.g. Bangalore)"
                                className="w-full h-14 pl-5 pr-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all placeholder:text-slate-600"
                            />
                        </div>
                        <button type="submit" className="h-14 px-8 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20">
                            Register Hub
                        </button>
                    </form>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-8">
                {cities.map(city => {
                    const zonalHeads = city.users.filter(u => u.role === 'ZONAL_HEAD');
                    const partners = city.users.filter(u => u.role === 'PARTNER');

                    return (
                        <CityCard 
                            key={city.id} 
                            city={withoutSecrets(city)} 
                            partners={withoutSecrets(partners)} 
                            zonalHeads={withoutSecrets(zonalHeads)} 
                            isZonalHead={isZonalHead} 
                        />
                    );
                })}
            </div>
        </div>
    );
}
