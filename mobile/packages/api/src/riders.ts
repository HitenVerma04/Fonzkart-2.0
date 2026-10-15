// Field executives (riders) for staff: the website's Field Executives page (backend /api/riders). Partners manage
// their own team; zonal heads and admins more (rules on the server).
import { request } from './client';
import type { AppOrder } from './orders';

export interface TeamRider {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  partnerId: string | null;
  createdAt: string;
  partner: { id: string; name: string; email: string; phone: string | null } | null;
  orders: Pick<AppOrder, 'id' | 'status' | 'price' | 'device'>[];
}

export interface RidersOverview {
  riders: TeamRider[];
  partners: { id: string; name: string; email: string; phone: string | null; pincodes?: string[] }[];
  currentUserRole: string;
  currentUserId: string;
}

type Result = { success?: boolean; error?: string };

export const ridersApi = {
  overview: async (signal?: AbortSignal) => (await request<RidersOverview>('GET', '/api/riders/overview', { signal })).data,
  /** Phone as the website stores it (+91 and 10 digits); partnerId: the partner the executive works for. */
  add: async (input: { name: string; phone: string; email?: string; partnerId?: string }) =>
    (await request<Result>('POST', '/api/riders', { body: input })).data,
  remove: async (id: string) => (await request<Result>('DELETE', `/api/riders/${encodeURIComponent(id)}`)).data,
  movePartner: async (riderId: string, partnerId: string | null) =>
    (await request<Result>('PUT', `/api/riders/${encodeURIComponent(riderId)}/partner`, { body: { partnerId } })).data,
};
