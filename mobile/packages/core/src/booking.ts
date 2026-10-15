// The pickup booking rules of the website's booking steps (components/sell/FinalQuote.tsx), so the apps offer the
// same days, slots, express window and payment options, and send the same order answers.
import { PAYOUT_METHOD_LABELS } from './orderStatus';

export const PICKUP_SLOTS = ['10:00 AM - 02:00 PM', '03:00 PM - 07:00 PM'] as const;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface PickupDay {
  /** 0–3: the position in the list. */
  index: number;
  weekday: string;
  date: number;
  /** The day as the website sends it (scheduledDate): an ISO timestamp of that day. */
  iso: string;
  isToday: boolean;
}

/** Four pickup days, starting tomorrow after 4 PM. */
export function pickupDays(now: Date = new Date()): PickupDay[] {
  const offset = now.getHours() >= 16 ? 1 : 0;
  return Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() + i + offset);
    return {
      index: i,
      weekday: WEEKDAYS[d.getDay()]!,
      date: d.getDate(),
      iso: d.toISOString(),
      isToday: d.getDate() === now.getDate() && d.getMonth() === now.getMonth(),
    };
  });
}

/** Today the morning slot closes at 11 AM and the afternoon slot at 4 PM; other days have both. */
export function availableSlots(day: PickupDay | undefined, now: Date = new Date()): string[] {
  if (!day?.isToday) return [...PICKUP_SLOTS];
  const hour = now.getHours();
  return PICKUP_SLOTS.filter(slot => (slot.startsWith('10:00') ? hour < 11 : hour < 16));
}

/** Express pickup is offered between 10 AM and 4 PM. */
export function expressAvailable(now: Date = new Date()): boolean {
  const hour = now.getHours();
  return hour >= 10 && hour < 16;
}

export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'amazon_voucher' | 'flipkart_voucher';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; detail: string }[] = [
  { id: 'cash', label: PAYOUT_METHOD_LABELS.cash!, detail: 'Paid by the executive at pickup.' },
  { id: 'upi', label: PAYOUT_METHOD_LABELS.upi!, detail: 'Sent to your UPI ID after pickup.' },
  { id: 'bank_transfer', label: PAYOUT_METHOD_LABELS.bank_transfer!, detail: 'Sent to your bank account after pickup.' },
  { id: 'amazon_voucher', label: PAYOUT_METHOD_LABELS.amazon_voucher!, detail: 'An Amazon e-gift card code by email or phone.' },
  { id: 'flipkart_voucher', label: PAYOUT_METHOD_LABELS.flipkart_voucher!, detail: 'A Flipkart e-gift card code by email or phone.' },
];

export interface BookingDetails {
  phone: string;
  address: string;
  pincode: string;
  location: { lat: number; lng: number } | null;
  detectedAddress: string;
  day: PickupDay | undefined;
  slot: string;
  isExpress: boolean;
  paymentMethod: PaymentMethod;
  upiId: string;
  bankAccount: string;
  bankIfsc: string;
  bankAccountName: string;
}

/** What is still missing before the booking can be sent, in the website's order (empty: ready). */
export function bookingProblems(b: BookingDetails): string[] {
  const problems: string[] = [];
  if (b.phone.replace(/\D/g, '').length !== 10) problems.push('Enter your 10-digit mobile number.');
  if (!b.address.trim() && !b.location) problems.push('Enter your pickup address or use your location.');
  if (!/^\d{6}$/.test(b.pincode)) problems.push('Enter the 6-digit pincode.');
  if (!b.isExpress && !b.slot) problems.push('Choose a pickup time.');
  if (b.paymentMethod === 'upi' && !b.upiId.trim()) problems.push('Enter your UPI ID.');
  if (b.paymentMethod === 'bank_transfer' && (!b.bankAccount.trim() || !b.bankIfsc.trim() || !b.bankAccountName.trim())) {
    problems.push('Enter the account holder, account number and IFSC.');
  }
  return problems;
}

/** The order's answers as the website sends them: the device answers plus the booking (FinalQuote → placeOrder). */
export function bookingAnswers(deviceAnswers: Record<string, unknown>, b: BookingDetails): Record<string, unknown> {
  return {
    ...deviceAnswers,
    phone: b.phone.replace(/\D/g, ''),
    scheduledDate: b.day?.iso,
    scheduledSlot: b.isExpress ? '' : b.slot,
    isExpress: b.isExpress,
    detectedAddress: b.detectedAddress,
    paymentMethod: b.paymentMethod,
    upiId: b.paymentMethod === 'upi' ? b.upiId.trim() : undefined,
    bankAccount: b.paymentMethod === 'bank_transfer' ? b.bankAccount.trim() : undefined,
    bankIfsc: b.paymentMethod === 'bank_transfer' ? b.bankIfsc.trim().toUpperCase() : undefined,
    bankAccountName: b.paymentMethod === 'bank_transfer' ? b.bankAccountName.trim() : undefined,
  };
}

/**
 * An order's device text ("iPhone 13 (128GB)") as model and variant names, split like the website's
 * findVariantByName(): everything before the last " (…)" is the model.
 */
export function splitDevice(device: string): { model: string; variant: string } | null {
  const match = /(.+)\s\((.+)\)/.exec(device);
  return match ? { model: match[1]!.trim(), variant: match[2]!.trim() } : null;
}
