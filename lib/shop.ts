// The screen guard shop's types and small helpers, for the server and the browser. Reads: lib/shop-server.ts.

export type ScreenGuard = {
    id: string;
    name: string;
    guardType: string;
    brand: string;
    model: string;
    imageUrl: string | null;
    mrp: number;
    price: number;
    isActive: boolean;
    displayOrder: number;
};

export type ShopSettings = { storeEnabled: boolean; discountsEnabled: boolean };
export type ScreenGuardStore = ShopSettings & { items: ScreenGuard[] };

export type ShopOrderStatus = 'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type ShopOrderItem = { screenGuardId: string; name: string; model: string; quantity: number; unitPrice: number; unitMrp: number };
export type ShopOrder = {
    id: string;
    orderNumber: number;
    status: ShopOrderStatus;
    items: ShopOrderItem[];
    total: number;
    name: string;
    phone: string;
    address: string;
    pincode: string;
    paymentMethod: 'cod';
    createdAt: string;
    customerEmail?: string | null;
};

export const SHOP_ORDER_STATUSES: { id: ShopOrderStatus; label: string }[] = [
    { id: 'placed', label: 'Placed' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'shipped', label: 'Shipped' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'cancelled', label: 'Cancelled' },
];

/** How each kind of guard is shown to customers, in the order they are listed for a phone (as in the apps). */
export const GUARD_KINDS: { id: string; title: string; note: string }[] = [
    { id: 'tempered', title: 'Tempered glass', note: 'Everyday armour, crystal clear' },
    { id: 'unbreakable', title: 'Unbreakable', note: 'Gorilla Glass 5 strength' },
    { id: 'matte', title: 'Matte', note: 'No glare, no fingerprints' },
    { id: 'privacy', title: 'Privacy', note: 'Side views blocked' },
    { id: 'clear', title: 'HD clear', note: 'Ultra-clear view' },
    { id: 'full', title: 'Full coverage', note: 'Edge to edge' },
    { id: 'lens', title: 'Camera lens', note: 'Lens protected' },
];

export const guardKind = (id: string) => GUARD_KINDS.find(k => k.id === id) ?? { id, title: id, note: '' };

/** One phone and every kind of guard made for it, kinds in GUARD_KINDS order. */
export type GuardModel = { brand: string; model: string; imageUrl: string | null; guards: ScreenGuard[] };

/** The store's guards grouped by phone (brand and model, ignoring case), phones in store order. */
export function guardsByModel(items: ScreenGuard[]): GuardModel[] {
    const rank = (t: string) => { const i = GUARD_KINDS.findIndex(k => k.id === t); return i < 0 ? GUARD_KINDS.length : i; };
    const byKey = new Map<string, GuardModel>();
    for (const g of items) {
        const key = `${g.brand}|${g.model}`.toLowerCase();
        const found = byKey.get(key);
        if (found) found.guards.push(g);
        else byKey.set(key, { brand: g.brand, model: g.model, imageUrl: g.imageUrl, guards: [g] });
    }
    const models = [...byKey.values()];
    for (const m of models) {
        m.guards.sort((a, b) => rank(a.guardType) - rank(b.guardType));
        m.imageUrl = m.guards.find(g => g.imageUrl)?.imageUrl ?? null;
    }
    return models;
}

/** Percent off, rounded down; 0 when there is no discount. */
export function discountPercent(mrp: number, price: number): number {
    return mrp > 0 && price < mrp ? Math.floor(((mrp - price) / mrp) * 100) : 0;
}
