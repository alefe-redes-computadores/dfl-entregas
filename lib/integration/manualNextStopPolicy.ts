/** R300 P2 — decisão pura sobre a transição de PARADA FÍSICA.
 * Sem rede, sem WhatsApp e sem leitura do relógio implícita.
 */
import type { Delivery, Route } from '@/types';
import { deliveryStopKey } from '@/lib/route-stops';

export type ManualPhysicalTransition = {
  routeId: string;
  previousGroupKey: string;
  nextGroupKey: string;
  completedAt: string;
  plannedStop: number;
  totalStops: number;
  snapshotParts: Array<{ key: string; ids: string[]; orderIndex: number }>;
  nextDeliveries: Delivery[];
};

const timestamp = (value: unknown): number => {
  const ms = Date.parse(typeof value === 'string' ? value : '');
  return Number.isFinite(ms) ? ms : NaN;
};

export function planManualNextStopTransition(input: {
  route: Pick<Route, 'id' | 'status' | 'started_at' | 'departure_time'>;
  deliveries: readonly Delivery[];
  now: number;
}): ManualPhysicalTransition | null {
  const { route, now } = input;
  if (route.status !== 'aberta' || !Number.isFinite(timestamp(route.started_at || route.departure_time))) return null;
  const members = input.deliveries.filter(item => item.route_id === route.id &&
    item.fulfillment_mode !== 'pickup' && item.fulfillment_mode !== 'counter' &&
    item.fulfillment_mode !== 'external_delivery' &&
    !item.operational_dismissed_at &&
    !(item.source_system === 'dfl_site' && /cancel/i.test(String(item.site_order_status || ''))));
  if (members.length < 2 || members.length > 100) return null;
  type Stop = { key: string; members: Delivery[]; orderIndex: number };
  const byKey = new Map<string, Stop>();
  for (const item of members) {
    const key = deliveryStopKey(item);
    const index = Number(item.order_index);
    const orderIndex = Number.isFinite(index) ? index : Number.MAX_SAFE_INTEGER;
    const existing = byKey.get(key);
    if (existing) {
      existing.members.push(item);
      existing.orderIndex = Math.min(existing.orderIndex, orderIndex);
    } else byKey.set(key, { key, members: [item], orderIndex });
  }
  const groups = [...byKey.values()].sort((a, b) =>
    a.orderIndex - b.orderIndex || a.key.localeCompare(b.key));
  if (groups.length < 2 || groups.length > 100) return null;
  const nextIndex = groups.findIndex(group => group.members.some(item => item.completed !== true));
  if (nextIndex < 1) return null;
  const previous = groups[nextIndex - 1], next = groups[nextIndex];
  if (previous.members.some(item => item.completed !== true)) return null;
  // A baixa mais recente do grupo anterior define o fato autoritativo.
  const completedTimes = previous.members.map(item => timestamp(item.completed_at));
  if (completedTimes.some(value => !Number.isFinite(value))) return null;
  const completedMs = Math.max(...completedTimes);
  if (completedMs < timestamp(route.started_at || route.departure_time) ||
      completedMs > now + 30000 || now - completedMs > 6 * 60_000) return null;
  // Reordenações após o fato não podem recriar uma nova transição semântica.
  if (members.some(item => {
    const changed = timestamp(item.order_updated_at);
    return Number.isFinite(changed) && changed > completedMs;
  })) return null;
  const completedAt = new Date(completedMs).toISOString();
  return {
    routeId: route.id,
    previousGroupKey: previous.key,
    nextGroupKey: next.key,
    completedAt,
    plannedStop: nextIndex + 1,
    totalStops: groups.length,
    snapshotParts: groups.map(group => ({
      key: group.key,
      ids: group.members.map(d => d.id).sort(),
      orderIndex: group.orderIndex,
    })),
    nextDeliveries: next.members.filter(item => item.completed !== true),
  };
}
