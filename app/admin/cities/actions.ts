'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { CITY_ADMIN_ROLES, requireCityAccess, requirePartnerAccess, requireStaffRole } from '@/lib/staff-access';

// Access: admins (SUPER_ADMIN, ADMIN) everywhere; zonal heads only for their own cities and the partners in them,
// matching what the Cities page shows each role. Anyone else is rejected before anything is written.

export async function updateCityPincodes(cityId: string, pincodes: string[]) {
    await requireCityAccess(cityId);
    await prisma.city.update({
        where: { id: cityId },
        data: { pincodes }
    });
    revalidatePath('/admin/cities');
}

export async function toggleCityActive(cityId: string, isActive: boolean) {
    // The page hides this control from zonal heads ("Safety Lock").
    await requireStaffRole(CITY_ADMIN_ROLES);
    await prisma.city.update({
        where: { id: cityId },
        data: { isActive }
    });
    revalidatePath('/admin/cities');
}

export async function updatePartnerPincodes(partnerId: string, pincodes: string[]) {
    await requirePartnerAccess(partnerId);
    await prisma.user.update({
        where: { id: partnerId },
        data: { pincodes }
    });
    revalidatePath('/admin/cities');
}

export async function removePartnerFromCity(partnerId: string) {
    await requirePartnerAccess(partnerId);
    await prisma.user.update({
        where: { id: partnerId },
        data: { cityId: null, pincodes: [] }
    });
    revalidatePath('/admin/cities');
}
