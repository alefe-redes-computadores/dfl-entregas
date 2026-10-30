/** Um retorno é uma nova visita física confirmada, não uma tentativa, venda ou pagamento. */
export type DeliveryReturnVisit = {
  id: string;
  attempt_id: string;
  occurred_at: string;
};

export function appendConfirmedReturnVisit(history: DeliveryReturnVisit[] | undefined, visit: DeliveryReturnVisit): DeliveryReturnVisit[] {
  const previous = history || [];
  if (!visit.id.trim() || !visit.attempt_id.trim()) throw new Error('Vínculo da visita inválido.');
  if (!Number.isFinite(Date.parse(visit.occurred_at))) throw new Error('Data do retorno inválida.');
  if (previous.some(item => item.id === visit.id)) return previous;
  if (previous.some(item => item.attempt_id === visit.attempt_id)) throw new Error('Esta tentativa já possui retorno físico confirmado.');
  if (previous.length >= 50) throw new Error('Limite de retornos atingido.');
  return [...previous, {id:visit.id,attempt_id:visit.attempt_id,occurred_at:visit.occurred_at}];
}

/** Apenas para prévia; não participa de caixa, diária nem conclusão. */
export function confirmedReturnVisitCount(visits: DeliveryReturnVisit[] | undefined): number {
  return new Set((visits || []).map(item => item.attempt_id).filter(Boolean)).size;
}
