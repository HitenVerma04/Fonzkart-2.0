// "Pick up where you left off": how far the customer got in valuing a device (brand → model → variant → questions
// → offer), kept on the phone so it is still there after going back to Home or closing the app. Each sell screen
// saves its step; the furthest step is kept until another model is picked. Booking the pickup or closing the card
// clears it.
//
// On phones it is a small JSON file in the app's documents folder (SecureStore is meant for secrets and warns above
// about 2 KB, which the answers can pass); on web, localStorage. Saved progress older than 30 days is dropped.
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import type { QuoteDraft } from './quoteDraft';

export type SellStage = 'models' | 'variants' | 'questions' | 'offer';

export interface SellProgress {
  stage: SellStage;
  /** Sell category id (smartphone, laptop...). */
  category: string;
  brandId?: string;
  brandName?: string;
  modelId?: string;
  modelName?: string;
  img?: string;
  /** From the variant on: the quote being built (with `resume` while answering, `answers` at the offer). */
  draft?: QuoteDraft;
  /** Questions in this device's check, for the card's "Question 3 of 7". */
  stepCount?: number;
  savedAt: number;
}

const KEY = 'fonzkart.sellProgress';
const FILE_NAME = 'sell-progress.json';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const RANK: Record<SellStage, number> = { models: 0, variants: 1, questions: 2, offer: 3 };

function read(): SellProgress | null {
  try {
    let text: string | null = null;
    if (Platform.OS === 'web') text = globalThis.localStorage?.getItem(KEY) ?? null;
    else {
      const file = new File(Paths.document, FILE_NAME);
      text = file.exists ? file.textSync() : null;
    }
    if (!text) return null;
    const saved = JSON.parse(text) as SellProgress;
    if (!saved || !(saved.stage in RANK) || typeof saved.savedAt !== 'number' || Date.now() - saved.savedAt > MAX_AGE_MS) return null;
    return saved;
  } catch {
    return null;
  }
}

function write(next: SellProgress | null) {
  try {
    if (Platform.OS === 'web') {
      if (next) globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
      else globalThis.localStorage?.removeItem(KEY);
      return;
    }
    const file = new File(Paths.document, FILE_NAME);
    if (!next) {
      if (file.exists) file.delete();
      return;
    }
    if (!file.exists) file.create();
    file.writeSync(JSON.stringify(next));
  } catch {
    // Not saved this time (storage full or unavailable): the card just won't come back after a restart.
  }
}

let current: SellProgress | null | undefined; // undefined: not read from storage yet
const listeners = new Set<() => void>();

function get(): SellProgress | null {
  if (current === undefined) current = read();
  return current;
}

function set(next: SellProgress | null) {
  current = next;
  write(next);
  listeners.forEach(listener => listener());
}

/**
 * Whether a newly reached step replaces what is saved. A deeper or equal step always does. An earlier step does only
 * when it is about another device: picking a different model or variant starts over, but looking at a brand list, at
 * the variants of the model already being valued, or going back over the questions after seeing the price, keeps
 * the further progress.
 */
export function replacesSaved(saved: SellProgress | null, next: Omit<SellProgress, 'savedAt'>): boolean {
  if (!saved) return true;
  if (RANK[next.stage] >= RANK[saved.stage]) return true;
  if (next.stage === 'models') return false;
  if (next.modelId !== saved.modelId) return true;
  return !!next.draft && !!saved.draft && next.draft.variantId !== saved.draft.variantId;
}

/** Saves the step the customer has reached in the sell flow (see replacesSaved). */
export function recordSellStep(next: Omit<SellProgress, 'savedAt'>) {
  if (!replacesSaved(get(), next)) return;
  set({ ...next, savedAt: Date.now() });
}

export function clearSellProgress() {
  if (get() !== null) set(null);
}

export function useSellProgress(): SellProgress | null {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get,
    () => null,
  );
}

/** How far along the saved progress is, 0–1, for the card's bar. */
export function progressFraction(p: SellProgress): number {
  switch (p.stage) {
    case 'models': return 0.2;
    case 'variants': return 0.35;
    case 'questions': {
      const count = Math.max(1, p.stepCount ?? 1);
      const step = Math.min(p.draft?.resume?.step ?? 0, count);
      return 0.45 + 0.45 * (step / count);
    }
    case 'offer': return 0.95;
  }
}

/** The card's two lines: which device, and what comes next. */
export function progressText(p: SellProgress, categoryLabel: string): { device: string; next: string } {
  switch (p.stage) {
    case 'models':
      return { device: [p.brandName, categoryLabel].filter(Boolean).join(' · '), next: 'Choose your model' };
    case 'variants':
      return { device: p.modelName ?? categoryLabel, next: 'Choose your variant' };
    case 'questions': {
      const device = p.draft ? `${p.draft.modelName} · ${p.draft.variantName}` : p.modelName ?? categoryLabel;
      const step = (p.draft?.resume?.step ?? 0) + 1;
      return { device, next: p.stepCount ? `Question ${Math.min(step, p.stepCount)} of ${p.stepCount}` : 'Answer a few questions' };
    }
    case 'offer':
      return { device: p.draft ? `${p.draft.modelName} · ${p.draft.variantName}` : p.modelName ?? categoryLabel, next: 'Your price is ready' };
  }
}
