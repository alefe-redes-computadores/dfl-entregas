import type { Delivery } from '@/types';

/** One O(n) pass per immutable store snapshot; every route card then reads O(1).
 * WeakMap prevents retaining replaced Firestore/store snapshots.
 * This index changes only for fields affecting route membership or operational presentation.
 */
const routeRevisions = new WeakMap<Delivery[], Map<string, string>>();

export function routeDeliveryRevision(deliveries: Delivery[], routeId: string): string {
  let revisions = routeRevisions.get(deliveries);
  if (!revisions) {
    const parts = new Map<string, string[]>();
    for (const item of deliveries) {
      if (!item.route_id) continue;
      const revision = [
        item.id,
        item.updated_at || item.created_at || item.createdAt || '',
        item.order_index ?? '',
        item.completed ? '1' : '0',
        item.route_id,
      ].join(':');
      const current = parts.get(item.route_id);
      if (current) current.push(revision);
      else parts.set(item.route_id, [revision]);
    }
    revisions = new Map<string, string>();
    for (const [id, entries] of parts) revisions.set(id, entries.join('|'));
    routeRevisions.set(deliveries, revisions);
  }
  return revisions.get(routeId) || '';
}
