import { prisma } from '@/lib/db';
import { Rider as PrismaRider, Brand as PrismaBrand, Model as PrismaModel, Variant as PrismaVariant, Order as PrismaOrder } from '@prisma/client';
import { CATALOG_2026_MODELS, get2026ModelsForBrand, deduplicateModels, getModelIdentityKey } from '@/lib/catalog2026';

// Re-export interfaces for app compatibility, though Prisma types are preferred
export interface User {
    id: string;
    email: string;
    phone?: string | null;
    passwordHash: string;
    name: string;
    role: string;
    resetToken?: string | null;
    resetTokenExpiry?: Date | null;
    pincodes?: string[];
    cityId?: string | null;
    managedCities?: any[];
}

export type Rider = PrismaRider;

export interface Order {
    id: string;
    orderNumber?: number;
    userId: string;
    user?: Partial<User> | null;
    device: string;
    price: number;
    date: string;
    status: string;
    address: string;
    pincode?: string | null;
    location: {
        lat: number;
        lng: number;
    } | null;
    riderId?: string | null;
    partnerId?: string | null;
    answers?: unknown;
    riderAnswers?: unknown;
    verificationImages?: string[];
    offeredPrice?: number | null;
    hubStatus?: 'pending' | 'handed_over' | null;
    hubHandoverAt?: string | null;
    hubReceivedBy?: string | null;
}

export type Brand = PrismaBrand;
export type Model = PrismaModel;
export type Variant = PrismaVariant;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EvaluationRule = any;

