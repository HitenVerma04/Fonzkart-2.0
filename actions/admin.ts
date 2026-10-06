'use server';

import { db } from '@/lib/store';
import { getSession } from '@/lib/session';
import { SUPER_ADMIN_EMAILS } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { sendSystemEmail } from '@/lib/email';
import { prisma } from '@/lib/db';
import {
    ADMINS, FORBIDDEN_SCOPE, FORBIDDEN_TEAM, PARTNER_MANAGERS, RIDER_MANAGERS, requireAssignableTarget,
    requireStaffRole, riderTeamPartnerIds, zonalHeadManagedCityIds,
} from '@/lib/staff-access';
import { ORDER_DELETERS, ORDER_STAFF, PARTNER_ROUTERS, requireOrderAccess } from '@/lib/order-access';
import * as orderWorkflow from '@/lib/order-workflow';

// Auth check helper: SUPER_ADMIN or ADMIN only (database role). Partners, field executives, zonal heads and
// relationship managers may enter the admin panel, but that does not make them administrators.
async function requireAdmin() {
    return requireStaffRole(ADMINS);
}

// --- Admins & Staff ---

export async function getAdmins() {
    await requireAdmin();
    return await db.getAdmins();
}

export async function addAdmin(email: string) {
    await requireAdmin();
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);
    if (!user) return { success: false, error: 'User not found. They must register first.' };

    await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' }
    });
    revalidatePath('/admin/admins');
    return { success: true };
}

export async function addZonalHead(email: string) {
    await requireAdmin();
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);
    if (!user) return { success: false, error: 'User not found. They must register first.' };

    await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ZONAL_HEAD' }
    });
    revalidatePath('/admin/admins');
    revalidatePath('/admin/zonal-heads');
    return { success: true };
}

export async function addRelationshipManager(email: string) {
    await requireAdmin();
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);
    if (!user) return { success: false, error: 'User not found. They must register first.' };

    await prisma.user.update({
        where: { id: user.id },
        data: { role: 'RELATIONSHIP_MANAGER' }
    });
    revalidatePath('/admin/admins');
    revalidatePath('/admin/relationship-managers');
    return { success: true };
}

// Used by the Users page (admins) and the Partners page (also zonal heads and relationship managers).
export async function addPartner(email: string, cityId?: string, managerId?: string) {
    const staff = await requireStaffRole(PARTNER_MANAGERS);
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);
    if (!user) return { success: false, error: `User "${cleanEmail}" not found. They must register first.` };
    requireAssignableTarget(staff, user, 'PARTNER');
    // A zonal head may only place partners in their own cities (as the Partners page offers) and under themselves.
    if (staff.role === 'ZONAL_HEAD'
        && ((cityId && !(await zonalHeadManagedCityIds(staff)).includes(cityId)) || (managerId && managerId !== staff.id))) {
        throw new Error(FORBIDDEN_SCOPE);
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { 
            role: 'PARTNER',
            managerId: managerId || null,
            ...(cityId ? { cityId } : {}),
            // A partner brought in by a relationship manager is that RM's partner (orders, executives, routing).
            ...(staff.role === 'RELATIONSHIP_MANAGER' ? { relationshipManagerId: staff.id } : {})
        }
    });

    revalidatePath('/admin/admins');
    revalidatePath('/admin/partners');
    return { success: true };
}

export async function updatePartnerManager(partnerId: string, managerId: string | null) {
    await requireAdmin();
    await prisma.user.update({
        where: { id: partnerId },
        data: { managerId: managerId }
    });
    revalidatePath('/admin/partners');
    return { success: true };
}

export async function toggleFeaturedCity(id: string, isFeatured: boolean) {
    await requireAdmin();
    await prisma.city.update({
        where: { id },
        data: { isFeatured }
    });
    revalidatePath('/');
    revalidatePath('/admin/homepage');
    return { success: true };
}

export async function updateCityDisplayOrder(id: string, order: number) {
    await requireAdmin();
    await prisma.city.update({
        where: { id },
        data: { displayOrder: parseInt(order.toString()) }
    });
    revalidatePath('/');
    revalidatePath('/admin/homepage');
    return { success: true };
}

async function requireZonalOrAdmin() {
    const session = await getSession();
    if (!session || !session.user) throw new Error('Unauthorized');
    const roles = ['SUPER_ADMIN', 'ADMIN', 'ZONAL_HEAD', 'RELATIONSHIP_MANAGER'];
    if (!roles.includes(session.user.role || '')) throw new Error('Forbidden: Admin or Zonal Head access required');
}

