// Orders and notifications of the Spring Boot backend (backend/README.md, "Orders API"): the customer's side
// (Customer app), the field executive's (Partner app, rider mode) and the staff's (Partner and Admin apps). The
// same endpoints serve the website, so an order changed in any app or on the website looks the same everywhere.
import { request } from './client';

/** An order as the backend returns it (the website's lib/store.ts → Order). */
export interface AppOrder {
  id: string;
  orderNumber: number;
  userId: string;
  user: { id: string; name: string; email: string; phone: string | null } | null;
  device: string;
  price: number;
  /** When it was placed (ISO). */
  date: string;
  status: string;
  address: string;
  pincode: string | null;
  location: { lat: number; lng: number } | null;
  riderId: string | null;
  partnerId: string | null;
  answers: unknown;
  riderAnswers: unknown;
  verificationImages: string[];
  offeredPrice: number | null;
  hubStatus: string | null;
  hubHandoverAt: string | null;
  hubReceivedBy: string | null;
}

/** The customer's view adds who is coming. */
export interface CustomerOrder extends AppOrder {
  executive: { name: string; phone: string } | null;
}

export interface Quote {
  price: number;
  basePrice: number;
  category: string;
}

export interface PlaceOrderInput {
  /** The model name and variant name, as the catalog shows them. */
  device: string;
  variant: string;
  address: string;
  pincode: string;
  location: { lat: number; lng: number } | null;
  answers: Record<string, unknown>;
}

export interface PlacedOrder {
  success: true;
  id: string;
  orderNumber: number;
  /** The price the order was booked at (calculated by the server, the same as the quote). */
  price: number;
}

