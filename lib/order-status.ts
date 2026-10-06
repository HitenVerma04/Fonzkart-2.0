// The order lifecycle as every screen shows it: the statuses stored in "Order".status, their names, the customer
// tracker steps and the payout state. Pure functions only, so client components and server code share them and
// the customer tracker, the executive's list and the admin panel can never disagree about where an order is.
//
//   Pending Pickup ──(executive assigned)──> assigned ──(price unchanged)──> picked_up ──> completed (at the hub)
//                                               │   ↑
//                          (price changed)      ▼   │ (rejected: re-check)
//                                     pending_verification ──(approved)──> picked_up
//   Any status before completed can become failed; staff may restore a failed order.
//
// Data kept in the order's `answers` JSON (besides the customer's evaluation answers):
//   priceReview   { quotedPrice, requestedPrice, requestedAt, decision: 'pending'|'approved'|'rejected',
//                   decidedAt?, decidedBy?, approvedPrice?, reason? }   the latest price review
//   quotedPrice   the price quoted at booking, kept once an approved revision replaced Order.price
//   payout        { status: 'paid', method, amount, reference?, paidAt, paidBy }   set by "Mark paid"
//   hubStatus, hubHandoverAt, hubReceivedBy, failLog, restoreLog, adminRejectionLog (unchanged)

export const ORDER_STATUS = {
    PENDING: 'Pending Pickup',
    ASSIGNED: 'assigned',
    PRICE_REVIEW: 'pending_verification',
    PICKED_UP: 'picked_up',
    COMPLETED: 'completed',
    FAILED: 'failed',
} as const;

const S = ORDER_STATUS;

/** Statuses in which a partner or executive may still be (re)assigned: before the device is collected. */
export const ASSIGNABLE_STATUSES: string[] = [S.PENDING, S.ASSIGNED];

/** Older rows used capitalised statuses ('Completed', 'Cancelled'); compare case-insensitively. */
export const normalizeStatus = (status: string | null | undefined) => (status || '').trim().toLowerCase();

export const isCompleted = (status: string | null | undefined) => normalizeStatus(status) === S.COMPLETED;
export const isFailed = (status: string | null | undefined) => ['failed', 'cancelled', 'unpicked'].includes(normalizeStatus(status));
export const isPickedUpOrLater = (status: string | null | undefined) => [S.PICKED_UP, S.COMPLETED].includes(normalizeStatus(status) as any);
export const isAssignable = (status: string | null | undefined) => ASSIGNABLE_STATUSES.map(normalizeStatus).includes(normalizeStatus(status));

export function parseAnswers(raw: unknown): Record<string, any> {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, any>;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }
    return {};
}

export type Tone = 'amber' | 'blue' | 'orange' | 'purple' | 'green' | 'red' | 'gray';

const LABELS: Record<string, { staff: string; customer: string; tone: Tone }> = {
    [normalizeStatus(S.PENDING)]: { staff: 'To be assigned', customer: 'Order placed', tone: 'amber' },
    [S.ASSIGNED]: { staff: 'Executive assigned', customer: 'Executive assigned', tone: 'blue' },
    [S.PRICE_REVIEW]: { staff: 'Price approval needed', customer: 'Revised price under review', tone: 'orange' },
    [S.PICKED_UP]: { staff: 'Picked up', customer: 'Picked up', tone: 'purple' },
    [S.COMPLETED]: { staff: 'Delivered to hub', customer: 'Completed', tone: 'green' },
    [S.FAILED]: { staff: 'Failed', customer: 'Cancelled', tone: 'red' },
    cancelled: { staff: 'Cancelled', customer: 'Cancelled', tone: 'red' },
    unpicked: { staff: 'Not picked up', customer: 'Cancelled', tone: 'red' },
};

export function statusLabel(status: string | null | undefined, audience: 'staff' | 'customer' = 'staff'): string {
    const entry = LABELS[normalizeStatus(status)];
    return entry ? entry[audience] : (status || 'Unknown');
}

export function statusTone(status: string | null | undefined): Tone {
    return LABELS[normalizeStatus(status)]?.tone ?? 'gray';
}

/** Tailwind classes for a status badge, shared by every list. */
export const TONE_BADGE: Record<Tone, string> = {
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    gray: 'bg-muted text-muted-foreground',
};

// ------------------------------------------------------------------------------------------------ payouts

export const PAYOUT_METHOD_LABELS: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    bank_transfer: 'Bank transfer',
    amazon_voucher: 'Amazon gift card',
    flipkart_voucher: 'Flipkart gift card',
};

export const payoutMethodLabel = (method: string | null | undefined) =>
    PAYOUT_METHOD_LABELS[method || ''] || (method ? method.replace(/_/g, ' ') : 'Cash');

export type PayoutInfo = {
    paid: boolean;
    method: string;
    methodLabel: string;
    amount: number;
    reference?: string | null;
    paidAt?: string | null;
    paidBy?: string | null;
};

/** The payout for an order: recorded payment if "Mark paid" was used, otherwise what is due and how. */
export function payoutOf(order: { price: number; answers?: unknown }): PayoutInfo {
    const answers = parseAnswers(order.answers);
    const recorded = answers.payout && typeof answers.payout === 'object' ? answers.payout : null;
    if (recorded?.status === 'paid') {
        return {
            paid: true,
            method: recorded.method,
            methodLabel: payoutMethodLabel(recorded.method),
            amount: Number(recorded.amount) || order.price,
            reference: recorded.reference || null,
            paidAt: recorded.paidAt || null,
            paidBy: recorded.paidBy || null,
        };
    }
    const method = answers.paymentMethod || 'cash';
    return { paid: false, method, methodLabel: payoutMethodLabel(method), amount: order.price };
}