// Not used by any page. Admins may list anyone's partners, a zonal head only their own.
export async function getPartnersManagedBy(managerId: string) {
    const staff = await requireStaffRole([...ADMINS, 'ZONAL_HEAD']);
    if (staff.role === 'ZONAL_HEAD' && managerId !== staff.id) throw new Error(FORBIDDEN_SCOPE);
    return await prisma.user.findMany({
        where: { 
            managerId: managerId,
            role: 'PARTNER'
        },
        include: {
            city: true
        }
    });
}

// Used by the Users page (admins) and the Field Executives page (also zonal heads and partners).
export async function addFieldExecutive(email: string) {
    const staff = await requireStaffRole(RIDER_MANAGERS, 'Forbidden: Insufficient privileges to grant executive access');

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);
    if (!user) return { success: false, error: 'User not found. They must register first.' };
    requireAssignableTarget(staff, user, 'FIELD_EXECUTIVE');

    await prisma.user.update({
        where: { id: user.id },
        data: { role: 'FIELD_EXECUTIVE' }
    });

    if (user.phone) {
        const existingRider = await prisma.rider.findFirst({
            where: { phone: user.phone }
        });

        if (!existingRider) {
            console.log(`[RoleMgmt] Synchronizing: Creating Rider record for ${user.name} (${user.phone})`);
            const partnerId = staff.role === 'PARTNER' ? staff.id : null;

            await prisma.rider.create({
                data: {
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    status: 'available',
                    partnerId: partnerId
                }
            });
        } else if (staff.role === 'PARTNER' && !existingRider.partnerId) {
            await prisma.rider.update({
                where: { id: existingRider.id },
                data: { partnerId: staff.id }
            });
        }
    }

    revalidatePath('/admin/admins');
    revalidatePath('/admin/riders');
    revalidatePath('/admin/orders');
    return { success: true };
}

export async function removeAdmin(email: string) {
    await requireAdmin();
    const session = await getSession();
    if (session?.user?.email === email) {
        return { success: false, error: 'Cannot remove yourself from admins' };
    }
    if (SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase())) {
        return { success: false, error: 'Cannot revoke access from protected Super Admin' };
    }

    await db.updateUserRole(email, 'USER');
    revalidatePath('/admin/admins');
    return { success: true };
}

export async function removeUserRole(email: string) {
    await requireAdmin();
    const session = await getSession();
    if (session?.user?.email === email) {
        return { success: false, error: 'Cannot remove your own role' };
    }
    if (SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase())) {
        return { success: false, error: 'Cannot revoke access from protected Super Admin' };
    }

    await db.updateUserRole(email, 'USER');
    
    // Comprehensive path revalidation
    revalidatePath('/admin');
    revalidatePath('/admin/admins');
    revalidatePath('/admin/zonal-heads');
    revalidatePath('/admin/relationship-managers');
    revalidatePath('/admin/partners');
    revalidatePath('/admin/riders');
    revalidatePath('/admin/orders');
    
    return { success: true };
}

// --- Brands ---

export async function getBrands() {
    return await db.getBrands();
}

export async function addBrand(name: string, logo: string, category?: string, priority: number = 100) {
    await requireAdmin();
    const id = name.toLowerCase().replace(/\s+/g, '-');
    const existing = await db.getBrand(id);

    if (existing) {
        if (category) {
            await db.addCategoryToBrand(id, category);
        }
        await db.updateBrand(id, name, logo, priority);
    } else {
        await db.addBrand({
            id,
            name,
            logo,
            categories: category ? [category] : []
        } as any);
    }

    revalidatePath(`/admin/category/${category}`);
    revalidatePath('/sell');
    revalidatePath('/');
    return { success: true, id };
}

export async function deleteBrand(id: string, category?: string) {
    await requireAdmin();

    if (category) {
        const brand = await db.getBrand(id) as any;
        if (brand && brand.categories && brand.categories.includes(category)) {
            await db.removeCategoryFromBrand(id, category);
        } else if (brand && (!brand.categories || brand.categories.length === 0)) {
            await db.deleteBrand(id);
        }
    } else {
        await db.deleteBrand(id);
    }

    if (category) revalidatePath(`/admin/category/${category}`);
    revalidatePath('/sell');
    revalidatePath('/');
    revalidatePath('/admin/brands');
    return { success: true };
}

export async function updateBrand(id: string, name: string, logo: string, priority?: number) {
    await requireAdmin();
    await db.updateBrand(id, name, logo, priority);
    revalidatePath('/admin/brands');
    revalidatePath('/sell');
    revalidatePath('/');
    return { success: true };
}

// --- Models ---

export async function getModels(brandId?: string) {
    return await db.getModels(brandId);
}

