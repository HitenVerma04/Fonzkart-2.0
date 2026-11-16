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

/**
 * How offers are priced for a category: the lowest offer (percent of the max value) and each answer's built-in share
 * (percent of the max value; an admin's rule for the answer replaces it). caps: the most a question takes in all.
 */
export interface PricingSettings {
  category: string;
  minOfferPercent: number;
  defaultMinOfferPercent: number;
  defaults: { questionKey: string; answerKey: string; percent: number }[];
  caps: Record<string, number>;
}

/** A max value worked out from a launch price: kept share of the launch price at the model's age (months). */
export interface MaxValueSuggestion {
  maxValue: number;
  ageMonths: number;
  keptPercent: number;
  tier: 'apple' | 'premium' | 'standard';
}

/** The website's server-action result: { success: true } or { error } (or { success: false, error }). */
export type ActionResult = { success?: boolean; error?: string; message?: string };

const enc = encodeURIComponent;
const get = async <T>(path: string, signal?: AbortSignal) => (await request<T>('GET', path, { signal })).data;
const post = async (path: string, body?: unknown) => (await request<ActionResult>('POST', path, { body: body ?? {} })).data ?? {};
const put = async (path: string, body: unknown) => (await request<ActionResult>('PUT', path, { body })).data ?? {};
/** Create actions answer {created:false} when nothing was made; older servers give no reason, so say the likely ones. */
const create = async (path: string, body: unknown, what: string): Promise<ActionResult> => {
  const r = (await request<ActionResult & { created?: boolean }>('POST', path, { body })).data ?? {};
  if (r.created === false && !r.error) {
    return { error: `The ${what} was not created. Check the name, email and password, and that no account already uses this email or phone number.` };
  }
  return r;
};

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
    create('/api/staff/partners', input, 'partner'),
  updatePartnerAssignment: (partnerId: string, input: { cityId?: string | null; managerId?: string | null; relationshipManagerId?: string | null }) =>
    put(`/api/staff/partners/${enc(partnerId)}/assignment`, input),
  updatePartnerPincodes: (partnerId: string, pincodes: string[]) => put(`/api/cities/partners/${enc(partnerId)}/pincodes`, { pincodes }),
  removePartnerFromCity: (partnerId: string) => post(`/api/cities/partners/${enc(partnerId)}/remove`),

  // Zonal heads (app/admin/zonal-heads)
  zonalHeads: (signal?: AbortSignal) => get<ZonalHead[]>('/api/staff/zonal-heads', signal),
  createZonalHead: (input: { name: string; email: string; phone: string; password: string; cityId?: string }) => create('/api/staff/zonal-heads', input, 'zonal head'),
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
  /** Removes a rule: the answer takes its built-in share again. */
  deleteRule: async (category: string, questionKey: string, answerKey: string): Promise<ActionResult> =>
    (await request<ActionResult>('DELETE', '/api/pricing/rules', { query: { category, questionKey, answerKey } })).data ?? {},
  /** The lowest offer and the built-in share of every answer of a category. */
  pricingSettings: (category: string, signal?: AbortSignal) =>
    request<PricingSettings>('GET', '/api/pricing/settings', { query: { category }, signal }).then(r => r.data),
  saveMinOffer: (minOfferPercent: number) => put('/api/pricing/settings', { minOfferPercent }),
  /** The max value the server's rule suggests for a launch price (₹) and launch month (YYYY-MM). */
  maxValue: (q: { launchPrice: number; launched: string; category: string; brand: string }) =>
    request<MaxValueSuggestion>('GET', '/api/pricing/max-value', {
      query: { launchPrice: String(q.launchPrice), launched: q.launched, category: q.category, brand: q.brand },
    }).then(r => r.data),
};
