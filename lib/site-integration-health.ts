import type { Delivery, Route } from '@/types';

const FINAL_SITE_STATUSES = new Set(['finalizado', 'concluido', 'concluida', 'completed', 'delivered', 'cancelado', 'cancelada']);

const normalized = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function siteStatusIsFinal(value: unknown) {
  return FINAL_SITE_STATUSES.has(normalized(value));
}

export function siteIntegrationStages(delivery: Delivery, route?: Route) {
  const receivedAt = delivery.site_order_timeline?.[0]?.occurred_at || delivery.created_at || delivery.createdAt || null;
  const assignedAt = delivery.route_id ? (delivery.updated_at || receivedAt) : null;
  const routeAt = route?.started_at || route?.departure_time || null;
  const siteConfirmed = siteStatusIsFinal(delivery.site_order_status);
  const confirmedAt = siteConfirmed
    ? delivery.site_order_status_updated_at || delivery.site_order_last_event_at || delivery.site_order_timeline?.at(-1)?.occurred_at || null
    : null;
  return [
    { key: 'received', label: 'Recebido do Site', done: true, at: receivedAt },
    { key: 'assigned', label: 'Enviado ao motoboy', done: Boolean(delivery.route_id), at: assignedAt },
    { key: 'route', label: 'Em rota', done: Boolean(routeAt), at: routeAt },
    { key: 'site', label: 'Concluido no Site', done: siteConfirmed, at: confirmedAt },
  ] as const;
}

export function siteCompletionDivergences(deliveries: Delivery[], now = Date.now(), graceMs = 5 * 60_000) {
  return deliveries.filter((delivery) => {
    if (delivery.source_system !== 'dfl_site' || !delivery.completed || siteStatusIsFinal(delivery.site_order_status)) return false;
    const completedAt = Date.parse(String(delivery.completed_at || delivery.updated_at || ''));
    return Number.isFinite(completedAt) && now - completedAt >= graceMs;
  });
}