// ------------------------------------------------------------------------------------------------ price review

export type PriceReview = {
    quotedPrice: number;
    requestedPrice: number;
    requestedAt?: string;
    decision: 'pending' | 'approved' | 'rejected';
    decidedAt?: string;
    decidedBy?: string;
    approvedPrice?: number;
    reason?: string;
};

export function priceReviewOf(order: { answers?: unknown }): PriceReview | null {
    const review = parseAnswers(order.answers).priceReview;
    return review && typeof review === 'object' ? review as PriceReview : null;
}

/** The price quoted when the order was placed (Order.price is replaced when a revised price is approved). */
export function quotedPriceOf(order: { price: number; answers?: unknown }): number {
    const answers = parseAnswers(order.answers);
    return typeof answers.quotedPrice === 'number' ? answers.quotedPrice : order.price;
}

// ------------------------------------------------------------------------------------------------ tracker

export type TrackerStepState = 'done' | 'current' | 'upcoming' | 'failed';
export type TrackerStep = { key: string; label: string; state: TrackerStepState; detail?: string };

export type TrackableOrder = {
    status: string;
    price: number;
    offeredPrice?: number | null;
    partnerId?: string | null;
    riderId?: string | null;
    answers?: unknown;
    executive?: { name?: string | null } | null;
};

const rupees = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

/**
 * The customer tracker (also shown in the admin panel's order details): one step per stage, each done or not done
 * from the stored data, the first open step is "current" — or "failed" when the order failed there.
 */
export function trackerSteps(order: TrackableOrder): TrackerStep[] {
    const status = normalizeStatus(order.status);
    const failed = isFailed(status);
    const answers = parseAnswers(order.answers);
    const review = priceReviewOf(order);
    const payout = payoutOf(order);
    const pickedUp = isPickedUpOrLater(status);

    const steps: Array<{ key: string; label: string; done: boolean; detail?: string }> = [
        { key: 'placed', label: 'Order placed', done: true },
        {
            key: 'partner', label: 'Partner assigned',
            done: !!order.partnerId || !!order.riderId || (status !== normalizeStatus(S.PENDING) && !failed),
        },
        {
            key: 'executive', label: 'Executive assigned',
            done: !!order.riderId || pickedUp || status === S.PRICE_REVIEW,
            detail: order.executive?.name ? order.executive.name : undefined,
        },
    ];

    if (status === S.PRICE_REVIEW || review) {
        const quoted = review?.quotedPrice ?? quotedPriceOf(order);
        let detail: string | undefined;
        let done = false;
        if (status === S.PRICE_REVIEW) {
            detail = `Revised offer ${rupees(review?.requestedPrice ?? order.offeredPrice ?? order.price)} (quoted ${rupees(quoted)}) is waiting for approval`;
        } else if (review?.decision === 'approved') {
            done = true;
            detail = `Approved at ${rupees(review.approvedPrice ?? order.price)} (quoted ${rupees(quoted)})`;
        } else if (review?.decision === 'rejected') {
            detail = 'The revised offer was not approved; the executive will re-check the device';
        }
        steps.push({ key: 'review', label: 'Price review', done: done || pickedUp, detail });
    }

    steps.push(
        {
            key: 'picked_up', label: 'Picked up', done: pickedUp,
            detail: pickedUp ? `Final price ${rupees(order.price)}` : undefined,
        },
        {
            key: 'paid', label: 'Payment', done: payout.paid,
            detail: payout.paid
                ? `${rupees(payout.amount)} paid by ${payout.methodLabel}${payout.paidAt ? ` on ${new Date(payout.paidAt).toLocaleDateString('en-IN')}` : ''}`
                : pickedUp ? `${rupees(payout.amount)} due by ${payout.methodLabel}` : `By ${payout.methodLabel}`,
        },
        { key: 'hub', label: 'Delivered to hub', done: status === S.COMPLETED || answers.hubStatus === 'handed_over' },
    );

    const firstOpen = steps.findIndex(s => !s.done);
    return steps.map((s, i) => ({
        key: s.key,
        label: s.label,
        detail: s.detail,
        state: s.done ? 'done' : i === firstOpen ? (failed ? 'failed' : 'current') : 'upcoming',
    }));
}

/** The reason recorded when the order last failed, if any. */
export function failureReasonOf(order: { answers?: unknown }): string | null {
    const log = parseAnswers(order.answers).failLog;
    return Array.isArray(log) && log.length > 0 ? String(log[log.length - 1]?.reason || '') || null : null;
}

// ------------------------------------------------------------------------------------------------ phone numbers

/** Customers' booking numbers are stored as 10 digits, account and executive numbers with "+91": show either once. */
export function displayPhone(phone: string | null | undefined): string {
    const p = (phone || '').trim();
    if (!p) return '';
    return p.startsWith('+') ? p : `+91 ${p}`;
}

/** A tel: link for the same numbers. */
export function telHref(phone: string | null | undefined): string {
    const p = (phone || '').replace(/[^\d+]/g, '');
    return `tel:${p.startsWith('+') ? p : `+91${p}`}`;
}
