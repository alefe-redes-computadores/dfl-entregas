import type { Delivery } from '@/types';

/**
 * Transient card expansion is local UI state, not remote data. Zustand replaces
 * the deliveries array immutably: build one index per snapshot and share it
 * among all cards, rather than scanning the entire array in every selector.
 * The WeakMap releases old snapshots without any manual cache invalidation.
 */
const cache = new WeakMap<ReadonlyArray<Delivery & { is_expanded?: boolean }>, ReadonlyMap<string, boolean>>();

export function isDeliveryExpanded(
  deliveries: ReadonlyArray<Delivery & { is_expanded?: boolean }>,
  id: string,
): boolean {
  let indexed = cache.get(deliveries);
  if (!indexed) {
    indexed = new Map(deliveries.map((item) => [item.id, item.is_expanded === true]));
    cache.set(deliveries, indexed);
  }
  return indexed.get(id) === true;
}
