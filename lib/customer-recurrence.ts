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

type RecurrenceCount = { completed: number; direct: number };
// Um índice por versão IMUTÁVEL da lista: dez cards não devem escanear
// milhares de entregas dez vezes. WeakMap libera a memória com a lista antiga.
const recurrenceIndex = new WeakMap<Delivery[], { byCustomer: Map<string, RecurrenceCount>; byId: Map<string, Delivery> }>();

function completedByCustomer(deliveries: Delivery[]) {
  const cached = recurrenceIndex.get(deliveries);
  if (cached) return cached;
  const result = new Map<string, RecurrenceCount>();
  const byId = new Map<string, Delivery>();
  for (const item of deliveries) {
    if (!item.customer_id || item.completed !== true || item.exclude_customer_metrics === true) continue;
    byId.set(item.id, item);
    const value = result.get(item.customer_id) || { completed: 0, direct: 0 };
    value.completed += 1;
    if (!isIfoodOrder(item)) value.direct += 1;
    result.set(item.customer_id, value);
  }
  const indexed = { byCustomer: result, byId };
  recurrenceIndex.set(deliveries, indexed);
  return indexed;
}

export function customerRecurrence(
  deliveries: Delivery[],
  customerId?: string,
  currentDelivery?: Delivery,
): CustomerRecurrence {
  if (!customerId) return { completedOrders: 0, directCompletedOrders: 0, tier: null, milestone: null, milestoneLabel: null };

  const index = completedByCustomer(deliveries);
  const aggregate = index.byCustomer.get(customerId) || { completed: 0, direct: 0 };
  // A entrega atual não compõe o histórico, inclusive depois de concluída.
  const persistedCurrent = currentDelivery ? index.byId.get(currentDelivery.id) : undefined;
  const excludeCurrent = Boolean(persistedCurrent && persistedCurrent.customer_id === customerId);
  const completedOrders = Math.max(0, aggregate.completed - (excludeCurrent ? 1 : 0));
  const directCompletedOrders = Math.max(0, aggregate.direct - (excludeCurrent && persistedCurrent && !isIfoodOrder(persistedCurrent) ? 1 : 0));
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
