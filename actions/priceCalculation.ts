'use server';

import { backendRequest } from '@/lib/backend';

/**
 * The offer for a max value and the answers, worked out by the Spring Boot backend's pricing engine, the one the
 * website, the Customer app and the Partner app's pickup check all use. With the device (model and variant as the
 * catalog names them) it is priced from that model's own repair costs, exactly as its quote and order; without it,
 * repairs are scaled from the max value alone.
 */
export async function calculatePrice(basePrice: number, answers: Record<string, unknown>, category: string = 'smartphone',
    device?: { name: string; variant: string }) {
    const body = device ? { basePrice, answers, category, device: device.name, variant: device.variant } : { basePrice, answers, category };
    const { data } = await backendRequest<number>('POST', '/api/pricing/calculate', { body });
    return Number(data ?? 0);
}
