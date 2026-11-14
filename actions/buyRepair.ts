'use server';

// Buy, Repair, the app carousel and pincode requests on the website: the same backend calls the apps make
// (BuyRepairController, CarouselController, PincodeRequestController). The backend checks every role.
import { revalidatePath } from 'next/cache';
import { backendRequest } from '@/lib/backend';
import type {
    CarouselSlide, CarouselSlideInput, MyPincodes, PincodeRequestForReview, RefurbishedDeviceInput, RefurbishedOrder,
    RefurbishedStore, RepairBooking, RepairPriceInput, RepairPriceList, RepairSlot, RepairStatus,
} from '@/lib/buyRepair';
import type { ShopOrderStatus } from '@/lib/shop';

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
type Answer = { success?: boolean; id?: string; error?: string };

const failed = (e: unknown, fallback: string): { ok: false; error: string } =>
    ({ ok: false, error: e instanceof Error && e.message !== 'Internal error' ? e.message : fallback });

const enc = encodeURIComponent;

/** A call that answers {error} on a refusal (form-style) or throws on a failure. */
async function act(method: 'POST' | 'PUT' | 'DELETE', path: string, body: unknown, fallback: string, paths: string[]): Promise<Result> {
    try {
        const { data } = await backendRequest<Answer>(method, path, { body });
        if (data && typeof data === 'object' && data.error) return { ok: false, error: data.error };
        paths.forEach(p => revalidatePath(p));
        return { ok: true };
    } catch (e) {
        return failed(e, fallback);
    }
}

async function read<T>(path: string, fallback: T, query?: Record<string, string>): Promise<T> {
    try {
        return (await backendRequest<T>('GET', path, { query })).data ?? fallback;
    } catch {
        return fallback;
    }
}

// ---- Buy (customers) ----

export async function fetchBuyStore(): Promise<RefurbishedStore | null> {
    try {
        return (await backendRequest<RefurbishedStore>('GET', '/api/buy/devices')).data;
    } catch {
        return null;
    }
}

export async function placeRefurbishedOrder(input: { deviceId: string; name: string; phone: string; address: string; pincode: string }): Promise<Result<RefurbishedOrder>> {
    try {
        const { data } = await backendRequest<RefurbishedOrder>('POST', '/api/buy/orders', { body: input });
        revalidatePath('/orders');
        revalidatePath('/buy');
        return { ok: true, data: data ?? undefined };
    } catch (e) {
        return failed(e, 'Could not place your order. Please try again.');
    }
}

export async function fetchMyRefurbishedOrders(): Promise<RefurbishedOrder[]> {
    return read<RefurbishedOrder[]>('/api/buy/orders', []);
}

// ---- Repair (customers) ----

export async function fetchRepairPrices(): Promise<RepairPriceList | null> {
    try {
        return (await backendRequest<RepairPriceList>('GET', '/api/repair/prices')).data;
    } catch {
        return null;
    }
}

export async function bookRepair(input: { repairPriceId: string; visitDate: string; slot: RepairSlot; name: string; phone: string; address: string; pincode: string }): Promise<Result<RepairBooking>> {
    try {
        const { data } = await backendRequest<RepairBooking>('POST', '/api/repair/bookings', { body: input });
        revalidatePath('/orders');
        return { ok: true, data: data ?? undefined };
    } catch (e) {
        return failed(e, 'Could not book the repair. Please try again.');
    }
}

export async function fetchMyRepairBookings(): Promise<RepairBooking[]> {
    return read<RepairBooking[]>('/api/repair/bookings', []);
}

// ---- Buy (administrators) ----

export async function fetchBuyAdmin(): Promise<{ store: RefurbishedStore; orders: RefurbishedOrder[] } | null> {
    try {
        const store = (await backendRequest<RefurbishedStore>('GET', '/api/buy/admin/devices')).data;
        const orders = (await backendRequest<RefurbishedOrder[]>('GET', '/api/buy/admin/orders')).data ?? [];
        return store ? { store, orders } : null;
    } catch {
        return null;
    }
}

export async function saveRefurbishedDevice(id: string | null, input: RefurbishedDeviceInput): Promise<Result> {
    return id
        ? act('PUT', `/api/buy/admin/devices/${enc(id)}`, input, 'Could not save the device.', ['/admin/refurbished', '/buy'])
        : act('POST', '/api/buy/admin/devices', input, 'Could not add the device.', ['/admin/refurbished', '/buy']);
}

export async function deleteRefurbishedDevice(id: string): Promise<Result> {
    return act('DELETE', `/api/buy/admin/devices/${enc(id)}`, undefined, 'Could not delete the device.', ['/admin/refurbished', '/buy']);
}

