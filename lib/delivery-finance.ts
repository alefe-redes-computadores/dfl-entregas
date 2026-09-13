// lib/delivery-finance.ts
import type { Delivery } from '@/types';

/**
 * Contrato financeiro canônico.
 *
 * value = valor econômico total do pedido.
 * customer_charge = quanto o cliente efetivamente paga.
 * ifood_subsidy = parcela econômica bancada pelo iFood.
 *
 * Registros históricos não possuem customer_charge; nesses casos,
 * value continua sendo o fallback compatível.
 */
export const deliveryEconomicValue = (delivery: Delivery): number => {
  const value = Number(delivery.value || 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

export const deliveryCustomerCharge = (delivery: Delivery): number => {
  const raw =
    delivery.customer_charge !== undefined
      ? delivery.customer_charge
      : delivery.value;

  const value = Number(raw || 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

export const deliveryIfoodSubsidy = (delivery: Delivery): number => {
  const explicit = Number(delivery.ifood_subsidy || 0);

  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  /*
   * Não inventamos subsídio para registros antigos.
   * Só existe subsídio analítico quando foi salvo explicitamente.
   */
  return 0;
};

export const deliveryFinanceBreakdown = (delivery: Delivery) => ({
  economicValue: deliveryEconomicValue(delivery),
  customerCharge: deliveryCustomerCharge(delivery),
  subsidy: deliveryIfoodSubsidy(delivery),
});

export const sumDeliveryFinance = (deliveries: Delivery[]) =>
  deliveries.reduce(
    (acc, delivery) => {
      const current = deliveryFinanceBreakdown(delivery);
      acc.economicValue += current.economicValue;
      acc.customerCharge += current.customerCharge;
      acc.subsidy += current.subsidy;
      return acc;
    },
    {
      economicValue: 0,
      customerCharge: 0,
      subsidy: 0,
    },
  );
