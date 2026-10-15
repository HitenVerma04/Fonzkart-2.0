// Staff administration endpoints of the backend (the website's admin pages): users and roles, partners, zonal heads,
// cities, the RM dashboard and pricing rules. Every call is checked on the server against the caller's role.
import { request } from './client';
import type { AppOrder } from './orders';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  cityId: string | null;
  pincodes: string[];
  managerId: string | null;
  relationshipManagerId: string | null;
  createdAt: string;
}

export interface City {
  id: string;
  name: string;
  isActive: boolean;
  pincodes: string[];
  displayOrder: number;
  isFeatured: boolean;
  managerId: string | null;
}

export interface CityWithUsers extends City {
  users: StaffUser[];
  zonalHeads: StaffUser[];
  partners: StaffUser[];
}

export interface PartnerOverviewItem extends StaffUser {
  city: City | null;
  manager: StaffUser | null;
  relationshipManager: StaffUser | null;
}

export interface PartnersOverview {
  partners: PartnerOverviewItem[];
  zonalHeads: StaffUser[];
  availableCities: City[];
  relationshipManagers: StaffUser[];
}

export interface ZonalHead extends StaffUser {
  managedCities: City[];
  managedUsers: (StaffUser & { city: City | null })[];
}

export interface StaffDirectory {
  superAdmins: StaffUser[];
  admins: StaffUser[];
  zonalHeads: StaffUser[];
  relationshipManagers: StaffUser[];
  partners: StaffUser[];
  riders: { id: string; name: string; phone: string; status: string; partnerId: string | null }[];
  fieldExecutiveUsers: { id: string; name: string; phone: string | null; status: string; partnerId: string | null }[];
}

export interface RmPartner extends StaffUser {
  riders: { id: string; name: string; phone: string }[];
  manager: StaffUser | null;
  city: City | null;
  orders: AppOrder[];
  unassignedOrders: AppOrder[];
  assignedOrders: AppOrder[];
  delayedOrders: AppOrder[];
}

export interface EvaluationRule {
  id: string;
  category: string;
  questionKey: string;
  answerKey: string;
  label: string;
  deductionAmount: number;
  deductionPercent: number;
}

/** The website's server-action result: { success: true } or { error } (or { success: false, error }). */
export type ActionResult = { success?: boolean; error?: string; message?: string };

const enc = encodeURIComponent;
const get = async <T>(path: string, signal?: AbortSignal) => (await request<T>('GET', path, { signal })).data;
const post = async (path: string, body?: unknown) => (await request<ActionResult>('POST', path, { body: body ?? {} })).data ?? {};
const put = async (path: string, body: unknown) => (await request<ActionResult>('PUT', path, { body })).data ?? {};

export const adminApi = {
  // Users and roles (app/admin/admins)
  directory: (signal?: AbortSignal) => get<StaffDirectory>('/api/staff/directory', signal),
  addAdmin: (email: string) => post('/api/staff/admins', { email }),
  removeAdmin: (email: string) => post('/api/staff/admins/remove', { email }),
  grantZonalHead: (email: string) => post('/api/staff/zonal-heads/grant', { email }),
  grantRelationshipManager: (email: string) => post('/api/staff/relationship-managers/grant', { email }),
  removeRole: (email: string) => post('/api/staff/roles/remove', { email }),

  // Partners (app/admin/partners)
  partners: (signal?: AbortSignal) => get<PartnersOverview>('/api/staff/partners/overview', signal),
  grantPartner: (email: string, cityId?: string, managerId?: string) => post('/api/staff/partners/grant', { email, cityId, managerId }),
  createPartner: (input: { name: string; email: string; phone: string; password: string; cityId?: string; managerId?: string; relationshipManagerId?: string }) =>
    post('/api/staff/partners', input),
  updatePartnerAssignment: (partnerId: string, input: { cityId?: string | null; managerId?: string | null; relationshipManagerId?: string | null }) =>
    put(`/api/staff/partners/${enc(partnerId)}/assignment`, input),
  updatePartnerPincodes: (partnerId: string, pincodes: string[]) => put(`/api/cities/partners/${enc(partnerId)}/pincodes`, { pincodes }),
  removePartnerFromCity: (partnerId: string) => post(`/api/cities/partners/${enc(partnerId)}/remove`),

  // Zonal heads (app/admin/zonal-heads)
  zonalHeads: (signal?: AbortSignal) => get<ZonalHead[]>('/api/staff/zonal-heads', signal),
  createZonalHead: (input: { name: string; email: string; phone: string; password: string; cityId?: string }) => post('/api/staff/zonal-heads', input),
  assignCity: async (zonalHeadId: string, cityId: string) => {
    await request<null>('POST', `/api/staff/zonal-heads/${enc(zonalHeadId)}/cities`, { body: { cityId } });
  },
  unassignCity: async (zonalHeadId: string, cityId: string) => {
    await request<null>('DELETE', `/api/staff/zonal-heads/${enc(zonalHeadId)}/cities/${enc(cityId)}`);
  },

  // RM dashboard (app/admin/rm-dashboard)
  rmDashboard: (signal?: AbortSignal) => get<{ partners: RmPartner[]; totalDelayed: number }>('/api/staff/rm-dashboard', signal),

  // Cities (app/admin/cities)
  cities: (signal?: AbortSignal) => get<{ cities: CityWithUsers[]; isZonalHead: boolean }>('/api/cities/overview', signal),
  registerHub: async (cityName: string) => { await request<null>('POST', '/api/cities/hubs', { body: { cityName } }); },
  setCityPincodes: async (cityId: string, pincodes: string[]) => { await request<null>('PUT', `/api/cities/${enc(cityId)}/pincodes`, { body: { pincodes } }); },
  setCityActive: async (cityId: string, isActive: boolean) => { await request<null>('PUT', `/api/cities/${enc(cityId)}/active`, { body: { isActive } }); },
  setCityFeatured: async (cityId: string, isFeatured: boolean) => { await request<null>('PUT', `/api/cities/${enc(cityId)}/featured`, { body: { isFeatured } }); },
  setCityDisplayOrder: async (cityId: string, order: number) => { await request<null>('PUT', `/api/cities/${enc(cityId)}/display-order`, { body: { order } }); },
  homepageCities: (signal?: AbortSignal) => get<City[]>('/api/cities/homepage', signal),

  // Pricing rules (app/admin/category/[slug])
  pricingRules: (category: string, signal?: AbortSignal) =>
    request<EvaluationRule[]>('GET', '/api/pricing/rules', { query: { category }, signal }).then(r => r.data),
  upsertRule: (rule: Omit<EvaluationRule, 'id'>) => put('/api/pricing/rules', rule),
};
