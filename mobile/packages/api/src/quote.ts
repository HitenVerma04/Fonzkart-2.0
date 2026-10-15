// The device questionnaire, the price calculation and the pickup pincode check. All public: the website shows the
// final offer before asking anyone to sign in.
import type { Answers, Questionnaire } from '@fonzkart/core';
import { getJson, request } from './client';

export const quoteApi = {
  questionnaire: (signal?: AbortSignal) => getJson<Questionnaire>('/api/catalog/questionnaire', undefined, signal),

  /** The final offer for a variant: base price minus the deductions of the evaluation rules (server side only). */
  price: async (basePrice: number, answers: Answers, category: string, signal?: AbortSignal) =>
    (await request<number | null>('POST', '/api/pricing/calculate', { body: { basePrice, answers, category }, signal })).data,

  /** True when Fonzkart picks up from this pincode. */
  pincodeAvailable: (pincode: string, signal?: AbortSignal) =>
    getJson<boolean>('/api/cities/pincode-availability', { pincode }, signal),
};
