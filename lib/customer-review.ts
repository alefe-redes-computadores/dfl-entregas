/** R299 P7 — trilha de revisão operacional, separada do score e de categorias comerciais. */
import type { CustomerOperationalReview, CustomerOperationalReviewEvent, CustomerReviewState } from '@/types';

export const CUSTOMER_REVIEW_STATES = ['normal', 'observacao', 'revisado'] as const;

export function customerReviewLabel(state?: CustomerReviewState): string {
  return state === 'observacao' ? 'Em observação' : state === 'revisado' ? 'Revisado' : 'Sem ocorrência ativa';
}

export function appendCustomerReview(input: {
  previous?: CustomerOperationalReview;
  state: CustomerReviewState;
  reason: string;
  actorUid: string;
  eventId: string;
  occurredAt: string;
  relatedDeliveryId?: string;
}): CustomerOperationalReview {
  const reason = input.reason.trim().replace(/\s+/g, ' ');
  if (!CUSTOMER_REVIEW_STATES.includes(input.state)) throw new Error('Estado inválido.');
  if (reason.length < 12 || reason.length > 450) throw new Error('Informe motivo concreto de 12 a 450 caracteres.');
  if (!input.actorUid.trim() || !input.eventId.trim()) throw new Error('Autor e identificador são obrigatórios.');
  if (!Number.isFinite(Date.parse(input.occurredAt))) throw new Error('Data inválida.');
  const oldEvents = input.previous?.events ?? [];
  if (oldEvents.some(e => e.id === input.eventId)) return input.previous!; // retry idempotente
  if (oldEvents.length >= 80) throw new Error('Histórico no limite seguro do documento. Exporte e audite antes de continuar.');
  const event: CustomerOperationalReviewEvent = {
    id: input.eventId, state: input.state, reason,
    actor_uid: input.actorUid, occurred_at: input.occurredAt,
    ...(input.relatedDeliveryId?.trim() ? { related_delivery_id: input.relatedDeliveryId.trim() } : {}),
  };
  return { state: input.state, reason, changed_at: input.occurredAt,
    changed_by_uid: input.actorUid, events: [...oldEvents, event] };
}
