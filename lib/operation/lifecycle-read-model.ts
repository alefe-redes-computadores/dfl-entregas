import type { Delivery } from '@/types';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { isFutureScheduledDelivery } from '@/lib/scheduled-delivery';

/** Classificacao somente leitura: nunca reinterpreta tentativa como entrega. */
export type OperationalLifecycle =
  | 'cancelado_comercial' | 'retirado_operacao' | 'entregue'
  | 'agendado_protegido' | 'tentativa_registrada' | 'pendente';

export function operationalLifecycle(delivery: Delivery, now = Date.now()): OperationalLifecycle {
  if (isCancelledSiteDelivery(delivery)) return 'cancelado_comercial';
  if (delivery.operational_dismissed_at) return 'retirado_operacao';
  if (delivery.completed === true) return 'entregue';
  if (delivery.source_system === 'dfl_site' && isFutureScheduledDelivery(delivery, now)) return 'agendado_protegido';
  if ((delivery.delivery_attempts || []).length > 0) return 'tentativa_registrada';
  return 'pendente';
}
export function isActionableOperationalDelivery(delivery: Delivery, now = Date.now()): boolean {
  const state = operationalLifecycle(delivery, now);
  return state === 'pendente' || state === 'tentativa_registrada';
}

/** Registro de tentativa continua aberto; uma exclusao fisica nao pode ser inferida deste modelo. */
export function lifecycleExplanation(value: OperationalLifecycle): string {
  switch (value) {
    case 'cancelado_comercial': return 'Cancelado pelo Site. Nao liberar para rota.';
    case 'retirado_operacao': return 'Retirado da operacao, sem confirmar entrega.';
    case 'entregue': return 'Entrega concluida.';
    case 'agendado_protegido': return 'Agendamento futuro, aguardando janela logistica.';
    case 'tentativa_registrada': return 'Houve tentativa; a entrega nao esta confirmada.';
    default: return 'Pedido pendente de tratamento operacional.';
  }
}
