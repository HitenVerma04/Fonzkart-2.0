import { useSyncExternalStore } from 'react';
import type { Answers } from '@fonzkart/core';

/** The device being valued, from variant choice to the final offer. Kept in memory only. */
export interface QuoteDraft {
  modelId: string;
  modelName: string;
  img: string;
  variantId: string;
  variantName: string;
  basePrice: number;
  /** Sell category (website ids: smartphone, watch, smarttv...), sent to the price calculation. */
  category: string;
  answers?: Answers;
}

let draft: QuoteDraft | null = null;
const listeners = new Set<() => void>();

function update(next: QuoteDraft | null) {
  draft = next;
  listeners.forEach(listener => listener());
}

export function startQuote(next: Omit<QuoteDraft, 'answers'>) {
  update({ ...next });
}

export function saveAnswers(answers: Answers) {
  if (draft) update({ ...draft, answers });
}

export function useQuoteDraft(): QuoteDraft | null {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => draft,
  );
}
