import type { Delivery } from '@/types';
import { deriveDeliveryPaymentState, deliveryCustomerCharge } from '@/lib/delivery-finance';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';

/** A receber (não significa dinheiro em espécie): nunca confundir pedido entregue com pedido pago. */
export function routeOutstandingPayment(delivery: Delivery): { pending: boolean; amount: number } {
  if (isCancelledSiteDelivery(delivery) || deriveDeliveryPaymentState(delivery) === 'paid') {
    return { pending: false, amount: 0 };
  }
  return { pending: true, amount: deliveryCustomerCharge(delivery) };
}
