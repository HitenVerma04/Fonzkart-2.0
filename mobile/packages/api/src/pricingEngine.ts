// The pricing engine: a device's price sheet (public: the live offer is worked out on the phone from it) and the
// Admin app's view of the engine (overview, suggestions, resales, repair costs, how a max value is kept). Every admin
// call is checked on the server (administrators only).
import type { PriceSheet } from '@fonzkart/core';
import { request } from './client';

/** One step from the max value to the offer, in rupees taken off (negative: given back by the lowest offer). */
export interface PriceBreakdownItem {
  kind: 'value' | 'repair' | 'labour' | 'profit' | 'floor' | 'rounding';
  question: string | null;
  answers: string[];
  part: string | null;
  amount: number;
}

export interface EngineOverview {
  engineVersion: string;
  settings: { minOfferPercent: number; targetMarginPercent: number; logisticsCost: number; autoApply: boolean };
  catalog: { variants: number; priced: number; auto: number; withLaunchPrice: number; models: number; modelsWithLaunchReference: number };
  repairCostSources: Record<string, number>;
  learning: {
    sales: number;
    salesLast90Days: number;
    marginLast90Days: number | null;
    checks: { checkedLast90Days: number; priceChanged?: number; averageChangePercent?: number | null };
    quotesLast30Days: Record<string, number>;
    lastRun: string | null;
  };
  openSuggestions: Record<string, number>;
  /** Part id → name. */
  parts: Record<string, string>;
}

export interface Suggestion {
  id: string;
  kind: 'max_value' | 'data_quality' | 'margin_alert';
  targetKey: string;
  title: string;
  detail: string | null;
  currentValue: number | null;
  suggestedValue: number | null;
  confidence: number | null;
  status: 'open' | 'applied' | 'dismissed' | 'resolved';
  autoApplied: boolean;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
}

export interface DeviceSale {
  id: string;
  orderId: string | null;
  device: string;
  category: string | null;
  purchasePrice: number;
  basePrice: number | null;
  salePrice: number;
  repairCost: number;
  /** JSON: [{part, cost}] */
  repairs: string | null;
  channel: string | null;
  grade: string | null;
  note: string | null;
  soldAt: string;
}

export interface RecordSaleInput {
  orderId?: string;
  /** The order number customers and staff see (#1234), instead of orderId. */
  orderNumber?: number;
  device?: string;
  variant?: string;
  purchasePrice?: number;
  salePrice: number;
  repairs?: { part: string; cost: number }[];
  grade?: 'superb' | 'good' | 'fair' | 'parts';
  channel?: string;
  note?: string;
  /** YYYY-MM-DD */
  soldAt?: string;
}

export interface RepairCostRow {
  id: string;
  category: string;
  brandId: string;
  modelId: string;
  part: string;
  cost: number;
  source: 'admin' | 'official';
  sourceUrl: string | null;
  note: string | null;
}

export interface RepairCostInput {
  category: string;
  part: string;
  cost: number;
  source: 'admin' | 'official';
  brandId?: string;
  modelId?: string;
  sourceUrl?: string;
  note?: string;
}

export interface VariantPricingInfo {
  variantId: string;
  device: string;
  category: string;
  basePrice: number | null;
  mode: 'auto' | 'manual';
  launchPrice: number | null;
  launchMonth: string | null;
  marketFactor: number;
  suggested: number | null;
  history: { oldPrice: number | null; newPrice: number; reason: string; actor: string | null; createdAt: string }[];
}

export interface RunResult {
  recommendations: number;
  autoApplied: number;
  resolved: number;
  byKind: Record<string, number>;
}

const enc = encodeURIComponent;
const data = <T>(p: Promise<{ data: T | null }>) => p.then(r => r.data as T);

export const pricingEngineApi = {
  /** What every answer takes off this device (public). */
  sheet: (device: string, variant: string, signal?: AbortSignal) =>
    data(request<PriceSheet>('GET', '/api/pricing/sheet', { query: { device, variant }, signal })),

  overview: (signal?: AbortSignal) => data(request<EngineOverview>('GET', '/api/pricing/engine/overview', { signal })),
  run: () => data(request<RunResult>('POST', '/api/pricing/engine/run', { body: {} })),
  suggestions: (status: string, signal?: AbortSignal) =>
    data(request<Suggestion[]>('GET', '/api/pricing/engine/suggestions', { query: { status }, signal })),
  decide: (id: string, action: 'apply' | 'dismiss') =>
    data(request<{ success: boolean; status: string; variantsChanged?: number }>('POST', `/api/pricing/engine/suggestions/${enc(id)}`, { body: { action } })),
  sales: (signal?: AbortSignal) => data(request<DeviceSale[]>('GET', '/api/pricing/engine/sales', { signal })),
  recordSale: (input: RecordSaleInput) =>
    data(request<{ success: boolean; id: string; profit: number; marginPercent: number | null }>('POST', '/api/pricing/engine/sales', { body: input })),
  deleteSale: (id: string) => data(request<{ success: boolean }>('DELETE', `/api/pricing/engine/sales/${enc(id)}`)),
  repairCosts: (category: string | undefined, signal?: AbortSignal) =>
    data(request<RepairCostRow[]>('GET', '/api/pricing/engine/repair-costs', { query: category ? { category } : undefined, signal })),
  saveRepairCosts: (rows: RepairCostInput | RepairCostInput[]) =>
    data(request<{ success: boolean; saved: number }>('PUT', '/api/pricing/engine/repair-costs', { body: Array.isArray(rows) ? { rows } : rows })),
  deleteRepairCost: (id: string) => data(request<{ success: boolean }>('DELETE', `/api/pricing/engine/repair-costs/${enc(id)}`)),
  variant: (id: string, signal?: AbortSignal) => data(request<VariantPricingInfo>('GET', `/api/pricing/engine/variants/${enc(id)}`, { signal })),
  setVariant: (id: string, body: { launchPrice?: number; launchMonth?: string; mode?: 'auto' | 'manual' }) =>
    data(request<VariantPricingInfo>('PUT', `/api/pricing/engine/variants/${enc(id)}`, { body })),
  saveSettings: (body: { targetMarginPercent?: number; logisticsCost?: number; autoApply?: boolean; minOfferPercent?: number }) =>
    data(request<Record<string, unknown>>('PUT', '/api/pricing/settings', { body })),
};
