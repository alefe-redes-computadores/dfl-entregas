/** R72 P2: pure, read-only first physical stop context for an existing route-start event.
 * Does not select recipients, send, queue, replay, or create any new event.
 */
import type { Delivery, Route } from '@/types';
import { deliveryStopKey } from '@/lib/route-stops';

export type FirstStopContext = {
  first_stop: true;
  planned_stop: 1;
  pending_stop_rank: 1;
  stops_ahead: 0;
  total_stops: number;
};
export function manualFirstStopContext(route: Route, deliveries: readonly Delivery[]): ReadonlyMap<string,FirstStopContext> {
  const result = new Map<string,FirstStopContext>();
  const started = Date.parse(route.started_at || route.departure_time || '');
  if (route.status !== 'aberta' || !Number.isFinite(started)) return result;
  const rows = deliveries.filter(d => d.route_id === route.id && !d.operational_dismissed_at &&
    d.fulfillment_mode !== 'pickup' && d.fulfillment_mode !== 'counter' && d.fulfillment_mode !== 'external_delivery' &&
    !(d.source_system === 'dfl_site' && /cancel/i.test(String(d.site_order_status||''))) &&
    !(d.return_to_store && d.return_to_store.route_id === route.id && d.completed !== true));
  if (!rows.length || rows.length > 40 || rows.some(d => typeof d.order_index !== 'number' || !Number.isInteger(d.order_index) || d.order_index < 0)) return result;
  const groups = new Map<string,{index:number;rows:Delivery[]}>();
  for(const d of rows){
    const key = deliveryStopKey(d);
    if(!key) return result;
    const entry=groups.get(key);
    if(entry){entry.rows.push(d);entry.index=Math.min(entry.index,Number(d.order_index));}
    else groups.set(key,{index:Number(d.order_index),rows:[d]});
  }
  const ordered=[...groups.entries()].sort((a,b)=>a[1].index-b[1].index||a[0].localeCompare(b[0]));
  const first=ordered[0]?.[1];
  if(!first || first.rows.some(d=>d.completed===true)) return result;
  const context:FirstStopContext={first_stop:true,planned_stop:1,pending_stop_rank:1,stops_ahead:0,total_stops:ordered.length};
  for(const d of first.rows)result.set(d.id,context);
  return result;
}
