'use server';

import { db, type Model, type Variant } from '@/lib/store';
import { backendGet, usesApi } from '@/lib/backend';

export async function fetchBrands(category?: string) {
    return await db.getBrands(category);
}

export async function fetchModels(brandId: string, category?: string) {
    return await db.getModels(brandId, category);
}

export async function searchGlobalModels(query: string) {
    if (!query || query.length < 2) return [];
    return await db.searchModels(query);
}

export async function fetchVariants(modelId: string, category: string = 'smartphone') {
    // Fetch variants from DB
    return await db.getVariants(modelId);
}

export async function findVariantByName(deviceName: string) {
    if (usesApi('CATALOG')) return await backendGet<Variant & { model: Model }>('/api/catalog/variants/lookup', { deviceName });
    // deviceName is usually "Model Name (Variant Name)"
    const match = deviceName.match(/(.+)\s\((.+)\)/);
    if (!match) return null;

    const name = match[1].trim();
    const variant = match[2].trim();

    try {
        const { prisma } = await import('@/lib/db');
        const found = await prisma.variant.findFirst({
            where: {
                name: { equals: variant, mode: 'insensitive' },
                model: {
                    name: { equals: name, mode: 'insensitive' }
                }
            },
            include: {
                model: true
            }
        });
        if (found) return found;
    } catch (e) {
        console.error("findVariantByName DB error:", e);
    }

    // Fallback to 2026 catalog
    const { CATALOG_2026_MODELS, getCanonicalModelKey } = await import('@/lib/catalog2026');
    const targetModel = CATALOG_2026_MODELS.find(m => 
        m.name.toLowerCase().trim() === name.toLowerCase().trim() ||
        getCanonicalModelKey(m.name) === getCanonicalModelKey(name)
    );
    if (targetModel) {
        const targetVariant = targetModel.variants.find(v => 
            v.name.toLowerCase().trim() === variant.toLowerCase().trim() ||
            v.name.toLowerCase().replace(/[^a-z0-9]/g, '') === variant.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        if (targetVariant) {
            return {
                id: targetVariant.id,
                modelId: targetModel.id,
                name: targetVariant.name,
                basePrice: targetVariant.basePrice,
                model: {
                    id: targetModel.id,
                    brandId: targetModel.brandId,
                    name: targetModel.name,
                    img: targetModel.img,
                    category: targetModel.category,
                    priority: targetModel.priority
                }
            } as any;
        }
    }

    return null;
}
