import { config } from './config';

/**
 * Turns a catalog picture reference into a URL the phone can load. The catalog stores website paths
 * ("/models/apple/x.png", "/uploads/x.png"), full URLs and occasionally data URIs.
 */
export function imageUrl(ref: string | null | undefined, webUrl: string = config.webUrl): string | null {
  const value = ref?.trim();
  if (!value) return null;
  if (/^(https?:|data:)/i.test(value)) return value;
  if (value.startsWith('//')) return 'https:' + value;
  return webUrl + (value.startsWith('/') ? value : '/' + value);
}