export async function addModel(brandId: string, name: string, img: string, category: string = 'smartphone', priority: number = 100) {
    await requireAdmin();
    const id = randomUUID();
    await db.addModel({
        id,
        brandId,
        name,
        img,
        category,
        priority
    } as any);
    revalidatePath('/admin/models');
    revalidatePath('/');
    return { success: true, id };
}

export async function updateModel(id: string, brandId: string, name: string, img: string, category: string = 'smartphone', priority: number = 100) {
    await requireAdmin();
    await db.updateModel(id, brandId, name, img, category, priority);
    revalidatePath('/admin/models');
    revalidatePath('/');
    return { success: true };
}

export async function reorderModels(items: { id: string, priority: number }[]) {
    await requireAdmin();
    await db.updateModelPriorities(items);
    revalidatePath('/admin/models');
    revalidatePath('/sell');
    revalidatePath('/');
    return { success: true };
}

export async function deleteModel(id: string) {
    await requireAdmin();
    await db.deleteModel(id);
    revalidatePath('/admin/models');
    return { success: true };
}

// --- Variants ---

export async function getVariants(modelId?: string) {
    return await db.getVariants(modelId);
}

export async function addVariant(modelId: string, name: string, basePrice: number) {
    await requireAdmin();
    const id = randomUUID();
    await db.addVariant({
        id,
        modelId,
        name,
        basePrice
    });
    revalidatePath('/admin/variants');
    return { success: true, id };
}

export async function updateVariant(id: string, modelId: string, name: string, basePrice: number) {
    await requireAdmin();
    await db.updateVariant(id, modelId, name, basePrice);
    revalidatePath('/admin/variants');
    return { success: true };
}

export async function deleteVariant(id: string) {
    await requireAdmin();
    await db.deleteVariant(id);
    revalidatePath('/admin/variants');
    return { success: true };
}

// --- Riders ---

// Field Executives page: admins (any partner), zonal heads (their partners or none), partners (themselves).
export async function addRider(name: string, phone: string, email?: string | null, partnerId?: string | null) {
    const staff = await requireStaffRole(RIDER_MANAGERS);
    const team = await riderTeamPartnerIds(staff);
    if (team && !(partnerId ? team.includes(partnerId) : staff.role === 'ZONAL_HEAD')) throw new Error(FORBIDDEN_TEAM);
    await db.addRider({
        id: randomUUID(),
        name,
        phone,
        email: email || null,
        status: 'available',
        password: null,
        partnerId: partnerId || null
    });
    revalidatePath('/admin/riders');
    return { success: true };
}

// Admins: any rider or field-executive account. Zonal heads and partners: only riders of their own team, and only if
// an account with the same id is an ordinary or field-executive account (its role is reset to USER).
export async function deleteRider(id: string) {
    const staff = await requireStaffRole(RIDER_MANAGERS);
    const team = await riderTeamPartnerIds(staff);
    if (team) {
        const rider = await prisma.rider.findUnique({ where: { id } });
        if (!rider?.partnerId || !team.includes(rider.partnerId)) throw new Error(FORBIDDEN_TEAM);
        const account = await prisma.user.findUnique({ where: { id } });
        if (account) requireAssignableTarget(staff, account, 'FIELD_EXECUTIVE');
    }
    let wasUserResetted = false;
    let wasRiderDeleted = false;

    try {
        // 1. Reset user role if it's a User record
        const user = await prisma.user.findUnique({ where: { id } });
        if (user) {
            await prisma.user.update({
                where: { id },
                data: { role: 'USER' }
            });
            wasUserResetted = true;
        }

        // 2. Try to actually delete from Rider model
        // If it has orders, this will fail unless we handle it, but we'll try.
        try {
            await prisma.rider.delete({ where: { id } });
            wasRiderDeleted = true;
        } catch (riderError) {
            console.warn(`[RoleMgmt] Could not delete Rider record ${id} (likely has orders), but role was resetted if User existed.`);
        }

        revalidatePath('/admin/admins');
        revalidatePath('/admin/riders');
        revalidatePath('/admin/orders');

        if (wasUserResetted || wasRiderDeleted) {
            return { success: true };
        }
        return { success: false, error: 'Record not found in Users or Riders' };
    } catch (e: any) {
        console.error("deleteRider failure:", e);
        return { success: false, error: e.message };
    }
}

// Admins: any rider. Zonal heads: a rider of their team, moved to another of their partners or to none.
// (The page does not offer this to partners.)
export async function updateRiderPartner(riderId: string, partnerId: string | null) {
    const staff = await requireStaffRole([...ADMINS, 'ZONAL_HEAD']);
    const team = await riderTeamPartnerIds(staff);
    if (team) {
        const rider = await prisma.rider.findUnique({ where: { id: riderId } });
        if (!rider?.partnerId || !team.includes(rider.partnerId) || (partnerId && !team.includes(partnerId))) {
            throw new Error(FORBIDDEN_TEAM);
        }
    }
    await db.updateRiderPartner(riderId, partnerId);
    revalidatePath('/admin/riders');
    return { success: true };
}

