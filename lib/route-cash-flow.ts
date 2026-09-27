import type { Delivery } from '@/types';
import { deliveryCustomerCharge } from '@/lib/delivery-finance';

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
        !delivery.is_paid &&
        delivery.payment_method === 'dinheiro',
    )
    .map((delivery) => {
      const customerCharge = deliveryCustomerCharge(delivery);
      const informedTender = safeMoney(delivery.change_for);
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
  const clean = String(raw || '').replace(/[^\d,.]/g, '');
  if (!clean) return '';

  const separatorIndex = Math.max(clean.lastIndexOf(','), clean.lastIndexOf('.'));
  if (separatorIndex < 0) return clean.replace(/\D/g, '').slice(0, 7);

  const integer = clean.slice(0, separatorIndex).replace(/\D/g, '').slice(0, 7);
  const decimal = clean.slice(separatorIndex + 1).replace(/\D/g, '').slice(0, 2);
  return `${integer || '0'},${decimal}`;
}