export interface AppNotification {
  id: string;
  userId: string | null;
  role: string | null;
  riderId: string | null;
  title: string;
  message: string;
  type: string;
  orderId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationList {
  success: boolean;
  notifications?: AppNotification[];
}

const enc = encodeURIComponent;

// ------------------------------------------------------------------------------------------------ customer

export const customerOrdersApi = {
  /** The price an order for this device and these answers gets (exactly what placeOrder records). */
  quote: async (device: string, variant: string, answers: Record<string, unknown>, signal?: AbortSignal) =>
    (await request<Quote>('POST', '/api/orders/quote', { body: { device, variant, answers }, signal })).data,

  place: async (input: PlaceOrderInput) => (await request<PlacedOrder>('POST', '/api/orders', { body: input })).data,

  mine: async (signal?: AbortSignal) => (await request<CustomerOrder[]>('GET', '/api/orders', { signal })).data,

  one: async (id: string, signal?: AbortSignal) =>
    (await request<CustomerOrder>('GET', `/api/orders/${enc(id)}`, { signal })).data,

  /** Asks Fonzkart to start serving a pincode. */
  requestServiceArea: async (pincode: string, phone: string, address: string) =>
    (await request<{ success: boolean }>('POST', '/api/orders/service-area-requests', { body: { pincode, phone, address } })).data,
};

export const notificationsApi = {
  list: async (signal?: AbortSignal) =>
    (await request<NotificationList>('GET', '/api/notifications', { signal })).data.notifications ?? [],
  markRead: async (id: string) => (await request<{ success: boolean }>('POST', `/api/notifications/${enc(id)}/read`)).data,
  markAllRead: async () => (await request<{ success: boolean }>('POST', '/api/notifications/read-all')).data,
};

export const accountApi = {
  /** Deletes (anonymises) the signed-in customer's account; their orders are kept. Staff accounts: refused. */
  deleteAccount: async () => (await request<{ success: boolean }>('DELETE', '/api/users/me')).data,
};

// ------------------------------------------------------------------------------------------------ executive

export interface Executive {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  partnerId: string | null;
}

export interface VerificationInput {
  /** The price the executive offers after checking the device. */
  offeredPrice: number;
  verificationImages: string[];
  riderAnswers: { notes?: string; answers?: Record<string, unknown>; [key: string]: unknown };
  /** 'failed': the customer declined or the device could not be collected. */
  status?: 'failed';
}

export const executiveApi = {
  /** Phone login. First time (no password yet): { needsOnboarding, id }; then onboard() sets the password. */
  login: async (phone: string, password?: string) =>
    request<{ success?: boolean; error?: string; needsOnboarding?: boolean; id?: string; redirectTo?: string }>(
      'POST', '/api/executive/login', { body: { phone, password }, issuesToken: true }),
  onboard: async (id: string, password: string) =>
    request<{ success?: boolean; error?: string; redirectTo?: string }>(
      'POST', '/api/executive/onboard', { body: { id, password }, issuesToken: true }),
  session: async (signal?: AbortSignal) =>
    (await request<{ executive: Executive | null }>('GET', '/api/executive/session', { signal })).data.executive,

  orders: async (signal?: AbortSignal) => (await request<AppOrder[]>('GET', '/api/executive/orders', { signal })).data,
  order: async (id: string, signal?: AbortSignal) =>
    (await request<AppOrder>('GET', `/api/executive/orders/${enc(id)}`, { signal })).data,
  /** picked_up: confirm the pickup at the current price; completed: delivered to the hub; failed: could not pick up. */
  setStatus: async (id: string, status: 'picked_up' | 'completed' | 'failed', reason?: string) =>
    (await request<{ success: boolean }>('POST', `/api/executive/orders/${enc(id)}/status`, { body: { status, reason } })).data,
  submitVerification: async (id: string, input: VerificationInput) =>
    (await request<{ success: boolean; status: string }>('POST', `/api/executive/orders/${enc(id)}/verification`, { body: input })).data,
  markPaid: async (id: string, reference?: string) =>
    (await request<{ success: boolean; payout: unknown }>('POST', `/api/executive/orders/${enc(id)}/payout`, { body: { reference } })).data,

  notifications: async (signal?: AbortSignal) =>
    (await request<NotificationList>('GET', '/api/executive/notifications', { signal })).data.notifications ?? [],
  markRead: async (id: string) =>
    (await request<{ success: boolean }>('POST', `/api/executive/notifications/${enc(id)}/read`)).data,
  markAllRead: async () => (await request<{ success: boolean }>('POST', '/api/executive/notifications/read-all')).data,
};

// ------------------------------------------------------------------------------------------------ staff

export interface OrderPermissions {
  assignPartner: boolean;
  assignRider: boolean;
  approvePrice: boolean;
  manage: boolean;
  bulk: boolean;
  delete: boolean;
}

export interface StaffRider extends Executive {
  createdAt: string;
  partner: { name: string; pincodes: string[] } | null;
}

export interface StaffPartner {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  pincodes: string[];
  relationshipManager: { name: string; phone: string | null } | null;
  /** May route orders to this partner. */
  routable: boolean;
}

export interface StaffOrdersPage {
  /** 'executive' for a FIELD_EXECUTIVE account (their own orders only). */
  view: 'staff' | 'executive';
  role: string;
  orders: AppOrder[];
  riders: StaffRider[];
  partners: StaffPartner[];
  permissions: OrderPermissions;
  /** A partner's own pincodes. */
  pincodes: string[];
  /** A zonal head's cities. */
  territory: string[];
}

export type OrderAction =
  | { action: 'approve_verification'; overridePrice?: number | string }
  | { action: 'reject_verification'; reason?: string }
  | { action: 'fail_order'; reason?: string }
  | { action: 'restore_order' }
  | { action: 'update_hub_status'; hubStatus: 'handed_over' | 'pending' }
  | { action: 'mark_payout_paid'; reference?: string }
  | { action: 'delete_order' };

export type BulkAction =
  | { action: 'bulk_fail'; ids: string[]; reason?: string }
  | { action: 'bulk_restore'; ids: string[] }
  | { action: 'bulk_hub_handover'; ids: string[]; hubStatus?: 'handed_over' | 'pending' }
  | { action: 'bulk_delete'; ids: string[] };

export const staffOrdersApi = {
  page: async (riderId?: string, signal?: AbortSignal) =>
    (await request<StaffOrdersPage>('GET', '/api/staff/orders', { query: { riderId }, signal })).data,
  unassignedCount: async (signal?: AbortSignal) =>
    (await request<{ count: number }>('GET', '/api/staff/orders/unassigned-count', { signal })).data.count,
  assignPartner: async (id: string, partnerId: string) =>
    (await request<{ success: boolean; changed: boolean }>('POST', `/api/staff/orders/${enc(id)}/partner`, { body: { partnerId } })).data,
  assignRider: async (id: string, riderId: string) =>
    (await request<{ success: boolean }>('POST', `/api/staff/orders/${enc(id)}/rider`, { body: { riderId } })).data,
  act: async (id: string, action: OrderAction) =>
    (await request<Record<string, unknown>>('POST', `/api/staff/orders/${enc(id)}`, { body: action })).data,
  remove: async (id: string) => (await request<{ success: boolean }>('DELETE', `/api/staff/orders/${enc(id)}`)).data,
  bulk: async (action: BulkAction) =>
    (await request<{ success: boolean; count: number }>('POST', '/api/staff/orders/bulk', { body: action })).data,
};
