'use server';

import { db } from '@/lib/store';
import { getSession } from '@/lib/session';
import { isAdmin, SUPER_ADMIN_EMAILS } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { sendSystemEmail } from '@/lib/email';
import { prisma } from '@/lib/db';

// Auth check helper
async function requireAdmin() {
    const session = await getSession();
    if (!session || !session.user) {
        throw new Error('Unauthorized');
    }

    if (!isAdmin(session.user)) {
        console.log(`[Auth] Blocked non-admin user: ${session.user.email} (${session.user.role})`);
        throw new Error('Forbidden: Admin access required');
    }
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

export async function addPartner(email: string, cityId?: string, managerId?: string) {
    await requireAdmin();
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);
    if (!user) return { success: false, error: `User "${cleanEmail}" not found. They must register first.` };

    await prisma.user.update({
        where: { id: user.id },
        data: { 
            role: 'PARTNER',
            managerId: managerId || null,
            ...(cityId ? { cityId } : {})
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

async function requirePartnerOrAbove() {
    const session = await getSession();
    if (!session || !session.user) throw new Error('Unauthorized');
    const roles = ['SUPER_ADMIN', 'ADMIN', 'ZONAL_HEAD', 'RELATIONSHIP_MANAGER', 'PARTNER'];
    if (!roles.includes(session.user.role || '')) throw new Error('Forbidden: Insufficient privileges');
}

export async function getPartnersManagedBy(managerId: string) {
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

export async function addFieldExecutive(email: string) {
    const session = await getSession();
    if (!session || !session.user) throw new Error('Unauthorized');
    
    if (!isAdmin(session.user)) {
        throw new Error('Forbidden: Insufficient privileges to grant executive access');
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);
    if (!user) return { success: false, error: 'User not found. They must register first.' };

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
            const partnerId = session.user.role === 'PARTNER' ? session.user.id : null;

            await prisma.rider.create({
                data: {
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                    status: 'available',
                    partnerId: partnerId
                }
            });
        } else if (session.user.role === 'PARTNER' && !existingRider.partnerId) {
            await prisma.rider.update({
                where: { id: existingRider.id },
                data: { partnerId: session.user.id }
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

export async function addRider(name: string, phone: string, email?: string | null, partnerId?: string | null) {
    await requireAdmin();
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

export async function deleteRider(id: string) {
    await requireAdmin();
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

export async function updateRiderPartner(riderId: string, partnerId: string | null) {
    await requireAdmin();
    await db.updateRiderPartner(riderId, partnerId);
    revalidatePath('/admin/riders');
    return { success: true };
}

// --- Orders ---

export async function assignRider(orderId: string, riderId: string) {
    await requirePartnerOrAbove();
    const success = await db.updateOrderRider(orderId, riderId);
    if (!success) throw new Error('Database level failure: Could not update order with assigned executive. Please check if the executive still exists.');

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true, rider: true }
    });

    if (order?.user?.email && order?.rider) {
        const mailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #3b82f6; border-radius: 10px;">
            <h2 style="color: #3b82f6;">Executive Assigned! 🚚</h2>
            <p>Dear ${order.user.name}, we have assigned an executive for your <b>${order.device}</b> pickup!</p>
            <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #10b981;">
                <p style="margin: 5px 0;"><b>Executive Name:</b> ${order.rider.name}</p>
                <p style="margin: 5px 0;"><b>Executive Contact:</b> ${order.rider.phone}</p>
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
    await requirePartnerOrAbove();
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');

    const session = await getSession();
    let answersObj: any = {};
    if (order.answers && typeof order.answers === 'string') {
        try { answersObj = JSON.parse(order.answers); } catch { }
    }

    if (!answersObj.restoreLog) answersObj.restoreLog = [];
    answersObj.restoreLog.push({
        date: new Date().toISOString(),
        restoredBy: session?.user?.email || 'Admin',
        previousStatus: order.status
    });

    const restoredStatus = order.riderId ? 'assigned' : 'Pending Pickup';

    await prisma.order.update({
        where: { id: orderId },
        data: {
            status: restoredStatus,
            answers: JSON.stringify(answersObj)
        }
    });

    revalidatePath('/admin/orders');
    return { success: true, status: restoredStatus };
}

export async function deleteOrder(orderId: string) {
    await requirePartnerOrAbove();
    await prisma.order.delete({ where: { id: orderId } });
    revalidatePath('/admin/orders');
    return { success: true };
}

export async function updateOrderHubStatus(orderId: string, hubStatus: 'handed_over' | 'pending') {
    await requirePartnerOrAbove();
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');

    const session = await getSession();
    let answersObj: any = {};
    if (order.answers && typeof order.answers === 'string') {
        try { answersObj = JSON.parse(order.answers); } catch { }
    }

    answersObj.hubStatus = hubStatus;
    if (hubStatus === 'handed_over') {
        answersObj.hubHandoverAt = new Date().toISOString();
        answersObj.hubReceivedBy = session?.user?.name || session?.user?.email || 'Hub Staff';
    } else {
        answersObj.hubHandoverAt = null;
        answersObj.hubReceivedBy = null;
    }

    await prisma.order.update({
        where: { id: orderId },
        data: { answers: JSON.stringify(answersObj) }
    });

    revalidatePath('/admin/orders');
    revalidatePath('/admin/riders');
    return { success: true, hubStatus };
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
