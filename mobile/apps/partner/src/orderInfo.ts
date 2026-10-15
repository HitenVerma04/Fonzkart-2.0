// Reading an order for the executive and the partner: pickup time, how the customer is paid, where to go.
import type { AppOrder } from '@fonzkart/api';
import { formatInr, parseAnswers, payoutOf } from '@fonzkart/core';

export function slotOf(o: AppOrder): string {
  const a = parseAnswers(o.answers);
  if (a.isExpress) return 'Express';
  return typeof a.scheduledSlot === 'string' ? a.scheduledSlot : '';
}

/** The day the customer chose ("Fri 16 Oct"), if any. */
export function dayOf(o: AppOrder): string {
  const iso = parseAnswers(o.answers).scheduledDate;
  if (typeof iso !== 'string') return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

/** How to pay the customer: method and the details they gave (UPI ID or bank account), as the website records them. */
export function paymentDetails(o: AppOrder): { label: string; lines: string[]; paid: boolean; amount: string } {
  const a = parseAnswers(o.answers);
  const payout = payoutOf(o);
  const lines: string[] = [];
  if (payout.method === 'upi' && typeof a.upiId === 'string') lines.push(`UPI ID: ${a.upiId}`);
  if (payout.method === 'bank_transfer') {
    if (typeof a.bankAccountName === 'string') lines.push(`Account holder: ${a.bankAccountName}`);
    if (typeof a.bankAccount === 'string') lines.push(`Account: ${a.bankAccount}`);
    if (typeof a.bankIfsc === 'string') lines.push(`IFSC: ${a.bankIfsc}`);
  }
  if (payout.paid && payout.reference) lines.push(`Reference: ${payout.reference}`);
  return { label: payout.methodLabel, lines, paid: payout.paid, amount: formatInr(payout.amount) };
}

/** The customer's contact number: the one given at booking, else the account's. */
export function customerPhone(o: AppOrder): string | null {
  const a = parseAnswers(o.answers);
  return (typeof a.phone === 'string' && a.phone) || o.user?.phone || null;
}

/** A maps link to the pickup: the pinned location when there is one, else the address. */
export function directionsUrl(o: AppOrder): string {
  const destination = o.location ? `${o.location.lat},${o.location.lng}` : `${o.address} ${o.pincode ?? ''}`.trim();
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
