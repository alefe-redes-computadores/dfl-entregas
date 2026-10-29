import type { Delivery, Route } from '@/types';
import { isCancelledSiteDelivery, normalizeSiteOrderStatus } from '@/lib/integration/site-order';
import { getFulfillmentMode } from '@/lib/delivery-mode';
import { dateKey, routeOperationalDateKey } from '@/lib/operational-time';

const APPROVED = new Set(['confirmado','confirmada','aprovado','aprovada','aceito','aceita','em_producao','em_preparo','em_preparacao','preparando','preparacao','pronto','pronta','preparado','preparada']);
export type ReservationAudit = { delivery: Delivery; route: Route | null; issue: string | null };
/** Reconciliação de leitura. Nunca dispara Firestore, despacho ou baixa. */
export function auditFutureReservations(deliveries: readonly Delivery[], routes: readonly Route[]): ReservationAudit[] {
  const byId = new Map(routes.map(route => [route.id, route]));
  const identityCount = new Map<string, number>();
  for (const delivery of deliveries) {
    if (delivery.source_system !== 'dfl_site' || !delivery.external_order_id?.trim()) continue;
    const id = delivery.external_order_id.trim();
    identityCount.set(id, (identityCount.get(id) || 0) + 1);
  }
  return deliveries.filter(d => d.source_system === 'dfl_site' && !!d.planned_route_id?.trim()).map(delivery => {
    const route = byId.get(delivery.planned_route_id!.trim()) ?? null;
    let issue: string | null = null;
    if (isCancelledSiteDelivery(delivery)) issue = 'Pedido cancelado no Site; reserva não pode ser usada.';
    else if (delivery.completed || delivery.operational_dismissed_at) issue = 'Pedido encerrado; reserva não autoriza nova entrega.';
    else if (delivery.route_id?.trim()) issue = 'Pedido já alocado de verdade; reserva antiga deve ser conferida.';
    else if (getFulfillmentMode(delivery) !== 'delivery') issue = 'Pedido deixou de ser entrega logística.';
    else if ((identityCount.get(delivery.external_order_id?.trim() || '') || 0) > 1) issue = 'Identidade externa duplicada; bloqueie a organização.';
    else if (!APPROVED.has(normalizeSiteOrderStatus(delivery.site_order_status))) issue = 'Pedido não está aprovado comercialmente.';
    else if (!delivery.scheduled_for || !Number.isFinite(Date.parse(delivery.scheduled_for))) issue = 'Agendamento ausente ou inválido.';
    else if (!route) issue = 'Rota reservada não está sincronizada.';
    else if (route.status !== 'aberta' || !!route.started_at || !!route.end_time) issue = 'Rota reservada já saiu ou foi encerrada.';
    else if (routeOperationalDateKey(route) !== dateKey(delivery.scheduled_for)) issue = 'Horário do pedido mudou para outro dia; revisar a reserva.';
    else if (!delivery.address_string?.trim()) issue = 'Endereço incompleto; confira o pedido.';
    return {delivery, route, issue};
  }).sort((a,b) => Number(!!b.issue)-Number(!!a.issue) || (a.delivery.scheduled_for || '').localeCompare(b.delivery.scheduled_for || '') || a.delivery.id.localeCompare(b.delivery.id));
}
