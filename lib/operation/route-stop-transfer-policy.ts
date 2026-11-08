/** R299 P12 — validação pura de transferência de parada física.
 * Não envia mensagens, não altera estado comercial e não faz I/O.
 */
import type { Delivery, Route } from '@/types';
import { deliveryStopKey } from '@/lib/route-stops';
import { isCancelledSiteDelivery, isSiteOrderAwaitingConfirmation } from '@/lib/integration/site-order';
import { getFulfillmentMode } from '@/lib/delivery-mode';
import { dateKey, deliveryDate, routeDate } from '@/lib/operational-time';

export interface StopTransferAudit {
  operation_id: string;
  at: string;
  actor_uid: string;
  from_route_id: string;
  to_route_id: string;
  group_size: number;
}

export function assertRouteStopTransfer(input: {
  selectedId: string;
  members: readonly Delivery[];
  allSource: readonly Delivery[];
  from: Route;
  to: Route | null;
  destinationId: string;
  selectedPatch?: Partial<Delivery>;
}): void {
  const { selectedId, members, allSource, from, to, destinationId, selectedPatch } = input;
  const sourceId = from.id;
  if (!members.length || members.length > 30) throw new Error('Uma parada deve conter entre 1 e 30 pedidos para transferência segura.');
  const ids = new Set(members.map(d => d.id));
  if (ids.size !== members.length || !ids.has(selectedId)) throw new Error('Seleção da parada incompleta ou duplicada. Sincronize a rota.');
  if (from.status !== 'aberta') throw new Error('A rota de origem precisa estar aberta.');
  if (destinationId === sourceId) throw new Error('Escolha outra rota ou retire a parada da atual.');
  if (destinationId && (!to || to.id !== destinationId || to.status !== 'aberta')) throw new Error('A rota de destino precisa estar aberta.');
  const sourceKey = deliveryStopKey(members.find(d => d.id === selectedId)!);
  const expected = allSource.filter(d => d.route_id === sourceId && deliveryStopKey(d) === sourceKey);
  if (expected.length !== members.length || expected.some(d => !ids.has(d.id))) {
    throw new Error('Há outros pedidos nesta parada. Mova todos os pendentes ou revise a parada.');
  }
  for (const d of members) {
    if (d.route_id !== sourceId || deliveryStopKey(d) !== sourceKey) throw new Error('Pedidos de paradas diferentes não podem ser movidos juntos.');
    if (d.completed === true || d.operational_dismissed_at || isCancelledSiteDelivery(d)) throw new Error('Parada com pedido concluído ou cancelado: revise individualmente antes de mover.');
    if (getFulfillmentMode(d) !== 'delivery') throw new Error('Retirada, balcão e entrega parceira não podem ser transferidos como parada do motoboy.');
    if (isSiteOrderAwaitingConfirmation(d)) throw new Error('Pedido aguardando aceite comercial da loja não pode sair na rota.');
    const when = deliveryDate(d);
    const sourceDate = routeDate(from);
    if (!when || !sourceDate || dateKey(when) !== dateKey(sourceDate)) throw new Error('Data operacional da entrega e da rota de origem divergem.');
    if (to) {
      const targetDate = routeDate(to);
      if (!targetDate || dateKey(when) !== dateKey(targetDate)) throw new Error('A rota de destino pertence a outra data operacional.');
    }
  }
  if (selectedPatch) {
    if (selectedPatch.completed === true || selectedPatch.completed === false && members.find(d=>d.id===selectedId)?.completed === true) throw new Error('Transferência não pode dar baixa nem reabrir pedido.');
    if (selectedPatch.route_id !== undefined && selectedPatch.route_id !== destinationId) throw new Error('Rota divergente no formulário.');
    if (selectedPatch.fulfillment_mode && selectedPatch.fulfillment_mode !== 'delivery') throw new Error('Altere a modalidade separadamente antes de mover uma parada.');
    if (selectedPatch.site_order_status !== undefined || selectedPatch.source_system !== undefined || selectedPatch.operational_dismissed_at !== undefined) throw new Error('O estado comercial não pode ser editado pela transferência logística.');
    const selected = members.find(d=>d.id===selectedId)!;
    if (members.length > 1 && selectedPatch.address_string !== undefined &&
        deliveryStopKey({...selected,address_string:selectedPatch.address_string}) !== sourceKey) {
      throw new Error('O endereço da parada mudou. Salve a correção de endereço separadamente, depois mova a parada.');
    }
  }
}

/** Limite explícito evita crescimento de documentos Firebase por sucessivas reatribuições. */
export function appendRouteTransferAudit(previous: readonly StopTransferAudit[] | undefined, event: StopTransferAudit): StopTransferAudit[] {
  return [...(previous || []).filter(v => v.operation_id !== event.operation_id), event].slice(-20);
}
