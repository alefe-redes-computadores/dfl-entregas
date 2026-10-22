import type { Delivery, Route } from '@/types';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';

const FINAL_SITE_STATUSES = new Set(['finalizado', 'concluido', 'concluida', 'completed', 'delivered', 'cancelado', 'cancelada']);

const normalized = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function siteStatusIsFinal(value: unknown) {
  return FINAL_SITE_STATUSES.has(normalized(value));
}

export function siteIntegrationStages(delivery: Delivery, route?: Route) {
  const receivedAt = delivery.site_order_timeline?.[0]?.occurred_at || delivery.created_at || delivery.createdAt || null;
  const cancelled = isCancelledSiteDelivery(delivery);
  // Um route_id pendurado não prova que a rota ainda existe ou saiu de fato.
  const associated = !cancelled && Boolean(route && route.id === delivery.route_id);
  const assignedAt = associated ? (delivery.updated_at || receivedAt) : null;
  const routeAt = associated ? (route?.started_at || route?.departure_time || null) : null;
  // O registro local de conclusão NÃO confirma recebimento pelo Site remoto.
  const completionRegistered = !cancelled && Boolean(delivery.completed);
  const completionAt = completionRegistered ? delivery.completed_at || null : null;
  return [
    { key: 'received', label: 'Recebido do Site', done: true, at: receivedAt },
    { key: 'assigned', label: 'Vinculado a rota', done: associated, at: assignedAt },
    { key: 'route', label: 'Em rota', done: Boolean(routeAt), at: routeAt },
    { key: 'site', label: 'Conclusao registrada para o Site', done: completionRegistered, at: completionAt },
  ] as const;
}
