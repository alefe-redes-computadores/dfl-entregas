import type { Delivery, PaymentMethod } from '@/types';

/** Centavos inteiros impedem divergencias de ponto flutuante. */
export type DeliveryPaymentPart = Readonly<{
  method: PaymentMethod;
  amountCents: number;
  /** Valor entregue pelo cliente em dinheiro, nao valor do pedido. */
  tenderedCents?: number;
}>;

export type SplitPaymentReview = Readonly<{
  valid: boolean;
  errors: string[];
  totalCents: number;
  expectedCents: number;
  cashCents: number;
  cardCents: number;
  pixCents: number;
  changeCents: number;
}>;

const MAX_CENTS = 100_000_000;
const allowed = new Set<PaymentMethod>(['dinheiro', 'pix', 'cartao', 'cartao_credito', 'cartao_debito']);
export function toPaymentCents(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value * 100 > MAX_CENTS) return null;
  const cents = Math.round(value * 100);
  return Math.abs(value * 100 - cents) < 0.00001 ? cents : null;
}

export function reviewDeliveryPaymentSplit(
  customerCharge: number,
  parts: readonly DeliveryPaymentPart[],
): SplitPaymentReview {
  const errors: string[] = [];
  const expected = toPaymentCents(customerCharge);
  if (expected === null) errors.push('Valor total da entrega invalido.');
  if (!Array.isArray(parts) || parts.length < 2 || parts.length > 5) errors.push('Informe de 2 a 5 parcelas de pagamento.');
  let totalCents = 0, cashCents = 0, cardCents = 0, pixCents = 0, changeCents = 0;
  const methods = new Set<PaymentMethod>();
  for (const part of Array.isArray(parts) ? parts : []) {
    if (!part || !allowed.has(part.method) || !Number.isSafeInteger(part.amountCents) || part.amountCents <= 0 || part.amountCents > MAX_CENTS) {
      errors.push('Forma de pagamento ou valor de parcela invalido.');
      continue;
    }
    if (methods.has(part.method)) errors.push('Una parcelas da mesma forma de pagamento.');
    methods.add(part.method);
    totalCents += part.amountCents;
    if (part.method === 'dinheiro') {
      cashCents += part.amountCents;
      if (part.tenderedCents !== undefined) {
        if (!Number.isSafeInteger(part.tenderedCents) || part.tenderedCents < part.amountCents || part.tenderedCents > MAX_CENTS) errors.push('Valor entregue em dinheiro nao cobre sua parcela.');
        else changeCents += part.tenderedCents - part.amountCents;
      }
    } else {
      if (part.tenderedCents !== undefined) errors.push('Troco permitido apenas para dinheiro.');
      if (part.method === 'pix') pixCents += part.amountCents;
      else cardCents += part.amountCents;
    }
  }
  if (expected !== null && totalCents !== expected) errors.push('A soma das parcelas precisa ser igual ao valor cobrado do cliente.');
  return { valid: errors.length === 0, errors, totalCents, expectedCents: expected ?? 0, cashCents, cardCents, pixCents, changeCents };
}

/** Nunca presumir liquidacao: so considera partes de uma entrega integralmente paga quando is_paid=true. */
export function deliverySplitStatus(delivery: Pick<Delivery, 'customer_charge' | 'value' | 'payment_splits' | 'is_paid'>) {
  if (!delivery.payment_splits?.length) return null;
  const charge = delivery.customer_charge ?? delivery.value;
  const review = reviewDeliveryPaymentSplit(charge, delivery.payment_splits);
  return { ...review, paid: review.valid && delivery.is_paid === true };
}
