// The partner's work queues: what each order needs next.
import type { AppOrder } from '@fonzkart/api';
import { ORDER_STATUS, isFailed, normalizeStatus, payoutOf } from '@fonzkart/core';

export type Queue = 'assign' | 'approve' | 'active' | 'hub' | 'unpaid' | 'done' | 'cancelled';

export const QUEUE_LABELS: Record<Queue, string> = {
  assign: 'Needs executive',
  approve: 'Price approvals',
  active: 'In progress',
  hub: 'Hub receipt',
  unpaid: 'Unpaid',
  done: 'Done',
  cancelled: 'Cancelled',
};

/**
 * assign: placed, no executive yet · approve: a revised price waits · active: with an executive or picked up ·
 * hub: delivered, not yet received at the hub · unpaid: received but the customer is not marked paid · done.
 */
export function queueOf(o: AppOrder): Queue {
  const s = normalizeStatus(o.status);
  if (isFailed(s)) return 'cancelled';
  if (s === ORDER_STATUS.PRICE_REVIEW) return 'approve';
  if (s === normalizeStatus(ORDER_STATUS.PENDING) && !o.riderId) return 'assign';
  if (s === ORDER_STATUS.COMPLETED) {
    if (o.hubStatus !== 'handed_over') return 'hub';
    return payoutOf(o).paid ? 'done' : 'unpaid';
  }
  return 'active';
}
