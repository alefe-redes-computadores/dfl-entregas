import type { Delivery, Route } from '@/types';
import { isCancelledSiteDelivery, normalizeSiteOrderStatus } from '@/lib/integration/site-order';
import { getFulfillmentMode } from '@/lib/delivery-mode';
import { dateKey, routeOperationalDateKey } from '@/lib/operational-time';
import { scheduledDeliveryReleaseAt } from '@/lib/scheduled-delivery';

const APPROVED = new Set(['confirmado','confirmada','aprovado','aprovada','aceito','aceita','em_producao','em_preparo','em_preparacao','preparando','preparacao','pronto','pronta','preparado','preparada']);
export type FuturePlanItem = { delivery:Delivery; date:string; releaseAt:number; candidates:Route[]; issue?:string };
/** Read-only preview: no writes, no allocation or route departure. */
export function futureRoutePlan(deliveries:readonly Delivery[],routes:readonly Route[],now=Date.now()):FuturePlanItem[] {
  const collisions=new Map<string,number>();
  for(const d of deliveries){if(d.source_system==='dfl_site' && d.external_order_id?.trim()) {
    const id=d.external_order_id.trim();collisions.set(id,(collisions.get(id)||0)+1);
  }}
  const results:FuturePlanItem[]=[];
  for(const delivery of deliveries){
    if(delivery.source_system!=='dfl_site'||delivery.completed||delivery.operational_dismissed_at||isCancelledSiteDelivery(delivery)||getFulfillmentMode(delivery)!=='delivery'||delivery.route_id?.trim())continue;
    const releaseAt=scheduledDeliveryReleaseAt(delivery);
    if(releaseAt===null || releaseAt<=now)continue;
    if(!delivery.scheduled_for || !Number.isFinite(Date.parse(delivery.scheduled_for)))continue;
    const date=dateKey(delivery.scheduled_for);
    const status=normalizeSiteOrderStatus(delivery.site_order_status);
    if(!APPROVED.has(status))continue;
    const candidates=routes.filter(r=>r.status==='aberta'&&!r.started_at&&!r.end_time&&routeOperationalDateKey(r)===date);
    const issue=delivery.external_order_id?.trim() && (collisions.get(delivery.external_order_id.trim())||0)>1?'Identidade duplicada — conferir no Site':!delivery.address_string?.trim()?'Endereço incompleto — revisar':'';
    results.push({delivery,date,releaseAt,candidates,...(issue?{issue}:{})});
  }
  results.sort((a,b)=>a.releaseAt-b.releaseAt || a.delivery.id.localeCompare(b.delivery.id));
  return results;
}
