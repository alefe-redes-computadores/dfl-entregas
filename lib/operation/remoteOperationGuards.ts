import type { Delivery, MotoboyAdjustment, Route } from '@/types';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';

/** R95: chamadas críticas não podem sobrescrever o mesmo pedido alterado em outro aparelho.
 * Usado SOMENTE no commit de baixa, desfazer baixa ou mudança de rota.
 * A comparação não decide quem deve ganhar: se a versão divergiu, o operador sincroniza.
 */
export function assertRemoteDeliveryTransition(
  local: Delivery,
  remote: Delivery | null,
  updated: Partial<Delivery>,
  route: Route | null,
  requiresRoute: boolean,
): void {
  if (!remote || remote.id !== local.id) {
    throw new Error('Pedido ausente ou diferente no servidor. Sincronize antes de continuar.');
  }
  if (isCancelledSiteDelivery(remote)) {
    throw new Error('Pedido cancelado no Site. Sincronize antes de modificar.');
  }
  if (remote.route_id !== local.route_id || Boolean(remote.completed) !== Boolean(local.completed)) {
    throw new Error('Este pedido mudou de rota ou situação em outro aparelho. Atualize antes de continuar.');
  }
  if (remote.updated_at && local.updated_at && remote.updated_at !== local.updated_at) {
    throw new Error('Este pedido foi atualizado em outro aparelho. Sincronize antes de salvar.');
  }
  if (requiresRoute && (!route || route.status !== 'aberta')) {
    throw new Error('A rota de destino não está mais aberta no servidor. Atualize a operação.');
  }
  if (updated.completed === true && requiresRoute && route && !route.started_at && !route.departure_time) {
    throw new Error('A rota ainda não foi iniciada no servidor. Aguarde ou sincronize.');
  }
}

/** Não fechar a rota com uma fotografia local alterada no meio da conferência. */
export function assertRouteClosureStable(
  routeId: string,
  originalRoute: Route,
  before: readonly Delivery[],
  routes: readonly Route[],
  deliveries: readonly Delivery[],
): void {
  const latestRoute = routes.find((item) => item.id === routeId);
  if (!latestRoute || latestRoute.status !== 'aberta' ||
      latestRoute.started_at !== originalRoute.started_at ||
      latestRoute.departure_time !== originalRoute.departure_time) {
    throw new Error('A rota mudou enquanto era conferida. Atualize antes de fechar.');
  }
  const after = deliveries.filter((item) => item.route_id === routeId);
  if (after.length !== before.length) {
    throw new Error('Os pedidos da rota mudaram durante a conferência. Revise antes de fechar.');
  }
  const byId = new Map(before.map((item) => [item.id, item] as const));
  for (const current of after) {
    const previous = byId.get(current.id);
    if (!previous || current.completed !== previous.completed ||
        current.updated_at !== previous.updated_at ||
        current.site_order_status !== previous.site_order_status) {
      throw new Error('Uma entrega mudou durante o fechamento. Atualize antes de concluir.');
    }
  }
}

/** O valor do acerto não pode ser calculado sobre um vale diferente do já salvo na nuvem. */
export function assertRemoteSettlementAdjustment(
  remote: MotoboyAdjustment,
  local: MotoboyAdjustment | undefined,
): void {
  if (!local || local.status !== 'pending' || remote.id !== local.id || remote.status !== 'pending' ||
      remote.amount !== local.amount ||
      (remote.direction || '') !== (local.direction || '') ||
      remote.kind !== local.kind ||
      remote.category_id !== local.category_id ||
      remote.description !== local.description ||
      remote.motoboy_id !== local.motoboy_id ||
      remote.operational_date !== local.operational_date) {
    throw new Error('Vale ou acréscimo alterado em outro aparelho. Atualize o acerto antes de fechar.');
  }
}
