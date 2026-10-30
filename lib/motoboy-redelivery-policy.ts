import type { MotoboyPaymentRule } from '@/types';

/** Preview somente: nunca lançar no acerto sem confirmação independente da visita física. */
export function previewRedeliveryCompensation(rule: MotoboyPaymentRule | undefined, confirmedVisits: number) {
  const rate = Number(rule?.redelivery_fee ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 10000) throw new Error('Valor de reentrega inválido');
  if (!Number.isSafeInteger(confirmedVisits) || confirmedVisits < 0) throw new Error('Quantidade de visitas inválida');
  const cents = Math.round(rate * 100);
  return { confirmedVisits, rate: cents / 100, amount: (cents * confirmedVisits) / 100, automaticSettlement: false as const };
}
