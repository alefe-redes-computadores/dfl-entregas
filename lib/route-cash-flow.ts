import type { Delivery } from '@/types';
import { deliveryCustomerCharge, deriveDeliveryPaymentState } from '@/lib/delivery-finance';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';

/** R110 P5: apenas uma divisao integralmente validada pode determinar o dinheiro fisico. */
function cashPaymentPart(delivery: Delivery): { charge: number; tendered: number } | null {
  const parts = delivery.payment_splits;
  if (!parts?.length) return null;
  const chargeCents = Math.round(deliveryCustomerCharge(delivery) * 100);
  if (!Number.isSafeInteger(chargeCents) || chargeCents < 0 || parts.length < 2 || parts.length > 5) return null;
  const seen = new Set<string>();
  let total = 0;
  let cash = 0;
  let tendered = 0;
  for (const part of parts) {
    if (!part || !['dinheiro', 'pix', 'cartao', 'cartao_credito', 'cartao_debito'].includes(part.method) ||
      seen.has(part.method) || !Number.isSafeInteger(part.amountCents) || part.amountCents <= 0) return null;
    seen.add(part.method);
    total += part.amountCents;
    if (part.method === 'dinheiro') {
      cash = part.amountCents;
      if (part.tenderedCents !== undefined && (!Number.isSafeInteger(part.tenderedCents) || part.tenderedCents < cash)) return null;
      tendered = part.tenderedCents ?? cash;
    } else if (part.tenderedCents !== undefined) return null;
  }
  if (total !== chargeCents) return null;
  return { charge: cash / 100, tendered: tendered / 100 };
}


const safeMoney = (value: unknown) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

/**
 * Motor financeiro físico da rota.
 *
 * customerCharge = valor econômico que pertence à loja.
 * tenderedCash = dinheiro que o cliente entrega ao motoboy.
 * requestedChange = tenderedCash - customerCharge.
 * initialCash = dinheiro físico que saiu do caixa na bag.
 *
 * O troco pode ser dividido entre dinheiro e Pix.
 * O caixa físico esperado na volta NÃO é simplesmente a soma das vendas:
 * bag inicial + dinheiro recebido - troco devolvido em espécie.
 */
export function routeCashFlow(deliveries: Delivery[], initialCashInput = 0) {
  const initialCash = safeMoney(initialCashInput);

  const cashOrders = deliveries
    .filter(
      (delivery) =>
        !isCancelledSiteDelivery(delivery) &&
        deriveDeliveryPaymentState(delivery) === 'collect_on_delivery' &&
        (delivery.payment_splits?.length ? (cashPaymentPart(delivery)?.charge ?? 0) > 0 : delivery.payment_method === 'dinheiro'),
    )
    .map((delivery) => {
      const splitCash = delivery.payment_splits?.length ? cashPaymentPart(delivery) : null;
      const customerCharge = splitCash ? splitCash.charge : deliveryCustomerCharge(delivery);
      const informedTender = splitCash ? splitCash.tendered : safeMoney(delivery.change_for);
      const tenderedCash =
        informedTender > customerCharge ? informedTender : customerCharge;
      const requestedChange = Math.max(0, tenderedCash - customerCharge);

      return {
        delivery,
        customerCharge,
        tenderedCash,
        requestedChange,
      };
    });

  const customerCharges = cashOrders.reduce(
    (sum, item) => sum + item.customerCharge,
    0,
  );
  const tenderedCash = cashOrders.reduce(
    (sum, item) => sum + item.tenderedCash,
    0,
  );
  const requiredChange = cashOrders.reduce(
    (sum, item) => sum + item.requestedChange,
    0,
  );

  // O dinheiro da bag é consumido primeiro. O restante é previsão de Pix.
  const plannedCashChange = Math.min(initialCash, requiredChange);
  const plannedPixChange = Math.max(0, requiredChange - plannedCashChange);
  const unusedInitialCash = Math.max(0, initialCash - plannedCashChange);

  // Ex.: pedido 64, cliente entrega 100, bag sai com 36:
  // 36 + 100 - 36 = 100 voltando fisicamente.
  const expectedPhysicalReturn = Math.max(
    0,
    initialCash + tenderedCash - plannedCashChange,
  );

  return {
    cashOrders,
    initialCash,
    customerCharges,
    tenderedCash,
    requiredChange,
    plannedCashChange,
    plannedPixChange,
    unusedInitialCash,
    expectedPhysicalReturn,
  };
}

/** Ação Dinheiro só existe quando há cédulas na bag ou cobrança física real. */
export function hasPhysicalCashForRoute(deliveries: Delivery[], initialCash = 0): boolean {
  const flow = routeCashFlow(deliveries, initialCash);
  return flow.initialCash > 0 || flow.cashOrders.length > 0;
}

export function parseMoneyDraft(raw: string) {
  const clean = String(raw || '')
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '');

  if (!clean) return 0;

  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);

  let normalized = clean;

  if (decimalIndex >= 0) {
    const integer = clean.slice(0, decimalIndex).replace(/[.,]/g, '');
    const decimal = clean.slice(decimalIndex + 1).replace(/[.,]/g, '').slice(0, 2);
    normalized = `${integer || '0'}.${decimal || '0'}`;
  } else {
    normalized = clean.replace(/[.,]/g, '');
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function normalizeMoneyDraft(raw: string) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 9);
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const integer = padded.slice(0, -2).replace(/^0+(?=\d)/, '');
  const decimal = padded.slice(-2);
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimal}`;
}

export function moneyValueToDraft(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return normalizeMoneyDraft(String(Math.round(safe * 100)));
}
