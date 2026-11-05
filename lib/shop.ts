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

/** Percent off, rounded down; 0 when there is no discount. */
export function discountPercent(mrp: number, price: number): number {
    return mrp > 0 && price < mrp ? Math.floor(((mrp - price) / mrp) * 100) : 0;
}
