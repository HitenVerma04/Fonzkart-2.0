// The cities a partner is responsible for, for the website's own database path (with USE_API_STAFF the backend does
// this: PartnerAdminService.updateCities). The main city stays in User.cityId; the others are PartnerCity rows, a
// table the backend creates on startup. Reads fail soft: without the table a partner has their main city only.
import { prisma } from '@/lib/db';

/** Each partner's extra cities (not the main one), oldest first. */
export async function extraCityIds(partnerIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (!partnerIds.length) return out;
    try {
        const rows = await prisma.partnerCity.findMany({ where: { partnerId: { in: partnerIds } }, orderBy: [{ createdAt: 'asc' }, { cityId: 'asc' }] });
        for (const r of rows) out.set(r.partnerId, [...(out.get(r.partnerId) ?? []), r.cityId]);
    } catch (e) {
        console.warn('PartnerCity could not be read:', e instanceof Error ? e.message : e);
    }
    return out;
}

/** Partners serving any of these cities as an extra city. */
export async function partnerIdsInExtraCities(cityIds: string[]): Promise<string[]> {
    if (!cityIds.length) return [];
    try {
        const rows = await prisma.partnerCity.findMany({ where: { cityId: { in: cityIds } }, select: { partnerId: true } });
        return [...new Set(rows.map(r => r.partnerId))];
    } catch {
        return [];
    }
}

/** Main city first, then the extras, without repeats. */
export function mergeCities(main: string | null | undefined, extras: string[]): string[] {
    return [...new Set([main, ...extras].filter((id): id is string => !!id))];
}

/**
 * Sets every city of a partner. A zonal head adds or removes only the cities they manage; the others stay. Pincodes the
 * partner served only because of a removed city leave their service areas.
 */
export async function savePartnerCities({ partnerId, requested, mainCityId, managedCityIds }: {
    partnerId: string;
    requested: string[];
    mainCityId?: string | null;
    /** Zonal heads: the cities they manage; administrators: null. */
    managedCityIds: string[] | null;
}): Promise<{ cityIds: string[]; removedPincodes: number }> {
    const partner = await prisma.user.findUnique({ where: { id: partnerId } });
    if (!partner || partner.role !== 'PARTNER') throw new Error('Partner not found.');
    const known = new Map((await prisma.city.findMany()).map(c => [c.id, c]));
    const wanted = [...new Set(requested)].filter(id => known.has(id));
    const current = mergeCities(partner.cityId, (await extraCityIds([partnerId])).get(partnerId) ?? []);

    let next: string[];
    if (managedCityIds) {
        const mine = new Set(managedCityIds);
        next = [...current.filter(id => !mine.has(id)), ...wanted.filter(id => mine.has(id))];
        next = [...new Set(next)];
        if (mainCityId && !mine.has(mainCityId)) mainCityId = null;
    } else {
        next = wanted;
    }
    let main = mainCityId && next.includes(mainCityId) ? mainCityId
        : partner.cityId && next.includes(partner.cityId) ? partner.cityId
        : next[0] ?? null;
    // A zonal head never moves a partner's main city out of another zonal head's territory.
    if (managedCityIds && partner.cityId && next.includes(partner.cityId) && !managedCityIds.includes(partner.cityId)) main = partner.cityId;

    const removed = current.filter(id => !next.includes(id));
    const leftBehind = new Set(removed.flatMap(id => known.get(id)?.pincodes ?? []));
    for (const id of next) for (const p of known.get(id)?.pincodes ?? []) leftBehind.delete(p);
    const kept = partner.pincodes.filter(p => !leftBehind.has(p));

    await prisma.$transaction([
        prisma.user.update({ where: { id: partnerId }, data: { cityId: main, pincodes: kept } }),
        prisma.partnerCity.deleteMany({ where: { partnerId } }),
        ...next.filter(id => id !== main).map((cityId, i) =>
            prisma.partnerCity.create({ data: { partnerId, cityId, createdAt: new Date(Date.now() + i) } })),
    ]);
    return { cityIds: mergeCities(main, next), removedPincodes: partner.pincodes.length - kept.length };
}
