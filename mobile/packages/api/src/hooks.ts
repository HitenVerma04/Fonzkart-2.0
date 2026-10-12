import { QueryClient, keepPreviousData, useQuery } from '@tanstack/react-query';
import { MIN_SEARCH_LENGTH, catalogApi, healthApi } from './catalog';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60_000, retry: 2 },
    },
  });
}

export const catalogKeys = {
  brands: (category?: string) => ['catalog', 'brands', category ?? null] as const,
  brand: (id: string) => ['catalog', 'brand', id] as const,
  models: (brandId: string, category?: string) => ['catalog', 'models', brandId, category ?? null] as const,
  search: (query: string) => ['catalog', 'search', query.trim().toLowerCase()] as const,
  variants: (modelId: string) => ['catalog', 'variants', modelId] as const,
};

export function useBrands(category?: string) {
  return useQuery({
    queryKey: catalogKeys.brands(category),
    queryFn: ({ signal }) => catalogApi.brands(category, signal),
  });
}

export function useBrand(id: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.brand(id ?? ''),
    queryFn: ({ signal }) => catalogApi.brand(id!, signal),
    enabled: !!id,
  });
}

export function useModels(brandId: string | undefined, category?: string) {
  return useQuery({
    queryKey: catalogKeys.models(brandId ?? '', category),
    queryFn: ({ signal }) => catalogApi.models(brandId!, category, signal),
    enabled: !!brandId,
  });
}

export function useModelSearch(query: string) {
  return useQuery({
    queryKey: catalogKeys.search(query),
    queryFn: ({ signal }) => catalogApi.searchModels(query, signal),
    enabled: query.trim().length >= MIN_SEARCH_LENGTH,
    placeholderData: keepPreviousData,
  });
}

export function useVariants(modelId: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.variants(modelId ?? ''),
    queryFn: ({ signal }) => catalogApi.variants(modelId!, signal),
    enabled: !!modelId,
  });
}

export function useServerHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => healthApi.status(signal),
    staleTime: 30_000,
    retry: 1,
  });
}
