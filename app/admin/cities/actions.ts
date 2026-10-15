'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { CITY_ADMIN_ROLES, requireCityAccess, requirePartnerAccess, requireStaffRole } from '@/lib/staff-access';
import { backendRequest, usesApi } from '@/lib/backend';

// Access: admins (SUPER_ADMIN, ADMIN) everywhere; zonal heads only for their own cities and the partners in them,
// matching what the Cities page shows each role. Anyone else is rejected before anything is written.
// With USE_API_STAFF=1 the backend makes these changes, with the same checks (as the Admin app).

async function cityChange(method: 'POST' | 'PUT', path: string, body?: unknown) {
    await backendRequest(method, path, { body });
    revalidatePath('/admin/cities');
}

export async function updateCityPincodes(cityId: string, pincodes: string[]) {
    if (usesApi('STAFF')) return cityChange('PUT', `/api/cities/${encodeURIComponent(cityId)}/pincodes`, { pincodes });
    await requireCityAccess(cityId);
    await prisma.city.update({
        where: { id: cityId },
        data: { pincodes }
    });
    revalidatePath('/admin/cities');
}

export async function toggleCityActive(cityId: string, isActive: boolean) {
    if (usesApi('STAFF')) return cityChange('PUT', `/api/cities/${encodeURIComponent(cityId)}/active`, { isActive });
    // The page hides this control from zonal heads ("Safety Lock").
    await requireStaffRole(CITY_ADMIN_ROLES);
    await prisma.city.update({
        where: { id: cityId },
        data: { isActive }
    });
    revalidatePath('/admin/cities');
}

export async function updatePartnerPincodes(partnerId: string, pincodes: string[]) {
    if (usesApi('STAFF')) return cityChange('PUT', `/api/cities/partners/${encodeURIComponent(partnerId)}/pincodes`, { pincodes });
    await requirePartnerAccess(partnerId);
    await prisma.user.update({
        where: { id: partnerId },
        data: { pincodes }
    });
    revalidatePath('/admin/cities');
}

export async function removePartnerFromCity(partnerId: string) {
    if (usesApi('STAFF')) return cityChange('POST', `/api/cities/partners/${encodeURIComponent(partnerId)}/remove`);
    await requirePartnerAccess(partnerId);
    await prisma.user.update({
        where: { id: partnerId },
        data: { cityId: null, pincodes: [] }
    });
    revalidatePath('/admin/cities');
}
