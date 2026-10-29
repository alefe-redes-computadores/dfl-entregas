import type { Customer, Delivery } from '@/types';
import { extractLatLngFromMapsUrl } from '@/lib/maps';
// R162: espelha a janela de liberação sem importar dependencias novas neste
// classificador (contrato legado R88 executa o modulo isoladamente).
function isFutureScheduledForHome(item: Delivery, now = Date.now()): boolean {
  if (!item.scheduled_for) return false;
  const target = Date.parse(item.scheduled_for);
  if (!Number.isFinite(target)) return false;
  const lead = Math.max(0, Number(item.schedule_window_minutes) || 30);
  return now < target - lead * 60_000;
}


/** One pass through actionable deliveries; route exceptions always take priority. */
export function classifyHomeExceptions(pending: readonly Delivery[], customers: readonly Customer[], routeIds: ReadonlySet<string>) {
  const customerById = new Map(customers.map(item => [item.id, item]));
  const unassigned: Delivery[] = [];
  const corruptLinks: Delivery[] = [];
  const noAddress: Delivery[] = [];
  const addressOnly: Delivery[] = [];
  for (const item of pending) {
    // R162_LIFECYCLE_GUARD: encerrados nao voltam como pendencias.
    if (item.completed || item.operational_dismissed_at || (item.source_system === 'dfl_site' && /^(cancelad[oa]|cancelled|canceled|pedido_cancelado|pedido_cancelada)$/.test(String(item.site_order_status || '').trim().toLowerCase()))) continue;
    if (item.source_system === 'dfl_site' && isFutureScheduledForHome(item)) continue;
    // R136_SITE_HOME_OWNER: pedidos do Site sem rota pertencem a Caixa; nao sao erro generico da Home.
    if (!item.route_id) {
      if (item.source_system === 'dfl_site') continue;
      unassigned.push(item); continue;
    }
    if (!routeIds.has(item.route_id)) { corruptLinks.push(item); continue; }
    const customer = item.customer_id ? customerById.get(item.customer_id) : undefined;
    const address = item.address_string?.trim() || customer?.address?.trim() || '';
    if (!address) { noAddress.push(item); continue; }
    if (!/\b\d{1,5}\b/.test(address) && !extractLatLngFromMapsUrl(item.maps_link || customer?.maps_link)) {
      addressOnly.push(item);
    }
  }
  return { unassigned, corruptLinks, noAddress, addressOnly };
}
