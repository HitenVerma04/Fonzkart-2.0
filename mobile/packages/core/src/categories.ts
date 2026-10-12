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