export async function setBuyEnabled(enabled: boolean): Promise<Result> {
    return act('PUT', '/api/buy/admin/settings', { enabled }, 'Could not change the Buy switch.', ['/admin/refurbished', '/buy']);
}

export async function setRefurbishedOrderStatus(id: string, status: ShopOrderStatus): Promise<Result> {
    return act('PUT', `/api/buy/admin/orders/${enc(id)}/status`, { status }, 'Could not change the status.', ['/admin/refurbished']);
}

// ---- Repair (administrators) ----

export async function fetchRepairAdmin(): Promise<{ list: RepairPriceList; bookings: RepairBooking[] } | null> {
    try {
        const list = (await backendRequest<RepairPriceList>('GET', '/api/repair/admin/prices')).data;
        const bookings = (await backendRequest<RepairBooking[]>('GET', '/api/repair/admin/bookings')).data ?? [];
        return list ? { list, bookings } : null;
    } catch {
        return null;
    }
}

export async function saveRepairPrice(id: string | null, input: RepairPriceInput): Promise<Result> {
    return id
        ? act('PUT', `/api/repair/admin/prices/${enc(id)}`, input, 'Could not save the price.', ['/admin/repairs', '/repair'])
        : act('POST', '/api/repair/admin/prices', input, 'Could not add the price.', ['/admin/repairs', '/repair']);
}

export async function deleteRepairPrice(id: string): Promise<Result> {
    return act('DELETE', `/api/repair/admin/prices/${enc(id)}`, undefined, 'Could not delete the price.', ['/admin/repairs', '/repair']);
}

export async function setRepairEnabled(enabled: boolean): Promise<Result> {
    return act('PUT', '/api/repair/admin/settings', { enabled }, 'Could not change the Repair switch.', ['/admin/repairs', '/repair']);
}

export async function setRepairBookingStatus(id: string, status: RepairStatus): Promise<Result> {
    return act('PUT', `/api/repair/admin/bookings/${enc(id)}/status`, { status }, 'Could not change the status.', ['/admin/repairs']);
}

// ---- App carousel (administrators) ----

export async function fetchCarouselAdmin(): Promise<CarouselSlide[] | null> {
    try {
        return (await backendRequest<CarouselSlide[]>('GET', '/api/content/carousel/admin')).data ?? [];
    } catch {
        return null;
    }
}

export async function saveCarouselSlide(id: string | null, input: CarouselSlideInput): Promise<Result> {
    return id
        ? act('PUT', `/api/content/carousel/${enc(id)}`, input, 'Could not save the card.', ['/admin/carousel'])
        : act('POST', '/api/content/carousel', input, 'Could not add the card.', ['/admin/carousel']);
}

export async function deleteCarouselSlide(id: string): Promise<Result> {
    return act('DELETE', `/api/content/carousel/${enc(id)}`, undefined, 'Could not delete the card.', ['/admin/carousel']);
}

export async function reorderCarousel(items: { id: string; displayOrder: number }[]): Promise<Result> {
    return act('PUT', '/api/content/carousel/order', items, 'Could not move the card.', ['/admin/carousel']);
}

// ---- Pincode requests ----

export async function fetchMyPincodes(): Promise<MyPincodes | null> {
    try {
        return (await backendRequest<MyPincodes>('GET', '/api/pincode-requests/mine')).data;
    } catch {
        return null;
    }
}

export async function askForPincodes(pincodes: string[], note: string): Promise<Result> {
    return act('POST', '/api/pincode-requests', { pincodes, note }, 'Could not send the request.', ['/admin/service-areas']);
}

export async function cancelPincodeRequest(id: string): Promise<Result> {
    return act('DELETE', `/api/pincode-requests/${enc(id)}`, undefined, 'Could not cancel the request.', ['/admin/service-areas']);
}

export async function fetchPincodeRequests(status: 'pending' | 'decided'): Promise<PincodeRequestForReview[] | null> {
    try {
        return (await backendRequest<PincodeRequestForReview[]>('GET', '/api/pincode-requests', { query: { status } })).data ?? [];
    } catch {
        return null;
    }
}

export async function approvePincodeRequest(id: string, pincodes: string[]): Promise<Result> {
    return act('POST', `/api/pincode-requests/${enc(id)}/approve`, { pincodes }, 'Could not approve the request.', ['/admin/pincode-requests', '/admin/partners']);
}

export async function rejectPincodeRequest(id: string, note: string): Promise<Result> {
    return act('POST', `/api/pincode-requests/${enc(id)}/reject`, { note }, 'Could not reject the request.', ['/admin/pincode-requests']);
}
