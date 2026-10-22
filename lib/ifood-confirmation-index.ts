import type { Customer, Delivery, Route } from '@/types';

/**
 * Índices efêmeros para a Central iFood. Mantêm a PRIMEIRA ocorrência,
 * como Array.find, sem alterar a autoridade dos registros recebidos.
 */
export function buildConfirmationIndexes(
  deliveries: Delivery[], customers: Customer[], routes: Route[],
) {
  const deliveriesById = new Map<string, Delivery>();
  const customersById = new Map<string, Customer>();
  const routesById = new Map<string, Route>();
  const deliveryByIfood = new Map<string, { delivery: Delivery; position: number }>();
  const deliveryByOrder = new Map<string, { delivery: Delivery; position: number }>();
  const digits = (value?: string) => (value || '').replace(/\D/g, '');

  for (const customer of customers) {
    if (!customersById.has(customer.id)) customersById.set(customer.id, customer);
  }
  for (const route of routes) {
    if (!routesById.has(route.id)) routesById.set(route.id, route);
  }
  deliveries.forEach((delivery, position) => {
    if (!deliveriesById.has(delivery.id)) deliveriesById.set(delivery.id, delivery);
    const ifood = digits(delivery.ifood_id);
    const order = digits(delivery.order_id);
    if (ifood && !deliveryByIfood.has(ifood)) deliveryByIfood.set(ifood, { delivery, position });
    if (order && !deliveryByOrder.has(order)) deliveryByOrder.set(order, { delivery, position });
  });

  return {
    deliveriesById,
    customersById,
    routesById,
    /** Respeita a posição original mesmo se um número e um ID casarem em pedidos diferentes. */
    findLinkedDelivery(ifoodId?: string, orderId?: string) {
      const byIfood = deliveryByIfood.get(digits(ifoodId));
      const byOrder = deliveryByOrder.get(digits(orderId));
      if (!byIfood) return byOrder?.delivery;
      if (!byOrder) return byIfood.delivery;
      return byIfood.position <= byOrder.position ? byIfood.delivery : byOrder.delivery;
    },
  };
}
