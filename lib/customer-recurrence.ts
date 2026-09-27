import type { Delivery } from '@/types';

export type CustomerRecurrence = {
  completedOrders: number;
  directCompletedOrders: number;
  tier: 'frequente' | 'super' | null;
  milestone: number | null;
  milestoneLabel: string | null;
};

const isIfoodOrder = (delivery: Delivery) =>
  delivery.origin === 'ifood' || (!delivery.origin && Boolean(delivery.ifood_id || delivery.order_id));

export function customerRecurrence(
  deliveries: Delivery[],
  customerId?: string,
  currentDelivery?: Delivery,
): CustomerRecurrence {
  if (!customerId) return { completedOrders: 0, directCompletedOrders: 0, tier: null, milestone: null, milestoneLabel: null };

  const history = deliveries.filter((delivery) =>
    delivery.customer_id === customerId &&
    delivery.completed === true &&
    delivery.exclude_customer_metrics !== true &&
    delivery.id !== currentDelivery?.id,
  );
  const completedOrders = history.length;
  const directCompletedOrders = history.filter((delivery) => !isIfoodOrder(delivery)).length;
  const tier = completedOrders >= 10 ? 'super' : completedOrders >= 5 ? 'frequente' : null;

  // iFood conta recorrência, mas nunca dispara benefício de canal direto.
  const currentEligible = Boolean(
    currentDelivery &&
    currentDelivery.exclude_customer_metrics !== true &&
    !isIfoodOrder(currentDelivery),
  );
  const directOrdinal = directCompletedOrders + (currentEligible ? 1 : 0);
  const milestone = currentEligible && directOrdinal >= 10 && directOrdinal % 10 === 0 ? directOrdinal : null;

  return {
    completedOrders,
    directCompletedOrders,
    tier,
    milestone,
    milestoneLabel: milestone ? `${milestone}º pedido direto · avaliar taxa grátis` : null,
  };
}
