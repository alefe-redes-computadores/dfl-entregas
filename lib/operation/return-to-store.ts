/** R72 P1 — operational return, NOT delivery completion, cancellation or sale. */
import type { Delivery, Motoboy } from '@/types';
import type { DeliveryAttemptReason } from '@/lib/delivery-attempts';

export interface DeliveryReturnToStore {
  attempt_id: string;
  route_id: string;
  at: string;
  reason: DeliveryAttemptReason;
  motoboy_id?: string;
  motoboy_name?: string;
}

export function isAwaitingRedelivery(delivery: Pick<Delivery, 'route_id'|'completed'|'return_to_store'>): boolean {
  const value = delivery.return_to_store;
  return delivery.completed !== true && Boolean(value && value.route_id && value.route_id === delivery.route_id &&
    value.attempt_id && Number.isFinite(Date.parse(value.at)));
}

export interface AttemptVisitRow {
  id: string;
  routeId: string;
  deliveryId: string;
  order: string;
  customer: string;
  reason: DeliveryAttemptReason;
  at: string;
}

/**
 * Only deliberately confirmed physical visits, attached to an actual route,
 * with an exact operational date enter a driver's count. Legacy notes,
 * hypothetical drafts and site statuses never trigger compensation.
 * A stable attempt ID prevents double counting after delivery reassignment.
 */
export function confirmedAttemptVisits(
  deliveries: readonly Delivery[],
  eligibleRouteIds: ReadonlySet<string>,
  operationalDate: string,
  motoboy: Pick<Motoboy,'id'|'name'>,
): AttemptVisitRow[] {
  const visited = new Set<string>();
  const rows: AttemptVisitRow[] = [];
  for (const delivery of deliveries) {
    if (delivery.developer_test === true || delivery.exclude_from_reports === true) continue;
    for (const attempt of delivery.delivery_attempts || []) {
      if (attempt.physical_visit_confirmed !== true || !attempt.route_id ||
          !eligibleRouteIds.has(attempt.route_id) || attempt.operational_date !== operationalDate ||
          !attempt.id || !Number.isFinite(Date.parse(attempt.at))) continue;
      if (attempt.motoboy_id ? attempt.motoboy_id !== motoboy.id :
        (attempt.motoboy_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim() !==
        motoboy.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()) continue;
      const key = `${delivery.id}:${attempt.id}`;
      if (visited.has(key)) continue;
      visited.add(key);
      rows.push({id:key,routeId:attempt.route_id,deliveryId:delivery.id,
        order:delivery.order_id || delivery.external_order_id || delivery.id,
        customer:delivery.customer_name || 'Cliente',reason:attempt.reason,at:attempt.at});
    }
  }
  return rows.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
}
