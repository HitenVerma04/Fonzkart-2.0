// The screen guard cart: which guards and how many. Prices are never stored here; screens price the cart from the
// latest store data. Kept on the phone (SecureStore; localStorage in the web build) so it survives a restart.
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { ScreenGuard } from '@fonzkart/api';

export type CartLine = { screenGuardId: string; quantity: number };

export const MAX_QUANTITY = 5;
const KEY = 'fonzkart.cart';

let lines: CartLine[] = [];
let touched = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function save() {
  const json = JSON.stringify(lines);
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(KEY, json);
    } catch {
      // private browsing: the cart lives in memory only
    }
  } else {
    SecureStore.setItemAsync(KEY, json).catch(() => undefined);
  }
}

function update(next: CartLine[]) {
  lines = next;
  touched = true;
  emit();
  save();
}

const isLine = (l: unknown): l is CartLine =>
  !!l && typeof (l as CartLine).screenGuardId === 'string' && Number.isInteger((l as CartLine).quantity) && (l as CartLine).quantity > 0;

// The saved cart, loaded once at start (unless the customer has already changed the cart meanwhile).
void (async () => {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    if (!raw || touched) return;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      lines = parsed.filter(isLine).map(l => ({ screenGuardId: l.screenGuardId, quantity: Math.min(l.quantity, MAX_QUANTITY) }));
      emit();
    }
  } catch {
    // unreadable: start with an empty cart
  }
})();

/** Sets how many of a guard are in the cart (0 removes it), at most MAX_QUANTITY. */
export function setQuantity(screenGuardId: string, quantity: number) {
  const q = Math.max(0, Math.min(MAX_QUANTITY, Math.round(quantity)));
  const others = lines.filter(l => l.screenGuardId !== screenGuardId);
  if (q === 0) {
    update(others);
  } else if (lines.some(l => l.screenGuardId === screenGuardId)) {
    update(lines.map(l => (l.screenGuardId === screenGuardId ? { ...l, quantity: q } : l)));
  } else {
    update([...lines, { screenGuardId, quantity: q }]);
  }
}

export function clearCart() {
  update([]);
}

/** Drops guards that are no longer sold. */
export function pruneCart(soldIds: Set<string>) {
  const kept = lines.filter(l => soldIds.has(l.screenGuardId));
  if (kept.length !== lines.length) update(kept);
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => lines,
  );
}

export type PricedLine = { item: ScreenGuard; quantity: number };

/** The cart priced from the store: lines with their guards, MRP total, amount to pay and the saving. */
export function priceCart(cart: CartLine[], items: ScreenGuard[] | undefined) {
  const byId = new Map((items ?? []).map(i => [i.id, i]));
  const rows: PricedLine[] = [];
  for (const line of cart) {
    const item = byId.get(line.screenGuardId);
    if (item) rows.push({ item, quantity: line.quantity });
  }
  const mrpTotal = rows.reduce((sum, r) => sum + r.item.mrp * r.quantity, 0);
  const payTotal = rows.reduce((sum, r) => sum + r.item.price * r.quantity, 0);
  const count = rows.reduce((sum, r) => sum + r.quantity, 0);
  return { rows, mrpTotal, payTotal, savings: mrpTotal - payTotal, count };
}
