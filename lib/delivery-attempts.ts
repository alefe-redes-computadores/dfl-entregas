/** Tentativa não representa conclusão, cancelamento nem confirmação iFood. */
export const DELIVERY_ATTEMPT_REASONS = [
  { value: 'customer_absent', label: 'Cliente ausente' },
  { value: 'no_response', label: 'Cliente não atendeu' },
  { value: 'wrong_address', label: 'Endereço não localizado' },
  { value: 'later_requested', label: 'Pediu para entregar mais tarde' },
  { value: 'other', label: 'Outra ocorrência' },
] as const;

export type DeliveryAttemptReason = (typeof DELIVERY_ATTEMPT_REASONS)[number]['value'];
export type DeliveryAttempt = { id: string; reason: DeliveryAttemptReason; at: string; note?: string };
export const deliveryAttemptLabel = (reason: DeliveryAttemptReason): string =>
  DELIVERY_ATTEMPT_REASONS.find(item => item.value === reason)?.label || 'Outra ocorrência';

/** Never silently discard operational history or mutate the existing array. */
export function appendDeliveryAttempt(history: DeliveryAttempt[] | undefined, item: DeliveryAttempt): DeliveryAttempt[] {
  const previous = history || [];
  if (previous.some(value => value.id === item.id)) return previous;
  if (previous.length >= 50) throw new Error('Histórico de tentativas cheio. Revise o pedido antes de continuar.');
  if (!Number.isFinite(Date.parse(item.at))) throw new Error('Data de tentativa inválida.');
  if (!DELIVERY_ATTEMPT_REASONS.some(value => value.value === item.reason)) throw new Error('Motivo de tentativa inválido.');
  const { note, ...base } = item;
  const normalizedNote = String(note || '').trim().slice(0, 240);
  return [...previous, { ...base, ...(normalizedNote ? { note: normalizedNote } : {}) }];
}
