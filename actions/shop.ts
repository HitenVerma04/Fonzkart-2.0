'use server';

import { revalidatePath } from 'next/cache';
import { backendRequest } from '@/lib/backend';
import { fetchVariants, searchGlobalModels } from '@/actions/catalog';
import { ANDROID_MODELS } from '@/lib/android-models';
import type { ScreenGuard, ShopOrder, ShopOrderStatus, ShopSettings } from '@/lib/shop';

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const failed = (e: unknown, fallback: string): { ok: false; error: string } => ({ ok: false, error: e instanceof Error && e.message !== 'Internal error' ? e.message : fallback });

export type PlaceOrderInput = { items: { screenGuardId: string; quantity: number }[]; name: string; phone: string; address: string; pincode: string };

/** The server prices the order from its own data. */
export async function placeShopOrder(input: PlaceOrderInput): Promise<Result<ShopOrder>> {
    try {
        const { data } = await backendRequest<ShopOrder>('POST', '/api/shop/orders', { body: input });
        revalidatePath('/orders');
        return { ok: true, data: data ?? undefined };
    } catch (e) {
        return failed(e, 'Could not place your order. Please try again.');
    }
}

export async function fetchMyShopOrders(): Promise<ShopOrder[]> {
    try {
        return (await backendRequest<ShopOrder[]>('GET', '/api/shop/orders')).data ?? [];
    } catch {
        return [];
    }
}

// ---- Administrators (the backend checks the role) ----

export async function fetchShopAdmin(): Promise<{ settings: ShopSettings; items: ScreenGuard[]; orders: ShopOrder[] } | null> {
    try {
        const overview = (await backendRequest<{ settings: ShopSettings; items: ScreenGuard[] }>('GET', '/api/shop/admin/screen-guards')).data;
        const orders = (await backendRequest<ShopOrder[]>('GET', '/api/shop/admin/orders')).data ?? [];
        return overview ? { ...overview, orders } : null;
    } catch {
        return null;
    }
}

export async function saveShopSettings(settings: ShopSettings): Promise<Result> {
    try {
        await backendRequest('PUT', '/api/shop/admin/settings', { body: settings });
        revalidatePath('/admin/shop');
        revalidatePath('/screen-guard');
        return { ok: true };
    } catch (e) {
        return failed(e, 'Could not save.');
    }
}

export async function setShopOrderStatus(id: string, status: ShopOrderStatus): Promise<Result> {
    try {
        await backendRequest('PUT', `/api/shop/admin/orders/${encodeURIComponent(id)}/status`, { body: { status } });
        revalidatePath('/admin/shop');
        return { ok: true };
    } catch (e) {
        return failed(e, 'Could not update the order.');
    }
}


export async function saveScreenGuard(guard: ScreenGuard): Promise<Result> {
    try {
        const { id, ...input } = guard;
        await backendRequest('PUT', `/api/shop/admin/screen-guards/${encodeURIComponent(id)}`, { body: input });
        revalidatePath('/admin/shop');
        return { ok: true };
    } catch (e) {
        return failed(e, 'Could not save this guard.');
    }
}

export async function saveFestiveTheme(theme: string): Promise<Result> {
    try {
        await backendRequest('PUT', '/api/app/admin/theme', { body: { theme } });
        return { ok: true };
    } catch (e) {
        return failed(e, 'Could not save.');
    }
}

// ---- "Sell this device" ----

export type DeviceMatch = { name: string; img: string | null; brandId: string; modelId: string; best: number | null };

/** The catalog model for what an Android browser reports: a model code ("LE2101") or a name. */
export async function identifyDevice(code: string): Promise<DeviceMatch | null> {
    // Some phones report the name itself ("Pixel 8"), which the table does not need to list.
    const name = ANDROID_MODELS[code.trim().toUpperCase()] ?? code.trim();
    try {
        const models = await searchGlobalModels(name);
        const model = models.find(m => m.name.toLowerCase() === name.toLowerCase());
        if (!model) return null;
        const prices = (await fetchVariants(model.id)).map(v => v.basePrice).filter(p => p > 0);
        return { name: model.name, img: model.img, brandId: model.brandId, modelId: model.id, best: prices.length ? Math.max(...prices) : null };
    } catch {
        return null;
    }
}