// --- Orders ---
// Who may act on which order: lib/order-access.ts. What each change does: lib/order-workflow.ts.

// Route (or re-route) an order to a partner: admins any partner, zonal heads their team, RMs their own partners.
export async function assignPartner(orderId: string, partnerId: string) {
    const ctx = await requireOrderAccess(orderId, PARTNER_ROUTERS);
    const result = await orderWorkflow.assignPartner(ctx, partnerId);
    revalidatePath('/admin/orders');
    revalidatePath('/admin/rm-dashboard');
    return { success: true, changed: result.changed };
}

// Give an order to an executive: admins any; zonal heads, RMs and partners only executives of their partners.
export async function assignRider(orderId: string, riderId: string) {
    const ctx = await requireOrderAccess(orderId, ORDER_STAFF);
    const rider = await orderWorkflow.assignRider(ctx, riderId);

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true }
    });

    if (order?.user?.email) {
        const mailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #3b82f6; border-radius: 10px;">
            <h2 style="color: #3b82f6;">Executive Assigned! 🚚</h2>
            <p>Dear ${order.user.name}, we have assigned an executive for your <b>${order.device}</b> pickup!</p>
            <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #10b981;">
                <p style="margin: 5px 0;"><b>Executive Name:</b> ${rider.name}</p>
                <p style="margin: 5px 0;"><b>Executive Contact:</b> ${rider.phone}</p>
                <p style="margin: 5px 0;"><b>Estimated Offer:</b> ₹${order.price}</p>
            </div>
            <p>They will contact you shortly to coordinate the pickup time at your provided address.</p>
            <p style="color: #888; font-size: 12px; margin-top: 20px;">Fonzkart Logistics Tracking</p>
          </div>
        `;
        sendSystemEmail(order.user.email, 'Fonzkart: Executive Assigned for Pickup', mailHtml);
    }

    revalidatePath('/admin');
    revalidatePath('/admin/orders');
    return { success: true };
}

export async function restoreOrder(orderId: string) {
    const { order, staff } = await requireOrderAccess(orderId, ORDER_STAFF);
    const restoredStatus = await orderWorkflow.restoreOrder(order, await orderWorkflow.staffActor(staff));
    revalidatePath('/admin/orders');
    return { success: true, status: restoredStatus };
}

// Permanent deletion: admins and zonal heads (their orders) only, as the order API's DELETE.
export async function deleteOrder(orderId: string) {
    await requireOrderAccess(orderId, ORDER_DELETERS);
    await prisma.order.delete({ where: { id: orderId } });
    revalidatePath('/admin/orders');
    return { success: true };
}

export async function updateOrderHubStatus(orderId: string, hubStatus: 'handed_over' | 'pending') {
    const { order, staff } = await requireOrderAccess(orderId, ORDER_STAFF);
    await orderWorkflow.setHubStatus(order, await orderWorkflow.staffActor(staff), hubStatus);
    revalidatePath('/admin/orders');
    revalidatePath('/admin/riders');
    return { success: true, hubStatus };
}

// Record that the customer was paid (once the device is collected).
export async function markPayoutPaid(orderId: string, reference?: string) {
    const { order, staff } = await requireOrderAccess(orderId, ORDER_STAFF);
    const payout = await orderWorkflow.markPayoutPaid(order, await orderWorkflow.staffActor(staff), reference);
    revalidatePath('/admin/orders');
    revalidatePath('/orders');
    return { success: true, payout };
}

// --- Evaluation Rules ---

export async function getEvaluationRules(category: string) {
    return await db.getEvaluationRules(category);
}

export async function upsertEvaluationRule(data: { category: string, questionKey: string, answerKey: string, label: string, deductionAmount: number, deductionPercent: number }) {
    await requireAdmin();
    await db.upsertEvaluationRule(data);
    revalidatePath(`/admin/category/${data.category}`);
    revalidatePath('/sell');
    return { success: true };
}

import { fetchAllBannerPrices, saveBannerPriceItem } from '@/lib/banner-prices';

// --- Device Display Prices ---

export async function getDeviceDisplayPrices() {
    await requireAdmin();
    return await fetchAllBannerPrices();
}

export async function updateDeviceDisplayPrice(
    id: string,
    displayPrice: string,
    categoryKey?: string,
    categoryName?: string
) {
    await requireAdmin();
    const result = await saveBannerPriceItem(id, displayPrice, categoryKey, categoryName);
    revalidatePath('/');
    revalidatePath('/admin/homepage');
    return result;
}
