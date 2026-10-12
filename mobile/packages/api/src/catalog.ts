// Public catalog endpoints of the Spring Boot backend (backend/README.md, "Catalog API").
import { getJson } from './client';

export interface Brand {
  id: string;
  name: string;
  logo: string | null;
  categories: string[];
  priority?: number | null;
}

export interface Model {
  id: string;
  brandId: string;
  name: string;
  img: string | null;
  category: string;
  priority?: number | null;
}

export interface Variant {
  id: string;
  modelId: string;
  name: string;
  basePrice: number;
}

/** The backend returns [] for search queries shorter than this. */
export const MIN_SEARCH_LENGTH = 2;

export const catalogApi = {
  brands: (category?: string, signal?: AbortSignal) =>
    getJson<Brand[]>('/api/catalog/brands', { category }, signal),
  brand: (id: string, signal?: AbortSignal) =>
    getJson<Brand>(`/api/catalog/brands/${encodeURIComponent(id)}`, undefined, signal),
  models: (brandId: string, category?: string, signal?: AbortSignal) =>
    getJson<Model[]>('/api/catalog/models', { brandId, category }, signal),
  searchModels: async (query: string, signal?: AbortSignal) =>
    query.trim().length < MIN_SEARCH_LENGTH
      ? []
      : getJson<Model[]>('/api/catalog/models/search', { query: query.trim() }, signal),
  variants: (modelId: string, signal?: AbortSignal) =>
    getJson<Variant[]>('/api/catalog/variants', { modelId }, signal),
};

/** Spring Boot health (public). Used by the app shells to show whether the server is reachable. */
export const healthApi = {
  status: (signal?: AbortSignal) => getJson<{ status: string }>('/actuator/health', undefined, signal),
};
