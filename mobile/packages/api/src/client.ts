import { config } from '@fonzkart/core';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const TIMEOUT_MS = 15_000;

type Query = Record<string, string | undefined>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** Sign-in style endpoints: ask for the session token in X-Auth-Token instead of a cookie (MobileClients). */
  issuesToken?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  /** The new session token, when the server issued one (sign-in, sign-up of a super admin, email verification). */
  authToken: string | null;
}

// The signed-in user's token, sent as "Authorization: Bearer" on every request (set by SessionProvider).
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function buildUrl(base: string, path: string, query?: Query): string {
  const params = Object.entries(query ?? {})
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  return base + path + (params.length ? '?' + params.join('&') : '');
}

/** Calls the backend. Fails with ApiError on HTTP errors and after 15 s without an answer. */
export async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { query, body, signal, issuesToken } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (issuesToken) headers['X-Client'] = 'mobile';
  try {
    const response = await fetch(buildUrl(config.apiUrl, path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { error?: unknown } | null;
      const message = typeof detail?.error === 'string' ? detail.error : `Server answered ${response.status}`;
      throw new ApiError(message, response.status);
    }
    const text = await response.text();
    return { data: (text ? JSON.parse(text) : null) as T, authToken: response.headers.get('X-Auth-Token') };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted && !signal?.aborted) throw new ApiError('The server took too long to answer', 0);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** GET a JSON document from the backend. */
export async function getJson<T>(path: string, query?: Query, signal?: AbortSignal): Promise<T> {
  return (await request<T>('GET', path, { query, signal })).data;
}

/** A photo to upload (expo-image-picker / expo-camera give a local file URI). */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * Uploads an image (POST /api/uploads, multipart field "file"); returns its URL path, e.g. /uploads/123-front.jpg.
 * Needs a signed-in user or executive. Images only, up to 10 MB.
 */
export async function uploadImage(file: UploadFile, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  // React Native's FormData takes { uri, name, type } for a file on the device.
  form.append('file', file as unknown as Blob);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(buildUrl(config.apiUrl, '/api/uploads'), { method: 'POST', headers, body: form, signal });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new ApiError(typeof detail?.error === 'string' ? detail.error : `Upload failed (${response.status})`, response.status);
  }
  return ((await response.json()) as { url: string }).url;
}
