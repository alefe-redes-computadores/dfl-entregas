import type { Delivery, Motoboy, MotoboyAdjustment, Route } from '@/types';

/** Uma visita física gera no máximo um documento financeiro, entre quaisquer aparelhos. */
export function redeliveryAdjustmentDocumentId(deliveryId: string, attemptId: string): string {
  for (const part of [deliveryId, attemptId]) {
    if (!part || part.length > 150 || part.includes('/')) throw new Error('Identidade do retorno inválida.');
  }
  return `return-pay:${encodeURIComponent(deliveryId)}:${encodeURIComponent(attemptId)}`;
}

const dateInBrazil = (iso: string): string => {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error('Data da visita física inválida.');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(date);
  const part = (name: string) => parts.find(item => item.type === name)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const normalized = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');

/** Esta validação roda dentro da transação Firestore, usando documentos REMOTOS. */
export function assertAuthorizedReturnPayment(input: {
  adjustment: MotoboyAdjustment;
  delivery: Delivery;
  route: Route;
  motoboy: Motoboy;
}): void {
  const {adjustment,delivery,route,motoboy} = input;
  const visitId = adjustment.return_visit_id;
  if (!visitId || !adjustment.return_attempt_id || adjustment.return_delivery_id !== delivery.id) throw new Error('Retorno não vinculado ao pedido original.');
  if (adjustment.id !== redeliveryAdjustmentDocumentId(delivery.id,adjustment.return_attempt_id)) throw new Error('Identidade financeira do retorno divergente.');
  if (adjustment.direction !== 'addition' || adjustment.status !== 'pending') throw new Error('Retorno exige acréscimo pendente explícito.');
  if (motoboy.id !== adjustment.motoboy_id || route.id !== delivery.route_id) throw new Error('Vínculo de rota ou motoboy divergente.');
  if (route.motoboy_id ? route.motoboy_id !== motoboy.id : normalized(route.motoboy_name || '') !== normalized(motoboy.name)) {
    throw new Error('Retorno pertence a outro motoboy.');
  }
  const visit = delivery.redelivery_visits?.find(item=>item.id===visitId);
  if (!visit || !delivery.delivery_attempts?.some(item=>item.id===visit.attempt_id)) throw new Error('Visita física não confirmada no Firestore.');
  if (visit.attempt_id !== adjustment.return_attempt_id || delivery.redelivery_visits?.filter(item=>item.attempt_id===visit.attempt_id).length !== 1) throw new Error('Tentativa com retorno divergente ou duplicado.');
  if (dateInBrazil(visit.occurred_at) !== adjustment.operational_date) throw new Error('Data do acerto não corresponde à visita física.');
  if (!adjustment.description.includes(`[retorno:${visitId}]`)) throw new Error('Descrição sem evidência do retorno.');
  const configured = Number(motoboy.payment_rule?.redelivery_fee ?? 0);
  if (!Number.isFinite(configured) || configured <= 0 || configured > 10000) throw new Error('Tarifa de retorno não configurada ou inválida.');
  const cents = Math.round(configured*100);
  if (!Number.isFinite(adjustment.amount) || Math.round(adjustment.amount*100)!==cents) throw new Error('Valor diferente da tarifa de retorno configurada no servidor.');
}
