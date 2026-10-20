import type { Delivery } from '@/types';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';

/** Preserve the full stop for historical rendering; never act on cancelled orders. */
export function pendingOperationalStopDeliveries<T extends Delivery>(
  stop: ReadonlyArray<T>,
): T[] {
  return stop.filter((item) => !item.completed && !isCancelledSiteDelivery(item));
}
