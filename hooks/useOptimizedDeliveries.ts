import type { Delivery, Customer } from '@/types';

const normalizedAddress = (value?: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–—]\s*/g, ' - ')
    .trim();

const fallbackOrder = (delivery: Delivery) => {
  const created = new Date(delivery.created_at || delivery.createdAt || delivery.updated_at || 0).getTime();
  return Number.isFinite(created) ? created : Number.MAX_SAFE_INTEGER;
};

export function useOptimizedDeliveries(
  deliveries: Delivery[],
  getCustomerById: (id: string) => Customer | undefined
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

  const sortedDeliveries = [...deliveries].sort((a, b) => {
    // Concluídas ficam agrupadas no fim, mas nenhuma regra "inteligente"
    // pode sobrescrever a ordem manual dentro de cada grupo.
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    const aOrder = a.order_index;
    const bOrder = b.order_index;

    if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    if (aOrder !== undefined && bOrder === undefined) return -1;
    if (aOrder === undefined && bOrder !== undefined) return 1;

    const fallbackDiff = fallbackOrder(a) - fallbackOrder(b);
    if (fallbackDiff !== 0) return fallbackDiff;

    return a.id.localeCompare(b.id);
  });

  const pendingDeliveries = sortedDeliveries.filter((delivery) => !delivery.completed);

  return {
    sortedDeliveries,
    pendingDeliveries,
    neighborhoodCounts,
    addressCounts,
    normalizedAddress,
  };
}
