// Catalog editing, the landing page's banner prices and the staff email system (backend: CatalogAdminController,
// EmailHubController). Administrators only, except email, which every staff member uses for their own mailboxes.
import { request } from './client';

type Result = { success?: boolean; id?: string; error?: string };
const enc = encodeURIComponent;
const send = async (method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
  (await request<Result>(method, path, { body })).data ?? {};

export interface BannerPrice {
  id: string;
  categoryKey: string;
  categoryName: string;
  displayPrice: string;
}

export interface EmailSummary {
  id: string;
  subject: string;
  fromEmail: string;
  toEmail: string;
  date: string;
  text: string;
  snippet: string;
  isOutbound: boolean;
  bodyHtml: string | null;
}

export interface EmailList {
  emails: EmailSummary[];
  totalInDb: number;
  totalAccounts: number;
  userRole: string;
  userEmail: string;
  reachableEmails: string[];
}

export const catalogAdminApi = {
  addBrand: (input: { name: string; logo: string; category?: string; priority?: number }) => send('POST', '/api/catalog/admin/brands', input),
  updateBrand: (id: string, input: { name: string; logo: string; priority?: number }) => send('PUT', `/api/catalog/admin/brands/${enc(id)}`, input),
  /** With a category: the brand leaves that category (deleted when it was its last). Without: brand, models, variants. */
  deleteBrand: (id: string, category?: string) =>
    send('DELETE', `/api/catalog/admin/brands/${enc(id)}${category ? `?category=${enc(category)}` : ''}`),

  addModel: (input: { brandId: string; name: string; img: string; category?: string; priority?: number }) =>
    send('POST', '/api/catalog/admin/models', input),
  updateModel: (id: string, input: { brandId: string; name: string; img: string; category?: string; priority?: number }) =>
    send('PUT', `/api/catalog/admin/models/${enc(id)}`, input),
  reorderModels: (items: { id: string; priority: number }[]) => send('PUT', '/api/catalog/admin/models/order', items),
  deleteModel: (id: string) => send('DELETE', `/api/catalog/admin/models/${enc(id)}`),

  addVariant: (input: { modelId: string; name: string; basePrice: number }) => send('POST', '/api/catalog/admin/variants', input),
  updateVariant: (id: string, input: { modelId: string; name: string; basePrice: number }) =>
    send('PUT', `/api/catalog/admin/variants/${enc(id)}`, input),
  deleteVariant: (id: string) => send('DELETE', `/api/catalog/admin/variants/${enc(id)}`),

  bannerPrices: async (signal?: AbortSignal) =>
    (await request<BannerPrice[]>('GET', '/api/content/banner-prices/admin', { signal })).data,
  saveBannerPrice: (identifier: string, displayPrice: string) =>
    send('PUT', `/api/content/banner-prices/${enc(identifier)}`, { displayPrice }),
};

export const emailApi = {
  messages: async (account?: string, signal?: AbortSignal) =>
    (await request<EmailList>('GET', '/api/email/messages', { query: { account }, signal })).data,
  message: async (id: string, signal?: AbortSignal) =>
    (await request<EmailSummary>('GET', `/api/email/messages/${enc(id)}`, { signal })).data,
  accounts: async (signal?: AbortSignal) =>
    (await request<{ email: string; createdAt: string }[]>('GET', '/api/email/accounts', { signal })).data,
  send: async (input: { fromAccount: string; to: string; subject: string; text: string }) =>
    (await request<{ success: boolean; messageId: string }>('POST', '/api/email/send', { body: input })).data,
};
