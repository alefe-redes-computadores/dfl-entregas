// lib/route-stops.ts
import type { Delivery } from '@/types';
import { canonicalizeOperationalAddress } from '@/lib/operational-address';
import { normalizeCustomerAddress } from '@/lib/customer-identity';

const normalizeStopAddress = (value?: string) =>
  normalizeCustomerAddress(
    canonicalizeOperationalAddress(value).address,
  );

/**
 * Uma parada é física, não comercial.
 *
 * `stop_group_id` continua sendo persistido para fluxos multi-pedido, mas o
 * endereço canônico é a identidade operacional primária. Assim, dois pedidos
 * cadastrados separadamente para o mesmo endereço e na mesma rota não viram
 * duas paradas para o motoboy.
 */
export const deliveryStopKey = (delivery: Delivery) => {
  const address = normalizeStopAddress(delivery.address_string);
  if (delivery.route_id && address) {
    return `address:${delivery.route_id}:${address}`;
  }

  return delivery.stop_group_id?.trim() || delivery.id;
};

const fallbackOrder = (delivery: Delivery) => {
  const value = new Date(
    delivery.created_at ||
      delivery.createdAt ||
      delivery.updated_at ||
      0,
  ).getTime();

  return Number.isFinite(value)
    ? value
    : Number.MAX_SAFE_INTEGER;
};

const orderValue = (delivery: Delivery) =>
  delivery.order_index ?? fallbackOrder(delivery);

export type DeliveryStopGroup = {
  key: string;
  deliveries: Delivery[];
  representative: Delivery;
  pending: Delivery[];
  completed: Delivery[];
  urgent: boolean;
  locked: boolean;
};

export function groupDeliveriesByStop(
  deliveries: Delivery[],
): DeliveryStopGroup[] {
  const sorted = [...deliveries].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    const diff = orderValue(a) - orderValue(b);
    if (diff !== 0) return diff;

    return a.id.localeCompare(b.id);
  });

  const groups = new Map<string, DeliveryStopGroup>();

  for (const delivery of sorted) {
    const key = deliveryStopKey(delivery);
    const current = groups.get(key);

    if (current) {
      current.deliveries.push(delivery);
      if (delivery.completed) current.completed.push(delivery);
      else current.pending.push(delivery);
      current.urgent ||= delivery.is_urgent === true;
      current.locked ||= delivery.order_locked === true;
      continue;
    }

    groups.set(key, {
      key,
      deliveries: [delivery],
      representative: delivery,
      pending: delivery.completed ? [] : [delivery],
      completed: delivery.completed ? [delivery] : [],
      urgent: delivery.is_urgent === true,
      locked: delivery.order_locked === true,
    });
  }

  return [...groups.values()];
}

export function expandStopOrder(
  orderedIds: string[],
  deliveries: Delivery[],
): string[] {
  const byId = new Map(
    deliveries.map((delivery) => [delivery.id, delivery] as const),
  );

  const groups = groupDeliveriesByStop(deliveries);
  const byKey = new Map(
    groups.map((group) => [group.key, group] as const),
  );

  const seen = new Set<string>();
  const keys: string[] = [];

  for (const id of orderedIds) {
    const delivery = byId.get(id);
    if (!delivery) continue;

    const key = deliveryStopKey(delivery);
    if (seen.has(key)) continue;

    seen.add(key);
    keys.push(key);
  }

  for (const group of groups) {
    if (seen.has(group.key)) continue;
    seen.add(group.key);
    keys.push(group.key);
  }

  return keys.flatMap(
    (key) =>
      byKey.get(key)?.deliveries.map((delivery) => delivery.id) || [],
  );
}

export function stopNumberMap(deliveries: Delivery[]) {
  return new Map(
    groupDeliveriesByStop(deliveries).map(
      (group, index) => [group.key, index + 1] as const,
    ),
  );
}
