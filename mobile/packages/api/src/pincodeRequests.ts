// Pincode requests (backend /api/pincode-requests): a partner asks to serve more pincodes in the Partner app; an
// admin or the zonal head of the partner's city approves all or some of them, or rejects the request, in the Admin
// app. Approving adds the pincodes to the partner (and to its city's list when missing).
import { useQuery } from '@tanstack/react-query';
import { ApiError, request } from './client';

export type PincodeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface PincodeRequestItem {
  id: string;
  partnerId: string;
  pincodes: string[];
  note: string | null;
  status: PincodeRequestStatus;
  /** The pincodes that were added (all or some of `pincodes`). */
  approved: string[];
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface PincodeRequestCity {
  id: string;
  name: string;
  pincodes: string[];
}

/** What the Admin app lists: the request with its partner and the partner's city. */
export interface PincodeRequestForReview extends PincodeRequestItem {
  partner: { id: string; name: string; email: string; phone: string | null; pincodes: string[] } | null;
  city: PincodeRequestCity | null;
}

export interface MyPincodes {
  pincodes: string[];
  city: PincodeRequestCity | null;
  requests: PincodeRequestItem[];
}

type Result = { success?: boolean; error?: string; approved?: number; addedToCity?: number };
const base = '/api/pincode-requests';
const enc = encodeURIComponent;

export const pincodeRequestsApi = {
  mine: async (signal?: AbortSignal) => (await request<MyPincodes>('GET', `${base}/mine`, { signal })).data,
  ask: async (pincodes: string[], note: string) => (await request<Result>('POST', base, { body: { pincodes, note } })).data ?? {},
  cancel: async (id: string) => (await request<Result>('DELETE', `${base}/${enc(id)}`)).data ?? {},
  list: async (status: 'pending' | 'decided', signal?: AbortSignal) =>
    (await request<PincodeRequestForReview[]>('GET', base, { query: { status }, signal })).data ?? [],
  /** `pincodes`: the ones to approve (all of the request's when left out). */
  approve: async (id: string, pincodes?: string[], note?: string) =>
    (await request<Result>('POST', `${base}/${enc(id)}/approve`, { body: { pincodes, note } })).data ?? {},
  reject: async (id: string, note?: string) => (await request<Result>('POST', `${base}/${enc(id)}/reject`, { body: { note } })).data ?? {},
};

/** What to show when loading fails: a server without this feature yet answers 404. */
export function pincodeRequestsError(error: unknown): string {
  if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
    return 'Pincode requests are not switched on yet: the Fonzkart server needs its latest update. Please try again after it is live.';
  }
  return error instanceof Error ? error.message : 'Could not load pincode requests.';
}

export const pincodeRequestKeys = {
  mine: ['staff', 'pincode-requests', 'mine'] as const,
  list: (status: 'pending' | 'decided') => ['staff', 'pincode-requests', status] as const,
};

/** Partner app: my pincodes, my city's list and my requests. */
export function useMyPincodeRequests(enabled: boolean) {
  return useQuery({ queryKey: pincodeRequestKeys.mine, queryFn: ({ signal }) => pincodeRequestsApi.mine(signal), enabled });
}

/** Admin app: requests to decide (pending) or already decided. */
export function usePincodeRequests(status: 'pending' | 'decided', enabled = true) {
  return useQuery({
    queryKey: pincodeRequestKeys.list(status),
    queryFn: ({ signal }) => pincodeRequestsApi.list(status, signal),
    enabled,
    refetchInterval: status === 'pending' ? 30_000 : false,
  });
}
