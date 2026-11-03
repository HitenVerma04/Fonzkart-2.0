// The screen guard shop (backend: ShopController). Customers browse guards and order them (cash on delivery);
// administrators edit the guards, switch the store and its discounts on or off, and move orders along.
import { request } from './client';

const enc = encodeURIComponent;
type Result = { success?: boolean; id?: string; error?: string };
const send = async (method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
  (await request<Result>(method, path, { body })).data ?? {};

export type GuardType = 'tempered' | 'privacy' | 'matte' | 'clear' | 'full' | 'lens';

/** The guard types, in the order the store lists them. */
export const GUARD_TYPES: { id: GuardType; label: string }[] = [
  { id: 'tempered', label: 'Tempered glass' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'matte', label: 'Matte' },
  { id: 'clear', label: 'HD clear' },
  { id: 'full', label: 'Full coverage' },
  { id: 'lens', label: 'Camera lens' },
];

export interface ScreenGuard {
  id: string;
  name: string;
  guardType: GuardType;
  /** Phone brand and model it fits, e.g. "Apple", "iPhone 15". */
  brand: string;
  model: string;
  /** Website path (/uploads/...) or https URL, or null. */
  imageUrl: string | null;
  /** Price before discount, whole rupees. */
  mrp: number;
  /** What the customer pays, whole rupees; equals mrp when discounts are switched off. */
  price: number;
  isActive: boolean;
  displayOrder: number;
}

export interface ShopSettings {
  /** The store is shown to customers. */
  storeEnabled: boolean;
  /** Sale prices (and struck-through MRPs) are shown; off = everything sells at its MRP. */
  discountsEnabled: boolean;
}

/** What customers see: the switches and the active guards (prices already reflect the discount switch). */
export interface ScreenGuardStore extends ShopSettings {
  items: ScreenGuard[];
}

export type ScreenGuardInput = {
  name: string;
  guardType: GuardType;
  brand: string;
  model: string;
  imageUrl: string | null;
  mrp: number;
  price: number;
  isActive: boolean;
  displayOrder?: number;
};

export type ShopOrderStatus = 'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export const SHOP_ORDER_STATUSES: { id: ShopOrderStatus; label: string }[] = [
  { id: 'placed', label: 'Placed' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

export interface ShopOrderItem {
  screenGuardId: string;
  name: string;
  model: string;
  quantity: number;
  /** Prices at the time of the order, whole rupees. */
  unitPrice: number;
  unitMrp: number;
}

export interface ShopOrder {
  id: string;
  orderNumber: number;
  status: ShopOrderStatus;
  items: ShopOrderItem[];
  /** Sum of unitPrice × quantity. */
  total: number;
  name: string;
  phone: string;
  address: string;
  pincode: string;
  paymentMethod: 'cod';
  createdAt: string;
  /** Staff lists only: who ordered. */
  customerEmail?: string | null;
}

export type PlaceShopOrderInput = {
  items: { screenGuardId: string; quantity: number }[];
  name: string;
  /** 10 digits. */
  phone: string;
  address: string;
  /** 6 digits. */
  pincode: string;
};

export const shopApi = {
  /** Public. */
  store: async (signal?: AbortSignal) => (await request<ScreenGuardStore>('GET', '/api/shop/screen-guards', { signal })).data,
  /** Signed-in customer: the server prices the order from its own data and returns it. */
  placeOrder: async (input: PlaceShopOrderInput) => (await request<ShopOrder>('POST', '/api/shop/orders', { body: input })).data,
  myOrders: async (signal?: AbortSignal) => (await request<ShopOrder[]>('GET', '/api/shop/orders', { signal })).data,
};

/** Administrators. */
export const shopAdminApi = {
  overview: async (signal?: AbortSignal) =>
    (await request<{ settings: ShopSettings; items: ScreenGuard[] }>('GET', '/api/shop/admin/screen-guards', { signal })).data,
  add: (input: ScreenGuardInput) => send('POST', '/api/shop/admin/screen-guards', input),
  update: (id: string, input: ScreenGuardInput) => send('PUT', `/api/shop/admin/screen-guards/${enc(id)}`, input),
  remove: (id: string) => send('DELETE', `/api/shop/admin/screen-guards/${enc(id)}`),
  saveSettings: (settings: ShopSettings) => send('PUT', '/api/shop/admin/settings', settings),
  orders: async (signal?: AbortSignal) => (await request<ShopOrder[]>('GET', '/api/shop/admin/orders', { signal })).data,
  setOrderStatus: (id: string, status: ShopOrderStatus) => send('PUT', `/api/shop/admin/orders/${enc(id)}/status`, { status }),
};

/** Percent off, rounded down (₹949 → ₹749 is 21%); 0 when there is no discount. */
export function discountPercent(mrp: number, price: number): number {
  return mrp > 0 && price < mrp ? Math.floor(((mrp - price) / mrp) * 100) : 0;
}
