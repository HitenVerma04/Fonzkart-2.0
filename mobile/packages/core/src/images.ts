import { sellCategoryOf } from './categories';
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

/**
 * A model's picture, or null when the catalog shows a phone photo for another kind of device. The website keeps phone
 * photos in a plain brand folder (/models/samsung/…) and every other category's pictures in their own folder
 * (/models/samsung-tablet/…, /models/apple-smartwatch/…), so a plain-folder picture on a watch or tablet is a stand-in
 * (e.g. many smartwatches show the Galaxy S25 Ultra). Null shows the neutral placeholder instead of a wrong device.
 */
export function modelImage(img: string | null | undefined, category: string | undefined): string | null {
  const value = img?.trim();
  if (!value) return null;
  if (sellCategoryOf(category) !== 'smartphone' && /^\/models\/[A-Za-z0-9]+\//.test(value)) return null;
  return value;
}
