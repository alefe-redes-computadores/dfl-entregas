import type { Delivery, Route } from '@/types';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { routeStartedAt } from '@/lib/operational-time';

/**
 * Pedidos cancelados continuam no histórico e na checagem de IDs remotos,
 * mas não representam parada pendente nem impedem fechamento.
 */
export const activeRouteDeliveries = (deliveries: Delivery[]): Delivery[] =>
  deliveries.filter((delivery) => !isCancelledSiteDelivery(delivery));

/**
 * Fechamento AUTOMÁTICO exige pelo menos uma entrega real concluída.
 * Uma rota só com cancelamentos nunca é encerrada silenciosamente.
 */
export const canAutoCloseRoute = (route: Route | undefined, deliveries: Delivery[]): boolean => {
  if (!route || route.status !== 'aberta' || !routeStartedAt(route)) return false;
  const active = activeRouteDeliveries(deliveries);
  return active.length > 0 && active.every((delivery) => delivery.completed === true);
};
