// lib/delivery-mode.ts
import type { Delivery, FulfillmentMode } from '@/types';

export const FULFILLMENT_LABELS: Record<FulfillmentMode, string> = {
  delivery: 'Entrega',
  pickup: 'Retirada',
  counter: 'Balcão / Presencial',
};

export function getFulfillmentMode(
  delivery: Pick<Delivery, 'fulfillment_mode'>,
): FulfillmentMode {
  return delivery.fulfillment_mode ?? 'delivery';
}

export function isDeliveryFulfillment(
  delivery: Pick<Delivery, 'fulfillment_mode'>,
): boolean {
  return getFulfillmentMode(delivery) === 'delivery';
}

export function fulfillmentLabel(
  delivery: Pick<Delivery, 'fulfillment_mode'>,
): string {
  return FULFILLMENT_LABELS[getFulfillmentMode(delivery)];
}
