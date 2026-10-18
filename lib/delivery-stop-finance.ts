import type { Delivery } from '@/types';
import { deliveryCustomerCharge, deliveryEconomicValue, deriveDeliveryPaymentState } from '@/lib/delivery-finance';

/** Snapshot calculado de uma parada física (pode conter vários pedidos).
 * Valor dos pedidos ≠ valor devido ao motoboy ≠ valor ainda a cobrar.
 */
export function summarizeStopFinance(deliveries: readonly Delivery[]) {
  let economicTotal = 0;
  let customerTotal = 0;
  let collectTotal = 0;
  let pixPendingTotal = 0;
  let collectCount = 0;
  let pendingCount = 0;
  let paidCount = 0;
  for (const delivery of deliveries) {
    const charge = deliveryCustomerCharge(delivery);
    economicTotal += deliveryEconomicValue(delivery);
    customerTotal += charge;
    const payment = deriveDeliveryPaymentState(delivery);
    if (payment === 'paid') paidCount++;
    else if (payment === 'collect_on_delivery') { collectTotal += charge; collectCount++; }
    else { pixPendingTotal += charge; pendingCount++; }
  }
  return { economicTotal, customerTotal, collectTotal, pixPendingTotal, collectCount, pendingCount, paidCount,
    hasDifferentCustomerCharge: Math.abs(economicTotal - customerTotal) >= 0.005 };
}
