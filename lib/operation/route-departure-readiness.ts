/** R266 — Confirmação operacional da ROTA, não do pedido.
 * Assinatura exclusivamente para detectar mudanças na conferência. Não autoriza
 * acesso ao cliente, não é assinatura criptográfica e nunca dispara mensagens.
 */
import type { Delivery, Route } from '@/types';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';

const str = (v: unknown) => v == null ? '' : String(v).trim();
export function routeDepartureActiveDeliveries(route: Pick<Route, 'id'>, deliveries: readonly Delivery[]) {
  return deliveries.filter(d => d.route_id === route.id && !d.completed &&
    !isCancelledSiteDelivery(d) && !d.operational_dismissed_at &&
    d.fulfillment_mode !== 'pickup' && d.fulfillment_mode !== 'counter' &&
    d.fulfillment_mode !== 'external_delivery');
}

/** A ordem do array do Zustand não altera a assinatura; a ordem REAL da rota altera. */
export function routeDepartureSignature(route: Route, deliveries: readonly Delivery[]): string | null {
  const active = routeDepartureActiveDeliveries(route, deliveries);
  if (!active.length) return null;
  const rows = active.map(d => [
    d.id, d.route_id, d.customer_id, d.address_string, d.order_index,
    d.order_updated_at, d.updated_at, d.is_urgent === true ? 'urgente' : '',
    d.source_system, d.site_order_status, d.scheduled_for, d.observation,
  ].map(str).join('\u001f')).sort();
  const raw = JSON.stringify([route.id, route.motoboy_id || '', route.motoboy_name || '', rows]);
  // Dois acumuladores independentes: checksum operacional, não prova de segurança.
  let a = 2166136261, b = 5381;
  for (let i = 0; i < raw.length; i++) {
    a = Math.imul(a ^ raw.charCodeAt(i), 16777619) >>> 0;
    b = (Math.imul(b, 33) ^ raw.charCodeAt(i)) >>> 0;
  }
  return `r266-v1-${active.length}-${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

export function isRouteDepartureReady(route: Route, deliveries: readonly Delivery[]): boolean {
  if (route.status !== 'aberta' || route.started_at || route.departure_time || !route.departure_ready_at) return false;
  const signature = routeDepartureSignature(route, deliveries);
  return Boolean(signature && route.departure_ready_signature === signature &&
    route.departure_ready_count === routeDepartureActiveDeliveries(route, deliveries).length);
}

export function routeDepartureNeedsReview(route: Route, deliveries: readonly Delivery[]): boolean {
  return Boolean(route.status === 'aberta' && !route.started_at && !route.departure_time &&
    route.departure_ready_at && !isRouteDepartureReady(route, deliveries));
}
