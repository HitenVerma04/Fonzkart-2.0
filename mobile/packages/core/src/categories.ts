// The device categories customers can sell, in the website's order (components/sell/CategorySelector.tsx).
// Ids are the ones the catalog API accepts; it also understands the aliases (mobile, smartwatch, tv, ipad).
export const SELL_CATEGORIES = [
  { id: 'smartphone', name: 'Smartphones' },
  { id: 'tablet', name: 'Tablets' },
  { id: 'camera', name: 'Cameras' },
  { id: 'laptop', name: 'Laptops' },
  { id: 'watch', name: 'Smartwatches' },
  { id: 'smarttv', name: 'Smart TVs' },
  { id: 'console', name: 'Consoles' },
  { id: 'desktop', name: 'Desktops' },
  { id: 'earbuds', name: 'Earbuds' },
] as const;

export type SellCategoryId = (typeof SELL_CATEGORIES)[number]['id'];

export function categoryName(id: string | undefined): string | undefined {
  return SELL_CATEGORIES.find(c => c.id === id)?.name;
}

// Older catalog rows use other names for the same category (the catalog API treats them as aliases).
const SELL_CATEGORY_ALIASES: Record<string, SellCategoryId> = {
  mobile: 'smartphone',
  ipad: 'tablet',
  smartwatch: 'watch',
  tv: 'smarttv',
};

/**
 * The website's sell-category id for a model's stored category, so a device found by search is valued exactly
 * like the same device chosen through its category (the price rules match the category name exactly).
 */
export function sellCategoryOf(category: string | undefined): string {
  const key = (category ?? '').trim().toLowerCase();
  return SELL_CATEGORY_ALIASES[key] ?? (key || 'smartphone');
}