export const db = {
    getUsers: async () => {
        return await prisma.user.findMany();
    },
    addUser: async (user: User) => {
        await prisma.user.create({
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                passwordHash: user.passwordHash,
                role: user.role
            }
        });
    },
    findUserByEmail: async (email: string) => {
        return await prisma.user.findFirst({ 
            where: { 
                email: { 
                    equals: email.trim().toLowerCase(), 
                    mode: 'insensitive' 
                } 
            } 
        });
    },
    findUserById: async (id: string) => {
        return await prisma.user.findUnique({ where: { id } });
    },
    updateUserRole: async (email: string, role: string) => {
        await prisma.user.update({
            where: { email },
            data: { role }
        });
    },
    updateUserPassword: async (email: string, passwordHash: string) => {
        await prisma.user.update({
            where: { email },
            data: { passwordHash }
        });
    },
    updateProfile: async (email: string, data: { name?: string, phone?: string }) => {
        return await prisma.user.update({
            where: { email },
            data
        });
    },
    setResetToken: async (email: string, token: string, expiry: Date) => {
        await prisma.user.update({
            where: { email },
            data: { resetToken: token, resetTokenExpiry: expiry }
        });
    },
    clearResetToken: async (email: string) => {
        await prisma.user.update({
            where: { email },
            data: { resetToken: null, resetTokenExpiry: null }
        });
    },
    getAdmins: async () => {
        return await prisma.user.findMany({ where: { role: 'ADMIN' } });
    },
    getOrders: async (userId: string) => {
        const orders = await prisma.order.findMany({
            where: { userId },
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        });
        return orders.map(mapPrismaOrderToAppOrder);
    },
    getAllOrders: async () => {
        const orders = await prisma.order.findMany({
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        });
        return orders.map(mapPrismaOrderToAppOrder);
    },
    addOrder: async (order: Order) => {
        // Route the order to the partner covering its pincode (see partnerForPincode); none: it stays unrouted.
        const { partnerForPincode, orderCaretakers } = await import('@/lib/order-workflow');
        const routedPartner = await partnerForPincode(order.pincode);
        const newOrder = await prisma.order.create({
            data: {
                partnerId: routedPartner?.id ?? null,
                id: order.id,
                userId: order.userId,
                device: order.device,
                price: order.price,
                status: order.status,
                address: order.address,
                pincode: order.pincode,
                locationLat: order.location?.lat,
                locationLng: order.location?.lng,
                answers: order.answers ? JSON.stringify(order.answers) : null,
                createdAt: new Date(order.date),
            },
            include: {
                user: true
            }
        });

        // Broadcast Notifications
        try {
            // 1. Identify recipients
            // Admins & Super Admins (Always notify)
            const globalAdmins = await prisma.user.findMany({
                where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } }
            });

            // Targeted Zonal Heads (If order has pincode, find city, then find manager of that city)
            // For now, let's just find all Zonal Heads if we don't have a direct city link yet
            const zonalHeads = await prisma.user.findMany({
                where: { role: 'ZONAL_HEAD' }
            });

            // The partner the order was routed to and their RM (every RM when no partner covers the pincode).
            const caretakers = await prisma.user.findMany({
                where: { id: { in: await orderCaretakers(routedPartner?.id ?? null) } }
            });

            const allRecipients = [...globalAdmins, ...zonalHeads, ...caretakers];
            // Remove duplicates by email
            const uniqueRecipients = Array.from(new Map(allRecipients.map(r => [r.email, r])).values());

            // 2. Create System Notifications
            await Promise.all(uniqueRecipients.map(recipient => 
                prisma.notification.create({
                    data: {
                        userId: recipient.id,
                        title: 'New Order: Action Required',
                        message: `Order #${newOrder.orderNumber} for ${newOrder.device} placed in ${newOrder.pincode || 'unknown area'}.`,
                        type: 'order_new',
                        orderId: newOrder.id
                    }
                })
            ));

            // Also create a role-based broadcast for UI fallback
            await prisma.notification.create({
                data: {
                    role: 'ADMIN',
                    title: 'New Order Placed',
                    message: `New global order #${newOrder.orderNumber} needs assignment.`,
                    type: 'order_new',
                    orderId: newOrder.id
                }
            });

            // 3. Send Emails
            const { sendSystemEmail } = await import('@/lib/email');
            const emailHtml = `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 2px solid #10b981; border-radius: 15px;">
                    <h2 style="color: #10b981; font-size: 24px;">🚀 New Order Received!</h2>
                    <p style="font-size: 16px; color: #333;">Order <b>#${newOrder.orderNumber}</b> has been placed and requires your attention.</p>
                    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #d1fae5;">
                        <p style="margin: 5px 0;"><b>Device:</b> ${newOrder.device}</p>
                        <p style="margin: 5px 0;"><b>Estimated Offer:</b> ₹${newOrder.price}</p>
                        <p style="margin: 5px 0;"><b>Pincode:</b> ${newOrder.pincode || 'Not provided'}</p>
                        <p style="margin: 5px 0;"><b>Customer:</b> ${newOrder.user.name}</p>
                    </div>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/orders" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;">View in Dashboard</a>
                    <p style="color: #888; font-size: 12px; margin-top: 25px;">Fonzkart Logistics Management System</p>
                </div>
            `;

            // Sequential or concurrent sending? Concurrent for speed.
            Promise.all(uniqueRecipients.map(r => 
                sendSystemEmail(r.email, `New Order Alert: #${newOrder.orderNumber} (${newOrder.pincode})`, emailHtml)
            )).catch(err => console.error("Email broadcast partial failure:", err));

        } catch (e) {
            console.error("Critical Notification broadcast failed:", e);
        }
    },
    updateOrderRider: async (orderId: string, riderId: string) => {
        try {
            const updatedOrder = await prisma.order.update({
                where: { id: orderId },
                data: { riderId, status: 'assigned' }
            });

            // Notify Rider (Wrap in catch to avoid failing the whole transaction)
            try {
                await prisma.notification.create({
                    data: {
                        riderId: riderId,
                        title: 'New Task Assigned',
                        message: `You have been assigned order #${updatedOrder.orderNumber} for pickup.`,
                        type: 'order_assigned',
                        orderId: updatedOrder.id
                    }
                });
            } catch (e) {
                console.error("Delayed notification creation failed:", e);
            }
            
            return true;
        } catch (error) {
            console.error("Order Rider Update/Notify Failed:", error);
            return false;
        }
    },
    updateOrderStatus: async (orderId: string, status: string) => {
        try {
            await prisma.order.update({
                where: { id: orderId },
                data: { status }
            });
            return true;
        } catch {
            return false;
        }
    },

    // Rider Methods
    getRiders: async () => {
        return await prisma.rider.findMany();
    },
    addRider: async (rider: { id: string, name: string, phone: string, email?: string | null, status?: string, password?: string | null, partnerId?: string | null }) => {
        await prisma.rider.create({
            data: {
                id: rider.id,
                name: rider.name,
                phone: rider.phone,
                email: rider.email || null,
                status: rider.status || 'available',
                password: rider.password,
                // @ts-ignore
                partnerId: rider.partnerId
            }
        });
    },
    updateRiderPassword: async (id: string, password: string) => {
        await prisma.rider.update({
            where: { id },
            data: { password }
        });
    },
    deleteRider: async (id: string) => {
        await prisma.rider.delete({ where: { id } });
    },
    updateRiderPartner: async (id: string, partnerId: string | null) => {
        await prisma.rider.update({
            where: { id },
            // @ts-ignore
            data: { partnerId }
        });
    },

    // Brand Methods
    getBrands: async (category?: string) => {
        let dbBrands: Brand[] = [];
        try {
            if (category) {
                const categories = [category];
                if (category === 'watch' || category === 'smartwatch') {
                    categories.push('watch', 'smartwatch');
                }
                if (category === 'smartphone' || category === 'mobile') {
                    categories.push('smartphone', 'mobile');
                }
                if (category === 'tablet' || category === 'ipad') {
                    categories.push('tablet', 'ipad');
                }
                if (category === 'smarttv' || category === 'tv') {
                    categories.push('smarttv', 'tv');
                }

                const where: any = {
                    OR: [
                        { categories: { hasSome: categories } }
                    ]
                };

                if (category === 'smartphone') {
                    where.OR.push({ categories: { equals: [] } });
                }

                dbBrands = await prisma.brand.findMany({
                    where,
                    orderBy: [{ priority: 'asc' }, { name: 'asc' }]
                });
            } else {
                dbBrands = await prisma.brand.findMany({
                    orderBy: [{ priority: 'asc' }, { name: 'asc' }]
                });
            }
        } catch (err) {
            console.error("DB getBrands error:", err);
        }

        // Standard core brands fallback to ensure brands are always accessible
        const DEFAULT_CORE_BRANDS: Brand[] = [
            { id: 'apple', name: 'Apple', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg', categories: ['smartphone', 'tablet', 'watch'], priority: 1 },
            { id: 'samsung', name: 'Samsung', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg', categories: ['smartphone', 'tablet', 'watch', 'tv'], priority: 2 },
            { id: 'xiaomi', name: 'Xiaomi', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Xiaomi_logo_%282021-%29.svg', categories: ['smartphone', 'tablet', 'tv'], priority: 3 },
            { id: 'vivo', name: 'Vivo', logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Vivo_logo_2019.svg', categories: ['smartphone'], priority: 4 },
            { id: 'oneplus', name: 'OnePlus', logo: 'https://cdn.simpleicons.org/oneplus/F5010C', categories: ['smartphone', 'tablet'], priority: 5 },
            { id: 'realme', name: 'Realme', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Realme-realme-_logo_box_RGB_01.svg', categories: ['smartphone', 'tablet'], priority: 6 },
            { id: 'poco', name: 'Poco', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Poco_Logo.svg', categories: ['smartphone', 'tablet'], priority: 7 },
            { id: 'oppo', name: 'Oppo', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/09/OPPO_LOGO_2019.svg', categories: ['smartphone', 'tablet'], priority: 8 },
            { id: 'google', name: 'Google', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg', categories: ['smartphone'], priority: 9 },
            { id: 'motorola', name: 'Motorola', logo: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Motorola_new_logo.svg', categories: ['smartphone', 'tablet'], priority: 10 },
            { id: 'nothing', name: 'Nothing', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Nothing_logo.svg', categories: ['smartphone'], priority: 11 },
            { id: 'iqoo', name: 'iQOO', logo: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/IQOO_logo.svg', categories: ['smartphone'], priority: 12 },
        ];

        const existingBrandIds = new Set(dbBrands.map(b => b.id.toLowerCase()));
        const missingCoreBrands = DEFAULT_CORE_BRANDS.filter(b => {
            if (existingBrandIds.has(b.id.toLowerCase())) return false;
            if (category && !b.categories.includes(category) && category !== 'smartphone') return false;
            return true;
        });

        const allBrands = [...dbBrands, ...missingCoreBrands];
        return allBrands.sort((a, b) => {
            const pDiff = (a.priority ?? 100) - (b.priority ?? 100);
            if (pDiff !== 0) return pDiff;
            return a.name.localeCompare(b.name);
        });
    },
    addBrand: async (brand: Brand) => {
        await prisma.brand.create({ data: brand });
    },
    addCategoryToBrand: async (id: string, category: string) => {
        const brand = await prisma.brand.findUnique({ where: { id } }) as any;
        if (brand && !brand.categories.includes(category)) {
            await prisma.brand.update({
                where: { id },
                data: { categories: { push: category } } as any
            });
        }
    },
    getBrand: async (id: string) => {
        return await prisma.brand.findUnique({ where: { id } });
    },
    removeCategoryFromBrand: async (id: string, category: string) => {
        const brand = await prisma.brand.findUnique({ where: { id } }) as any;
        if (!brand) return;
        const newCats = brand.categories.filter((c: string) => c !== category);
        if (newCats.length !== brand.categories.length) {
            if (newCats.length === 0) {
                await prisma.brand.delete({ where: { id } });
            } else {
                await prisma.brand.update({
                    where: { id },
                    data: { categories: newCats } as any
                });
            }
        }
    },
    updateBrand: async (id: string, name: string, logo: string, priority?: number) => {
        await prisma.brand.update({
            where: { id },
            data: { name, logo, priority }
        });
    },
    deleteBrand: async (id: string) => {
        await prisma.brand.delete({ where: { id } });
    },

    // Model Methods
    getModels: async (brandId?: string, category?: string) => {
        let dbModels: Model[] = [];
        try {
            const where: any = {};
            if (brandId) where.brandId = brandId;

            if (category) {
                const cat = category.toLowerCase();
                if (cat === 'smartphone' || cat === 'mobile') {
                    where.category = { in: ['smartphone', 'mobile', ''] };
                } else if (cat === 'watch' || cat === 'smartwatch') {
                    where.category = { in: ['watch', 'smartwatch'] };
                } else if (cat === 'tablet' || cat === 'ipad') {
                    where.category = { in: ['tablet', 'ipad'] };
                } else if (cat === 'smarttv' || cat === 'tv') {
                    where.category = { in: ['smarttv', 'tv'] };
                } else {
                    where.category = cat;
                }
            }

            dbModels = await prisma.model.findMany({
                where,
                orderBy: [{ priority: 'asc' }, { name: 'asc' }]
            });
        } catch (err) {
            console.error("DB getModels error, using fallback catalog:", err);
        }

        // Get 2026 catalog models for this brand/category
        const models2026 = get2026ModelsForBrand(brandId, category);
        const existingCanonicalKeys = new Set(dbModels.map(m => getModelIdentityKey(m.brandId, m.name)));
        const missing2026 = models2026.filter(m => !existingCanonicalKeys.has(getModelIdentityKey(m.brandId, m.name)));

        // Background auto-seeding to persist missing 2026 models into PostgreSQL
        if (missing2026.length > 0) {
            (async () => {
                try {
                    for (const m of missing2026) {
                        const brandExists = await prisma.brand.findUnique({ where: { id: m.brandId } });
                        if (!brandExists) {
                            await prisma.brand.create({
                                data: {
                                    id: m.brandId,
                                    name: m.brandId.charAt(0).toUpperCase() + m.brandId.slice(1),
                                    logo: m.img,
                                    categories: ['smartphone'],
                                    priority: 100
                                }
                            }).catch(() => {});
                        }

                        const createdModel = await prisma.model.create({
                            data: {
                                id: m.id,
                                brandId: m.brandId,
                                name: m.name,
                                img: m.img,
                                category: m.category,
                                priority: m.priority
                            }
                        }).catch(() => null);

                        if (createdModel && m.variants) {
                            for (const v of m.variants) {
                                await prisma.variant.create({
                                    data: {
                                        id: v.id,
                                        modelId: createdModel.id,
                                        name: v.name,
                                        basePrice: v.basePrice
                                    }
                                }).catch(() => {});
                            }
                        }
                    }
                } catch {
                    // Ignore background sync errors
                }
            })();
        }

        // Map any existing DB models to their high-res 2026 product images if matching
        const catalogMap = new Map(CATALOG_2026_MODELS.map(m => [getModelIdentityKey(m.brandId, m.name), m.img]));
        const updatedDbModels = dbModels.map(m => {
            const catalogImg = catalogMap.get(getModelIdentityKey(m.brandId, m.name));
            if (catalogImg && (!m.img || m.img.endsWith('.svg') || m.img.includes('wikimedia') || m.img.includes('Logo'))) {
                return { ...m, img: catalogImg };
            }
            return m;
        });

        // Merge 2026 models directly into results
        const combined = [
            ...models2026.map(m => ({
                id: m.id,
                brandId: m.brandId,
                name: m.name,
                img: m.img,
                category: m.category,
                priority: m.priority
            })),
            ...updatedDbModels
        ];

        // Deduplicate so duplicate variants like "Vivo X300 Pro" and "Vivo X300 Pro 5G" never appear twice
        const deduplicated = deduplicateModels(combined);

        return deduplicated.sort((a, b) => {
            const pDiff = (a.priority ?? 100) - (b.priority ?? 100);
            if (pDiff !== 0) return pDiff;
            return a.name.localeCompare(b.name);
        });
    },
    searchModels: async (query: string) => {
        let dbResults: Model[] = [];
        try {
            dbResults = await prisma.model.findMany({
                where: {
                    name: { contains: query, mode: 'insensitive' }
                },
                take: 10,
                orderBy: [{ priority: 'asc' }, { name: 'asc' }]
            });
        } catch (err) {
            console.error("DB searchModels error:", err);
        }

        const lowerQuery = query.toLowerCase().trim();
        const catalogResults = CATALOG_2026_MODELS.filter(m =>
            m.name.toLowerCase().includes(lowerQuery)
        ).map(m => ({
            id: m.id,
            brandId: m.brandId,
            name: m.name,
            img: m.img,
            category: m.category,
            priority: m.priority
        }));

        const combined = [...catalogResults, ...dbResults];
        const deduplicated = deduplicateModels(combined);

        return deduplicated.sort((a, b) => {
            const pDiff = (a.priority ?? 100) - (b.priority ?? 100);
            if (pDiff !== 0) return pDiff;
            return a.name.localeCompare(b.name);
        }).slice(0, 10);
    },
    addModel: async (model: Model) => {
        await prisma.model.create({ data: model });
    },
    updateModel: async (id: string, brandId: string, name: string, img: string, category: string = 'smartphone', priority: number = 100) => {
        await prisma.model.update({
            where: { id },
            data: { brandId, name, img, category, priority } as any
        });
    },
    updateModelPriorities: async (items: { id: string, priority: number }[]) => {
        await prisma.$transaction(
            items.map(item =>
                prisma.model.update({
                    where: { id: item.id },
                    data: { priority: item.priority }
                })
            )
        );
    },
    deleteModel: async (id: string) => {
        await prisma.model.delete({ where: { id } });
    },

    // Variant Methods
    getVariants: async (modelId?: string) => {
        let dbVariants: Variant[] = [];
        try {
            if (modelId) {
                dbVariants = await prisma.variant.findMany({
                    where: { modelId },
                    orderBy: { basePrice: 'asc' }
                });
            } else {
                dbVariants = await prisma.variant.findMany({
                    orderBy: { basePrice: 'asc' }
                });
            }
        } catch (err) {
            console.error("DB getVariants error:", err);
        }

        if (modelId && dbVariants.length === 0) {
            const target = CATALOG_2026_MODELS.find(m => m.id === modelId || m.name.toLowerCase().trim() === modelId.toLowerCase().trim());
            if (target && target.variants) {
                return target.variants.map(v => ({
                    id: v.id,
                    modelId: target.id,
                    name: v.name,
                    basePrice: v.basePrice
                }));
            }
        }

        return dbVariants;
    },
    addVariant: async (variant: Variant) => {
        await prisma.variant.create({ data: variant });
    },
    updateVariant: async (id: string, modelId: string, name: string, basePrice: number) => {
        await prisma.variant.update({
            where: { id },
            data: { modelId, name, basePrice }
        });
    },
    deleteVariant: async (id: string) => {
        await prisma.variant.delete({ where: { id } });
    },

    // Evaluation Rule Methods
    getEvaluationRules: async (category: string) => {
        // Defensive check for case where Prisma client might not be refreshed in build env
        const client = prisma as any;
        if (!client.evaluationRule) {
            console.warn("EvaluationRule model not found in Prisma client. Falling back to empty rules.");
            return [];
        }

        return await client.evaluationRule.findMany({
            where: { category }
        });
    },
    upsertEvaluationRule: async (data: { category: string, questionKey: string, answerKey: string, label: string, deductionAmount: number, deductionPercent: number }) => {
        const client = prisma as any;
        await client.evaluationRule.upsert({
            where: {
                category_questionKey_answerKey: {
                    category: data.category,
                    questionKey: data.questionKey,
                    answerKey: data.answerKey
                }
            } as any,
            create: data as any,
            update: {
                deductionAmount: data.deductionAmount,
                deductionPercent: data.deductionPercent,
                label: data.label
            } as any
        });
    }
};

function mapPrismaOrderToAppOrder(o: PrismaOrder & { orderNumber?: number, user?: any }): Order {
    let answersObj: any = null;
    try {
        answersObj = o.answers ? JSON.parse(o.answers) : null;
    } catch {
        answersObj = null;
    }
    const isCompleted = o.status === 'completed';
    const hubStatus = answersObj?.hubStatus || (isCompleted ? 'pending' : null);

    return {
        id: o.id,
        orderNumber: o.orderNumber,
        userId: o.userId,
        user: o.user ? {
            id: o.user.id,
            name: o.user.name,
            email: o.user.email,
            phone: o.user.phone,
        } : null,
        device: o.device,
        price: o.price,
        date: o.createdAt.toISOString(),
        status: o.status,
        address: o.address,
        pincode: o.pincode,
        location: (o.locationLat && o.locationLng) ? { lat: o.locationLat, lng: o.locationLng } : null,
        riderId: o.riderId,
        partnerId: o.partnerId ?? null,
        answers: answersObj,
        riderAnswers: o.riderAnswers ? JSON.parse(o.riderAnswers) : null,
        verificationImages: o.verificationImages || [],
        offeredPrice: o.offeredPrice,
        hubStatus,
        hubHandoverAt: answersObj?.hubHandoverAt || null,
        hubReceivedBy: answersObj?.hubReceivedBy || null,
    };
}
