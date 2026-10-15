import { QueryClient, keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isCompletePincode, type Answers } from '@fonzkart/core';
import { authApi } from './auth';
import { MIN_SEARCH_LENGTH, catalogApi, healthApi } from './catalog';
import { quoteApi } from './quote';
import { customerOrdersApi, notificationsApi, type PlaceOrderInput } from './orders';

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

/** Queries tied to the signed-in user; removed on sign-out. */
export const ACCOUNT_KEY = ['account'] as const;

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

export function useQuestionnaire() {
  return useQuery({
    queryKey: ['catalog', 'questionnaire'],
    queryFn: ({ signal }) => quoteApi.questionnaire(signal),
  });
}

/** The final offer. Always fresh: an admin's rule change must show on the next quote. */
export function useOfferPrice(basePrice: number | undefined, answers: Answers | undefined, category: string) {
  return useQuery({
    queryKey: ['quote', 'price', basePrice ?? null, category, answers ?? null],
    queryFn: ({ signal }) => quoteApi.price(basePrice!, answers!, category, signal),
    enabled: basePrice !== undefined && answers !== undefined,
    staleTime: 0,
  });
}

export function usePincodeAvailability(pincode: string) {
  return useQuery({
    queryKey: ['quote', 'pincode', pincode],
    queryFn: ({ signal }) => quoteApi.pincodeAvailable(pincode, signal),
    enabled: isCompletePincode(pincode),
    staleTime: 60_000,
  });
}

export function useProfile(enabled: boolean) {
  return useQuery({
    queryKey: [...ACCOUNT_KEY, 'profile'],
    queryFn: ({ signal }) => authApi.profile(signal),
    enabled,
  });
}

// ------------------------------------------------------------------------------------------------ orders

export const orderKeys = {
  mine: [...ACCOUNT_KEY, 'orders'] as const,
  one: (id: string) => [...ACCOUNT_KEY, 'orders', id] as const,
  notifications: [...ACCOUNT_KEY, 'notifications'] as const,
};

/** How often an open order screen asks for news (besides refreshing when the app comes back to the screen). */
export const LIVE_ORDER_REFRESH_MS = 20_000;

/** The final offer for a device: the server's price, exactly what the order will be booked at. Always fresh. */
export function useQuote(device: string | undefined, variant: string | undefined, answers: Record<string, unknown> | undefined) {
  return useQuery({
    queryKey: ['quote', 'final', device ?? null, variant ?? null, answers ?? null],
    queryFn: ({ signal }) => customerOrdersApi.quote(device!, variant!, answers!, signal),
    enabled: !!device && !!variant && answers !== undefined,
    staleTime: 0,
  });
}

export function useMyOrders(enabled: boolean) {
  return useQuery({
    queryKey: orderKeys.mine,
    queryFn: ({ signal }) => customerOrdersApi.mine(signal),
    enabled,
    staleTime: 0,
    refetchInterval: LIVE_ORDER_REFRESH_MS,
  });
}

export function useMyOrder(id: string | undefined) {
  return useQuery({
    queryKey: orderKeys.one(id ?? ''),
    queryFn: ({ signal }) => customerOrdersApi.one(id!, signal),
    enabled: !!id,
    staleTime: 0,
    refetchInterval: LIVE_ORDER_REFRESH_MS,
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: orderKeys.notifications,
    queryFn: ({ signal }) => notificationsApi.list(signal),
    enabled,
    staleTime: 0,
    refetchInterval: 60_000,
  });
}

/** Places an order; the order lists and inbox are refreshed afterwards. */
export function usePlaceOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaceOrderInput) => customerOrdersApi.place(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: orderKeys.mine });
      void client.invalidateQueries({ queryKey: orderKeys.notifications });
    },
  });
}
