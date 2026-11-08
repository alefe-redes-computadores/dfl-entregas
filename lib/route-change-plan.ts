import type { Customer, Delivery } from '@/types';
import { routeCashFlow } from '@/lib/route-cash-flow';
import { deliveryStopKey, stopNumberMap } from '@/lib/route-stops';

export type RouteChangeLine = {
  delivery: Delivery;
  stop: number;
  customer: string;
  charge: number;
  tendered: number;
  change: number;
  cashChange: number;
  pixChange: number;
};

export function buildRouteChangePlan(
  deliveries: Delivery[],
  initialCash: number,
  customerById: (id: string) => Customer | undefined,
) {
  const flow = routeCashFlow(deliveries, initialCash);
  const numbers = stopNumberMap(deliveries);
  const allocationById = new Map(flow.changeAllocations.map((item) => [item.id, item] as const));

  const lines: RouteChangeLine[] = flow.cashOrders
    .map((item) => {
      const allocated = allocationById.get(item.delivery.id);
      if (!allocated) throw new Error('Plano de troco sem alocacao');
      const { cashChange, pixChange } = allocated;
      const customer = customerById(item.delivery.customer_id);
      return {
        delivery: item.delivery,
        stop: numbers.get(deliveryStopKey(item.delivery)) || 1,
        customer: customer?.name || item.delivery.customer_name || 'Cliente',
        charge: item.customerCharge,
        tendered: item.tenderedCash,
        change: item.requestedChange,
        cashChange,
        pixChange,
      };
    });

  return { flow, lines };
}
