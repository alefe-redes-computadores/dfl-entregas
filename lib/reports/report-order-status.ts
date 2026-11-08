/**
 * R299 P4 — Situação operacional exibida nos relatórios.
 * Puro e sem leituras remotas. Conclusão NÃO confirma pagamento.
 */
import type { Delivery } from '@/types';

export type ReportOrderStatus = 'Pendente' | 'Concluído' | 'Cancelado';

export function reportOrderStatus(
  order: Pick<Delivery, 'source_system' | 'site_order_status' | 'completed'>,
): ReportOrderStatus {
  const siteStatus = String(order.site_order_status || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (order.source_system === 'dfl_site' &&
      ['cancelado', 'cancelada', 'cancelled', 'canceled'].includes(siteStatus)) return 'Cancelado';
  return order.completed === true ? 'Concluído' : 'Pendente';
}
