/** R73 — read-only operational pulse. No writes, user scores or remote IO. */
import type { Delivery, Route } from '@/types';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';
import { isSyntheticOperationalRoute } from '@/lib/operational-time';
import { isAwaitingRedelivery } from '@/lib/operation/return-to-store';

export type R73OperationalPulse = Readonly<{queued:number;returns:number;routesOnStreet:number}>;
export function r73IntelligencePulse(deliveries:readonly Delivery[],routes:readonly Route[]):R73OperationalPulse {
  let queued=0;
  let returns=0;
  for(const delivery of deliveries){
    // Exclusions are not new business rules; only a read-model for the overview.
    if(delivery.developer_test===true||delivery.exclude_from_reports===true||
      delivery.operational_dismissed_at!=null||isCancelledSiteDelivery(delivery))continue;
    if(isAwaitingRedelivery(delivery))returns++;
    if(delivery.completed!==true&&!delivery.route_id&&isDeliveryFulfillment(delivery))queued++;
  }
  const routesOnStreet=routes.filter(route=>route.status==='aberta'&&
    Boolean(route.started_at||route.departure_time)&&!isSyntheticOperationalRoute(route)).length;
  return {queued,returns,routesOnStreet};
}
