// Buying refurbished devices and booking repairs (backend: BuyRepairController). Customers browse and order or book;
// administrators edit listings and prices, switch each service on or off, and move orders and bookings along.
import { request } from './client';
import type { ShopOrderStatus } from './shop';

const enc = encodeURIComponent;
type Result = { success?: boolean; id?: string; error?: string };
const send = async (method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
  (await request<Result>(method, path, { body })).data ?? {};

// ---- Buy ----

export type DeviceGrade = 'superb' | 'good' | 'fair';

/** The condition grades, best first. */
export const DEVICE_GRADES: { id: DeviceGrade; label: string; detail: string }[] = [
  { id: 'superb', label: 'Superb', detail: 'Looks like new, with no visible marks.' },
  { id: 'good', label: 'Good', detail: 'Light marks you may notice up close.' },
  { id: 'fair', label: 'Fair', detail: 'Visible signs of use. Works perfectly.' },
];

export interface RefurbishedDevice {
  id: string;
  name: string;
  brand: string;
  /** e.g. "128 GB" or "8 GB / 128 GB". */
  storage: string;
  grade: DeviceGrade;
  warrantyMonths: number;
  imageUrl: string | null;
  mrp: number;
  price: number;
  stock: number;
  isActive: boolean;
  displayOrder: number;
}

export type RefurbishedDeviceInput = Omit<RefurbishedDevice, 'id' | 'displayOrder'> & { displayOrder?: number };

export interface RefurbishedStore {
  enabled: boolean;
  items: RefurbishedDevice[];
}

export interface RefurbishedOrder {
  id: string;
  orderNumber: number;
  status: ShopOrderStatus;
  deviceId: string;
  deviceName: string;
  storage: string;
  grade: DeviceGrade;
  warrantyMonths: number;
  imageUrl: string | null;
  /** Prices at the time of the order, whole rupees. */
  price: number;
  mrp: number;
  name: string;
  phone: string;
  address: string;
  pincode: string;
  paymentMethod: 'cod';
  createdAt: string;
  /** Staff lists only: who ordered. */
  customerEmail?: string | null;
}

export type PlaceRefurbishedOrderInput = { deviceId: string; name: string; phone: string; address: string; pincode: string };

export const buyApi = {
  store: async (signal?: AbortSignal) => (await request<RefurbishedStore>('GET', '/api/buy/devices', { signal })).data,
  /** Signed-in customer: the server prices the order and takes the device from stock. */
  placeOrder: async (input: PlaceRefurbishedOrderInput) => (await request<RefurbishedOrder>('POST', '/api/buy/orders', { body: input })).data,
  myOrders: async (signal?: AbortSignal) => (await request<RefurbishedOrder[]>('GET', '/api/buy/orders', { signal })).data,
};

export const buyAdminApi = {
  overview: async (signal?: AbortSignal) => (await request<RefurbishedStore>('GET', '/api/buy/admin/devices', { signal })).data,
  add: (input: RefurbishedDeviceInput) => send('POST', '/api/buy/admin/devices', input),
  update: (id: string, input: RefurbishedDeviceInput) => send('PUT', `/api/buy/admin/devices/${enc(id)}`, input),
  remove: (id: string) => send('DELETE', `/api/buy/admin/devices/${enc(id)}`),
  setEnabled: (enabled: boolean) => send('PUT', '/api/buy/admin/settings', { enabled }),
  orders: async (signal?: AbortSignal) => (await request<RefurbishedOrder[]>('GET', '/api/buy/admin/orders', { signal })).data,
  setOrderStatus: (id: string, status: ShopOrderStatus) => send('PUT', `/api/buy/admin/orders/${enc(id)}/status`, { status }),
};

// ---- Repair ----

export type RepairIssue = 'screen' | 'battery' | 'charging' | 'camera' | 'speaker' | 'back';

export const REPAIR_ISSUES: { id: RepairIssue; label: string; detail: string }[] = [
  { id: 'screen', label: 'Screen replacement', detail: 'Cracked, black or unresponsive display' },
  { id: 'battery', label: 'Battery replacement', detail: 'Drains fast or shuts down' },
  { id: 'charging', label: 'Charging port', detail: 'Loose, or will not charge' },
  { id: 'camera', label: 'Camera', detail: 'Blurry, cracked lens or not opening' },
  { id: 'speaker', label: 'Speaker and mic', detail: 'Low sound, or callers cannot hear you' },
  { id: 'back', label: 'Back glass', detail: 'Cracked back panel' },
];

export type RepairSlot = 'morning' | 'afternoon' | 'evening';

export const REPAIR_SLOTS: { id: RepairSlot; label: string; time: string }[] = [
  { id: 'morning', label: 'Morning', time: '9 am to 12 pm' },
  { id: 'afternoon', label: 'Afternoon', time: '12 pm to 4 pm' },
  { id: 'evening', label: 'Evening', time: '4 pm to 8 pm' },
];

export type RepairStatus = 'booked' | 'confirmed' | 'completed' | 'cancelled';

export const REPAIR_STATUSES: { id: RepairStatus; label: string }[] = [
  { id: 'booked', label: 'Booked' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export interface RepairPrice {
  id: string;
  brand: string;
  model: string;
  issue: RepairIssue;
  price: number;
  isActive: boolean;
  displayOrder: number;
}

export type RepairPriceInput = Omit<RepairPrice, 'id' | 'displayOrder'> & { displayOrder?: number };

export interface RepairPriceList {
  enabled: boolean;
  items: RepairPrice[];
}

export interface RepairBooking {
  id: string;
  bookingNumber: number;
  status: RepairStatus;
  brand: string;
  model: string;
  issue: RepairIssue;
  /** The price at the time of the booking, whole rupees. */
  price: number;
  /** YYYY-MM-DD */
  visitDate: string;
  slot: RepairSlot;
  name: string;
  phone: string;
  address: string;
  pincode: string;
  createdAt: string;
  /** Staff lists only: who booked. */
  customerEmail?: string | null;
}

export type BookRepairInput = {
  repairPriceId: string;
  visitDate: string;
  slot: RepairSlot;
  name: string;
  phone: string;
  address: string;
  pincode: string;
};

export const repairApi = {
  prices: async (signal?: AbortSignal) => (await request<RepairPriceList>('GET', '/api/repair/prices', { signal })).data,
  /** Signed-in customer: the server prices the booking from its own list. */
  book: async (input: BookRepairInput) => (await request<RepairBooking>('POST', '/api/repair/bookings', { body: input })).data,
  myBookings: async (signal?: AbortSignal) => (await request<RepairBooking[]>('GET', '/api/repair/bookings', { signal })).data,
};

export const repairAdminApi = {
  overview: async (signal?: AbortSignal) => (await request<RepairPriceList>('GET', '/api/repair/admin/prices', { signal })).data,
  add: (input: RepairPriceInput) => send('POST', '/api/repair/admin/prices', input),
  update: (id: string, input: RepairPriceInput) => send('PUT', `/api/repair/admin/prices/${enc(id)}`, input),
  remove: (id: string) => send('DELETE', `/api/repair/admin/prices/${enc(id)}`),
  setEnabled: (enabled: boolean) => send('PUT', '/api/repair/admin/settings', { enabled }),
  bookings: async (signal?: AbortSignal) => (await request<RepairBooking[]>('GET', '/api/repair/admin/bookings', { signal })).data,
  setStatus: (id: string, status: RepairStatus) => send('PUT', `/api/repair/admin/bookings/${enc(id)}/status`, { status }),
};
