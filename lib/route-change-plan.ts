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
  let cashAvailable = flow.initialCash;

  const lines: RouteChangeLine[] = flow.cashOrders
    .filter((item) => item.requestedChange > 0)
    .map((item) => {
      const cashChange = Math.min(cashAvailable, item.requestedChange);
      cashAvailable = Math.max(0, cashAvailable - cashChange);
      const pixChange = Math.max(0, item.requestedChange - cashChange);
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
