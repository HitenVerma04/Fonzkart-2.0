import { useSyncExternalStore } from 'react';
import type { Answers } from '@fonzkart/core';

/** The device being valued, from variant choice to the final offer. Kept in memory; a copy goes into the saved sell
 * progress (sellProgress.ts) so "Pick up where you left off" can put it back. */
export interface QuoteDraft {
  modelId: string;
  modelName: string;
  img: string;
  variantId: string;
  variantName: string;
  basePrice: number;
  /** Sell category (website ids: smartphone, watch, smarttv...), sent to the price calculation. */
  category: string;
  /** The finished answers (set when the last question is done). */
  answers?: Answers;
  /** A check put back from saved progress: the question to open on and the answers given so far. */
  resume?: { step: number; answers: Answers };
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
  if (draft) update({ ...draft, answers, resume: undefined });
}

/** Puts back a draft from saved progress, answers and question position included. */
export function restoreQuote(saved: QuoteDraft) {
  update({ ...saved });
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
