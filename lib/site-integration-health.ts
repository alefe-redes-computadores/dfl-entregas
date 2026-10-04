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
  const completionRegistered = Boolean(delivery.completed);
  const completionAt = delivery.completed_at || null;
  return [
    { key: 'received', label: 'Recebido do Site', done: true, at: receivedAt },
    { key: 'assigned', label: 'Enviado ao motoboy', done: Boolean(delivery.route_id), at: assignedAt },
    { key: 'route', label: 'Em rota', done: Boolean(routeAt), at: routeAt },
    { key: 'site', label: 'Conclusao registrada para o Site', done: completionRegistered, at: completionAt },
  ] as const;
}
