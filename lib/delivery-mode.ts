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

export function fulfillmentOperationalLabel(
  delivery: Pick<Delivery, 'fulfillment_mode'>,
): string {
  const mode = getFulfillmentMode(delivery);

  if (mode === 'pickup') return 'Retirada na loja';
  if (mode === 'counter') return 'Atendimento presencial / balcão';

  return 'Entrega em rota';
}
