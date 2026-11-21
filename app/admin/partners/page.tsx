import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { addPartner } from '@/actions/admin';

import PartnerUpgradeForm from '@/components/admin/PartnerUpgradeForm';
import { PARTNER_MANAGERS, hasStaffRole, requireStaffRole } from '@/lib/staff-access';
import { backendRequest, formFields, usesApi } from '@/lib/backend';
import PartnerCitiesPicker from '@/components/admin/PartnerCitiesPicker';
import { extraCityIds, mergeCities, partnerIdsInExtraCities, savePartnerCities } from '@/lib/partner-cities';

export const dynamic = 'force-dynamic';

export default async function PartnersPage() {
    const session = await getSession();
    if (!session || !session.user) redirect('/login');

    const currentUser: any = await prisma.user.findUnique({ 
        where: { id: session.user.id },
        include: { managedCities: true }
    });
    if (!currentUser) redirect('/login');
    // The sidebar offers this page to administrators, zonal heads and relationship managers only.
    if (!(await hasStaffRole(PARTNER_MANAGERS))) redirect('/admin');

    const isZonalHead = currentUser.role === 'ZONAL_HEAD';
    // A relationship manager's partners are their own: an RM registers partners under themselves and cannot move
    // partners between RMs. Administrators and zonal heads choose each partner's RM.
    const isRelationshipManager = currentUser.role === 'RELATIONSHIP_MANAGER';
    const managedCityIds = isZonalHead ? (currentUser.managedCities || []).map((c: any) => c.id) : [];
    // Partners serving one of the zonal head's cities as an extra city are theirs to see too.
    const extraPartnerIds = isZonalHead ? await partnerIdsInExtraCities(managedCityIds) : [];

    const partners = await prisma.user.findMany({
        where: {
            role: 'PARTNER',
            ...(isZonalHead ? {
                OR: [
                    { cityId: { in: managedCityIds } },
                    { managerId: currentUser.id },
                    { id: { in: extraPartnerIds } }
                ]
            } : {})
        },
        include: { 
            city: true,
            manager: true,
            relationshipManager: true
        },
        orderBy: { name: 'asc' }
    });

    const zonalHeads = await prisma.user.findMany({
        where: { role: 'ZONAL_HEAD' },
        orderBy: { name: 'asc' }
    });

    const relationshipManagers = await prisma.user.findMany({
        where: { role: 'RELATIONSHIP_MANAGER' },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' }
    });
    const rmIds = relationshipManagers.map(rm => rm.id);

    const availableCities = await prisma.city.findMany({
        where: {
            isActive: true,
            ...(isZonalHead ? { id: { in: managedCityIds } } : {})
        },
        orderBy: { name: 'asc' }
    });

    // Every city each partner serves (main first), for the cards and the city pickers.
    const extras = await extraCityIds(partners.map(p => p.id));
    const allCities = await prisma.city.findMany({ orderBy: { name: 'asc' } });
    const cityById = new Map(allCities.map(c => [c.id, c]));
    const citiesOf = (p: { id: string; cityId: string | null }) =>
        mergeCities(p.cityId, extras.get(p.id) ?? []).map(id => cityById.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
    const pickerCities = availableCities.map(c => ({ id: c.id, name: c.name, pincodes: c.pincodes }));

    return (
        <div className="space-y-8 w-full">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Partners</h1>
                    <p className="text-muted-foreground mt-2">Manage partners who manage local field executives (riders).</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Create Form */}
                <div className="lg:col-span-1">
                    <div className="bg-card border rounded-xl p-6 shadow-sm sticky top-6">
                        <h2 className="text-xl font-bold mb-6">Register Partner</h2>
                        <form action={async (data) => {
                            'use server';
                            // Several cities: the picker posts cityIds (main first) and mainCityId.
                            const chosenCityIds = data.getAll('cityIds').map(String).filter(Boolean);
                            const mainCity = (data.get('mainCityId') as string) || chosenCityIds[0] || '';
                            if (usesApi('STAFF')) {
                                await backendRequest('POST', '/api/staff/partners', { body: {
                                    ...formFields(data, 'name', 'email', 'phone', 'password', 'managerId', 'relationshipManagerId'),
                                    cityId: mainCity, cityIds: chosenCityIds,
                                } });
                                revalidatePath('/admin/partners');
                                revalidatePath('/admin/cities');
                                return;
                            }
                            const actor = await requireStaffRole(PARTNER_MANAGERS);
                            // Decided by who submits, not by who rendered the form.
                            const actorIsRm = actor.role === 'RELATIONSHIP_MANAGER';
                            const name = data.get('name') as string;
                            const email = data.get('email') as string;
                            const phone = data.get('phone') as string;
                            const password = data.get('password') as string;
                            const cityId = mainCity;
                            const managerId = data.get('managerId') as string;
                            const rmId = data.get('relationshipManagerId') as string;

                            if (name && email && password) {
                                const passwordHash = await bcrypt.hash(password, 10);

                                const finalCityId = isZonalHead
                                    ? (managedCityIds.includes(cityId) ? cityId : null)
                                    : (cityId || null);

                                if (isZonalHead && !finalCityId) return;

                                // If Zonal Head creates, they are the manager. If Admin creates, they can pick.
                                const finalManagerId = isZonalHead 
                                    ? currentUser.id 
                                    : (managerId === 'none' ? null : managerId);

                                const created = await prisma.user.create({
                                    data: {
                                        name,
                                        email,
                                        phone,
                                        passwordHash,
                                        role: 'PARTNER',
                                        cityId: finalCityId,
                                        managerId: finalManagerId,
                                        relationshipManagerId: actorIsRm
                                            ? actor.id
                                            : (rmIds.includes(rmId) ? rmId : null)
                                    }
                                });
                                // The other chosen cities (a zonal head: only their own).
                                const others = chosenCityIds.filter(id => id !== finalCityId && (!isZonalHead || managedCityIds.includes(id)));
                                if (others.length) await savePartnerCities({ partnerId: created.id, requested: [finalCityId, ...others].filter((x): x is string => !!x), mainCityId: finalCityId, managedCityIds: null }).catch(() => undefined);
                                revalidatePath('/admin/partners');
                                revalidatePath('/admin/cities');
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
                            <div>
                                <label className="block text-sm font-medium mb-1">Cities (tick every city they serve; ★ is the main city)</label>
                                <PartnerCitiesPicker cities={pickerCities} />
                            </div>
                            {!isZonalHead && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Assign Zonal Head (Manager)</label>
                                    <select name="managerId" className="w-full h-10 px-3 rounded-md border text-sm outline-none focus:border-primary bg-background">
                                        <option value="none">None (Independent)</option>
                                        {zonalHeads.map(zh => (
                                            <option key={zh.id} value={zh.id}>{zh.name} ({zh.email})</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {!isRelationshipManager && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Relationship Manager</label>
                                    <select name="relationshipManagerId" className="w-full h-10 px-3 rounded-md border text-sm outline-none focus:border-primary bg-background">
                                        <option value="none">None</option>
                                        {relationshipManagers.map(rm => (
                                            <option key={rm.id} value={rm.id}>{rm.name} ({rm.email})</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <button type="submit" className="w-full h-10 mt-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
                                Create New Partner
                            </button>
                        </form>

                        <PartnerUpgradeForm cities={availableCities} />
                    </div>
                </div>

                {/* List View */}
                <div className="lg:col-span-2 space-y-4">
                    {partners.length === 0 ? (
                        <div className="bg-card border border-dashed rounded-xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                            <h3 className="text-lg font-medium text-foreground mb-1">No Partners Found</h3>
                            <p className="text-sm">Use the form to register new partners.</p>
                        </div>
                    ) : partners.map(p => (
                        <div key={p.id} className="bg-card border rounded-xl p-6 shadow-sm flex flex-col gap-6 w-full overflow-hidden">
                            <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                                <div className="shrink-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-lg font-bold truncate max-w-[200px] sm:max-w-[300px]">{p.name}</h3>
                                        <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary uppercase tracking-wider">
                                            Partner
                                        </span>
                                    </div>
                                    <div className="text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                        <span className="truncate max-w-[200px] sm:max-w-none">{p.email}</span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="truncate">{p.phone}</span>
                                    </div>
                                    {p.relationshipManager && (
                                        <div className="mt-2 mr-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-black uppercase tracking-tighter shadow-sm">
                                            RM: {p.relationshipManager.name}
                                        </div>
                                    )}
                                    {p.manager && (
                                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-black uppercase tracking-tighter shadow-sm">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                            Managed by: {p.manager.name}
                                        </div>
                                    )}
                                </div>

                                <div className="w-full xl:w-auto flex-1 min-w-0 space-y-3">
                                    {/* Every city this partner is responsible for. */}
                                    <form action={async (data) => {
                                        'use server';
                                        const cityIds = data.getAll('cityIds').map(String).filter(Boolean);
                                        const mainCityId = (data.get('mainCityId') as string) || undefined;
                                        if (usesApi('STAFF')) {
                                            await backendRequest('PUT', `/api/staff/partners/${encodeURIComponent(p.id)}/cities`, { body: { cityIds, mainCityId } });
                                        } else {
                                            await requireStaffRole(PARTNER_MANAGERS);
                                            await savePartnerCities({ partnerId: p.id, requested: cityIds, mainCityId, managedCityIds: isZonalHead ? managedCityIds : null });
                                        }
                                        revalidatePath('/admin/partners');
                                        revalidatePath('/admin/cities');
                                    }} className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cities ({citiesOf(p).length})</span>
                                            <button type="submit" className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Save cities</button>
                                        </div>
                                        <PartnerCitiesPicker compact cities={pickerCities}
                                            initial={citiesOf(p).map(c => c.id)} initialMain={p.cityId}
                                            locked={citiesOf(p).filter(c => !availableCities.some(a => a.id === c.id)).map(c => ({ id: c.id, name: c.name }))} />
                                        <p className="mt-2 text-[11px] text-muted-foreground">Pincodes of a city you take off leave the partner&apos;s service areas.</p>
                                    </form>
                                    <form action={async (data) => {
                                        'use server';
                                        if (usesApi('STAFF')) {
                                            await backendRequest('PUT', `/api/staff/partners/${encodeURIComponent(p.id)}/assignment`, {
                                                body: formFields(data, 'cityId', 'managerId', 'relationshipManagerId') });
                                            revalidatePath('/admin/partners');
                                            return;
                                        }
                                        const actor = await requireStaffRole(PARTNER_MANAGERS);
                                        // Decided by who submits, not by who rendered the form.
                                        const actorIsRm = actor.role === 'RELATIONSHIP_MANAGER';
                                        const newCityId = data.get('cityId') as string;
                                        const managerId = data.get('managerId') as string;
                                        const rmId = data.get('relationshipManagerId') as string;

                                        const finalCityId = isZonalHead
                                            ? (managedCityIds.includes(newCityId) ? newCityId : p.cityId)
                                            : (newCityId === 'none' ? null : newCityId);
                                        
                                        const finalManagerId = isZonalHead 
                                            ? p.managerId // Zonal heads cannot reassign managers
                                            : (managerId === 'none' ? null : managerId);

                                        await prisma.user.update({
                                            where: { id: p.id },
                                            data: {
                                                cityId: finalCityId,
                                                managerId: finalManagerId,
                                                relationshipManagerId: actorIsRm
                                                    ? p.relationshipManagerId // RMs cannot move partners between RMs
                                                    : (rmId === 'none' ? null : rmIds.includes(rmId) ? rmId : p.relationshipManagerId)
                                            }
                                        });
                                        revalidatePath('/admin/partners');
                                    }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-lg">
                                        {/* Cities are set in the block above; the main city stays as it is here. */}
                                        <input type="hidden" name="cityId" value={p.cityId || 'none'} />

                                        {!isZonalHead && (
                                            <div className="flex flex-col gap-1 shrink-0">
                                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Managed By</label>
                                                <select
                                                    name="managerId"
                                                    defaultValue={p.managerId || 'none'}
                                                    className="w-full h-9 px-3 rounded-md border text-sm outline-none focus:border-primary bg-background shrink-0"
                                                >
                                                    <option value="none" className="italic text-muted-foreground">No Zonal Head</option>
                                                    {zonalHeads.map(zh => (
                                                        <option key={zh.id} value={zh.id}>{zh.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {!isRelationshipManager && (
                                            <div className="flex flex-col gap-1 shrink-0">
                                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Relationship Manager</label>
                                                <select
                                                    name="relationshipManagerId"
                                                    defaultValue={p.relationshipManagerId || 'none'}
                                                    className="w-full h-9 px-3 rounded-md border text-sm outline-none focus:border-primary bg-background shrink-0"
                                                >
                                                    <option value="none" className="italic text-muted-foreground">No RM</option>
                                                    {relationshipManagers.map(rm => (
                                                        <option key={rm.id} value={rm.id}>{rm.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div className="md:col-span-2 lg:col-span-1 xl:col-span-1 flex flex-col justify-end">
                                            <div className="h-9 px-3 border border-dashed rounded-md bg-background/50 flex items-center text-xs text-muted-foreground">
                                                <span>Pincodes are managed in the <a href="/admin/cities" className="text-primary hover:underline font-semibold">Cities Workspace</a></span>
                                            </div>
                                        </div>
                                        
                                        <div className="md:col-span-2 lg:col-span-3 xl:col-span-3">
                                            <button type="submit" className="h-9 px-4 w-full bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 text-center">
                                                Save Partner Configuration
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
