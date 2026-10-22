import type { Delivery, Route } from '@/types';
import { getFulfillmentMode } from '@/lib/delivery-mode';
import { isCancelledSiteDelivery, normalizeSiteOrderStatus } from '@/lib/integration/site-order';
import { isFutureScheduledDelivery } from '@/lib/scheduled-delivery';
import { routeOperationalDateKey, dateKey } from '@/lib/operational-time';

export type SiteInboxState = 'confirmar' | 'aguardar_agenda' | 'pronto' | 'revisar' | 'alocado' | 'cancelado' | 'retirada' | 'concluido';

// Somente estados comerciais explicitamente aprovados autorizam vinculo logístico.
// Status novos/desconhecidos permanecem em revisão, nunca autorizam saída automaticamente.
const RELEASED = new Set(['confirmado', 'confirmada', 'aprovado', 'aprovada', 'aceito', 'aceita', 'em_preparo', 'em_preparacao', 'preparando', 'preparacao', 'pronto', 'pronta', 'preparado', 'preparada']);
export function siteInboxState(delivery: Delivery, now = Date.now()): SiteInboxState | null {
  if (delivery.source_system !== 'dfl_site') return null;
  if (isCancelledSiteDelivery(delivery)) return 'cancelado';
  if (delivery.completed === true || delivery.operational_dismissed_at) return 'concluido';
  if (getFulfillmentMode(delivery) !== 'delivery') return 'retirada';
  if (delivery.route_id?.trim()) return 'alocado';
  const status = normalizeSiteOrderStatus(delivery.site_order_status);
  if (status === 'pendente' || status === 'agendado') return 'confirmar';
  if (!RELEASED.has(status)) return 'revisar';
  if (isFutureScheduledDelivery(delivery, now)) return 'aguardar_agenda';
  return 'pronto';
}
export function siteInboxProjection(deliveries: readonly Delivery[], now = Date.now()) {
  type State = Extract<SiteInboxState, 'pronto' | 'confirmar' | 'aguardar_agenda' | 'revisar'>;
  type Entry = { delivery: Delivery; state: State; duplicate?: boolean };
  // Uma projeção não pode esconder colisões de identidade. Se o Site sincronizou
  // dois docs diferentes para o mesmo pedido, a alocação é bloqueada na UI e
  // o operador vê a pendência como revisão, sem criar outro documento.
  const groups = new Map<string, Delivery[]>();
  for (const delivery of deliveries) {
    if (delivery.source_system !== 'dfl_site') continue;
    const externalId = delivery.external_order_id?.trim();
    const key = externalId ? `external:${externalId}` : `delivery:${delivery.id}`;
    const group = groups.get(key);
    if (group) group.push(delivery);
    else groups.set(key, [delivery]);
  }
  const rows: Entry[] = [];
  for (const group of groups.values()) {
    const active = group.map(delivery => ({ delivery, state: siteInboxState(delivery, now) }))
      .filter((candidate): candidate is {delivery: Delivery; state: State} =>
        candidate.state === 'pronto' || candidate.state === 'confirmar' ||
        candidate.state === 'aguardar_agenda' || candidate.state === 'revisar');
    if (!active.length) continue;
    if (group.length > 1) {
      // Empate ou evento contraditório deve ser visível, nunca elegível.
      // A revisão comercial resolve o cadastro duplicado antes de roteirizar.
      rows.push({delivery: active[0].delivery, state:'revisar', duplicate:true});
    } else rows.push(active[0]);
  }
  rows.sort((a,b) => {
    const aDate = Date.parse(a.delivery.site_order_last_event_at || a.delivery.created_at || a.delivery.createdAt || '');
    const bDate = Date.parse(b.delivery.site_order_last_event_at || b.delivery.created_at || b.delivery.createdAt || '');
    return (Number.isFinite(aDate) ? aDate : 0) - (Number.isFinite(bDate) ? bDate : 0) || a.delivery.id.localeCompare(b.delivery.id);
  });
  let ready=0, commercial=0, scheduled=0, review=0, duplicates=0;
  for (const row of rows) {
    if(row.duplicate)duplicates++;
    if(row.state==='pronto')ready++;
    else if(row.state==='confirmar')commercial++;
    else if(row.state==='aguardar_agenda')scheduled++;
    else review++;
  }
  return {rows, total:rows.length, ready, commercial, scheduled, review, duplicates};
}
export function assertSiteRouteAllocation(delivery: Delivery, route: Route | null, now = Date.now()): void {
  const state = siteInboxState(delivery, now);
  if (state !== 'pronto') throw new Error(state === 'alocado' ? 'Este pedido já foi vinculado a uma rota.' : 'Pedido não liberado comercialmente ou agendado para depois. Confira no Site.');
  if (!delivery.address_string?.trim()) throw new Error('Confirme o endereço do pedido antes de escolher a rota.');
  if (!route) return;
  if (route.status !== 'aberta' || route.started_at || route.end_time) throw new Error('Selecione uma rota aberta que ainda não saiu para entrega.');
  if (routeOperationalDateKey(route) !== dateKey(new Date(now))) throw new Error('A rota escolhida precisa ser da operação de hoje.');
}
