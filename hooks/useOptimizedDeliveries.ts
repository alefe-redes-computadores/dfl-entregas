import { useMemo } from 'react';
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
  customerSnapshot: Customer[],
) {
  // A mesma rota renderiza ao expandir, copiar, arrastar e concluir entregas.
  // Não refazer agrupamentos, geografia de vizinhos e contagens por gesto.
  return useMemo(() => {
    const customerById = new Map(customerSnapshot.map((customer) => [customer.id, customer] as const));
    const customerFor = (id: string) => customerById.get(id) || getCustomerById(id);
    // R89: uma passagem e uma busca de cliente por pedido; mesma semantica
    // de contagem anterior, sem consultas, geocoding ou ordem alterada.
    const neighborhoodCounts: Record<string, number> = {};
    const addressCounts: Record<string, number> = {};
    for (const delivery of deliveries) {
      const customer = customerFor(delivery.customer_id);
      const neighborhood = customer?.neighborhood?.trim().toLowerCase();
      if (neighborhood) neighborhoodCounts[neighborhood] = (neighborhoodCounts[neighborhood] || 0) + 1;
      const key = normalizedAddress(delivery.address_string || customer?.address);
      if (key) addressCounts[key] = (addressCounts[key] || 0) + 1;
    }

    const groups = groupDeliveriesByStop(deliveries);
    // groupDeliveriesByStop já aplica a prioridade operacional. Não há leitura
    // remota nem geocoding aqui: montar/editar a rota permanece instantâneo.
    const sortedDeliveries = groups.flatMap((group) => group.deliveries);
    const pendingDeliveries = sortedDeliveries.filter((delivery) => !delivery.completed);
    // A ordem/grupo da rota já está calculada: filtrar os membros pendentes
    // evita ordenar a mesma coleção novamente a cada mutação operacional.
    const pendingGroups = groups.flatMap((group) => {
      if (group.pending.length === 0) return [];
      const representative = group.pending[0];
      return [{ ...group, representative, deliveries: group.pending, pending: group.pending, completed: [] }];
    });

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
        const customer = customerFor(delivery.customer_id);
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
      allStopGroups: groups,
      pendingStopGroups: pendingGroups,
    };
  }, [deliveries, getCustomerById, customerSnapshot]);
}
