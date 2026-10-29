import type { Delivery } from '@/types';
import { isCancelledSiteDelivery, normalizeSiteOrderStatus } from '@/lib/integration/site-order';
import { getFulfillmentMode } from '@/lib/delivery-mode';
import { dateKey } from '@/lib/operational-time';

const APPROVED = new Set(['confirmado','confirmada','aprovado','aprovada','aceito','aceita','em_producao','em_preparo','em_preparacao','preparando','preparacao','pronto','pronta','preparado','preparada']);

/** Projeção exclusivamente visual: nunca grava, aloca, libera ou despacha. */
export function plannedSiteDeliveries(deliveries: readonly Delivery[], now = Date.now()) {
  const groups = new Map<string, Delivery[]>();
  for (const delivery of deliveries) {
    if (delivery.source_system !== 'dfl_site' || !delivery.scheduled_for || delivery.route_id?.trim() || delivery.completed || delivery.operational_dismissed_at || isCancelledSiteDelivery(delivery) || getFulfillmentMode(delivery) !== 'delivery') continue;
    const timestamp = Date.parse(delivery.scheduled_for);
    if (!Number.isFinite(timestamp) || timestamp <= now || !APPROVED.has(normalizeSiteOrderStatus(delivery.site_order_status))) continue;
    const key = delivery.external_order_id?.trim() || delivery.id;
    const existing = groups.get(key);
    if (existing) existing.push(delivery); else groups.set(key,[delivery]);
  }
  const items = [...groups.values()].filter(group => group.length === 1).map(group => group[0]);
  items.sort((a,b)=>Date.parse(a.scheduled_for!) - Date.parse(b.scheduled_for!) || a.id.localeCompare(b.id));
  const byDay = new Map<string,Delivery[]>();
  for(const item of items){const day=dateKey(item.scheduled_for!);const group=byDay.get(day);if(group)group.push(item);else byDay.set(day,[item]);}
  return [...byDay].map(([date,orders])=>({date,orders}));
}
