import { config } from '@fonzkart/core';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const TIMEOUT_MS = 15_000;

type Query = Record<string, string | undefined>;

export function buildUrl(base: string, path: string, query?: Query): string {
  const params = Object.entries(query ?? {})
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  return base + path + (params.length ? '?' + params.join('&') : '');
}

/** GET a JSON document from the backend. Fails with ApiError on HTTP errors and after 15 s without an answer. */
export async function getJson<T>(path: string, query?: Query, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const response = await fetch(buildUrl(config.apiUrl, path, query), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(`Server answered ${response.status}`, response.status);
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted && !signal?.aborted) throw new ApiError('The server took too long to answer', 0);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
