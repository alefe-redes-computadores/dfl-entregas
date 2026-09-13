import type { Delivery, Customer } from '@/types';
import { deliveryPoint, neighborMetadata } from '@/lib/route-intelligence';
import { groupDeliveriesByStop } from '@/lib/route-stops';

const normalizedAddress = (value?: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–—]\s*/g, ' - ')
    .trim();

export function useOptimizedDeliveries(
  deliveries: Delivery[],
  getCustomerById: (id: string) => Customer | undefined,
) {
  const neighborhoodCounts = deliveries.reduce((acc, delivery) => {
    const customer = getCustomerById(delivery.customer_id);
    const neighborhood = customer?.neighborhood?.trim().toLowerCase();
    if (neighborhood) acc[neighborhood] = (acc[neighborhood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const addressCounts = deliveries.reduce((acc, delivery) => {
    const customer = getCustomerById(delivery.customer_id);
    const key = normalizedAddress(delivery.address_string || customer?.address);
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const groups = groupDeliveriesByStop(deliveries);
  const sortedDeliveries = groups.flatMap((group) => group.deliveries);
  const pendingDeliveries = sortedDeliveries.filter((delivery) => !delivery.completed);
  const pendingGroups = groupDeliveriesByStop(pendingDeliveries);

  const stopMeta = new Map<
    string,
    { orderInStop: number; totalOrders: number; first: boolean; stopNumber: number }
  >();

  pendingGroups.forEach((group, stopIndex) => {
    group.deliveries.forEach((delivery, orderIndex) => {
      stopMeta.set(delivery.id, {
        orderInStop: orderIndex + 1,
        totalOrders: group.deliveries.length,
        first: orderIndex === 0,
        stopNumber: stopIndex + 1,
      });
    });
  });

  const neighborMeta = neighborMetadata(
    groups.map((group) => {
      const delivery = group.representative;
      const customer = getCustomerById(delivery.customer_id);
      return {
        delivery,
        customer,
        point: deliveryPoint(delivery, customer),
      };
    }),
  );

  return {
    sortedDeliveries,
    pendingDeliveries,
    neighborhoodCounts,
    addressCounts,
    normalizedAddress,
    neighborMeta,
    stopMeta,
    totalStops: groups.length,
    pendingStops: pendingGroups.length,
  };
}
