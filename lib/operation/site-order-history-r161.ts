import type { Delivery } from '@/types';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { deliveryAttemptLabel } from '@/lib/delivery-attempts';

export type SiteHistoryKind = 'cancelado' | 'retirado_operacao' | 'entregue' | 'tentativa' | 'alocado' | 'outro';
export function siteHistoryKind(item: Delivery): SiteHistoryKind {
  if (isCancelledSiteDelivery(item)) return 'cancelado';
  if (item.operational_dismissed_at) return 'retirado_operacao';
  if (item.completed === true) return 'entregue';
  if (item.delivery_attempts?.length) return 'tentativa';
  if (item.route_id?.trim()) return 'alocado';
  return 'outro';
}
export function siteHistoryLabel(item: Delivery): string {
  const kind = siteHistoryKind(item);
  if (kind === 'cancelado') return 'Cancelado comercialmente pelo Site';
  if (kind === 'retirado_operacao') return 'Retirado da fila operacional';
  if (kind === 'entregue') return 'Concluído como entregue';
  if (kind === 'tentativa') return 'Tentativa de entrega registrada · não confirma entrega';
  if (kind === 'alocado') return 'Vinculado a uma rota';
  return 'Registro do Site';
}
// R166_HISTORY_DATE: formato humano sem alterar o evento armazenado.
function historyDate(value?: string | null): string {
  if (!value) return 'data não informada';
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}) : 'data não informada';
}
export function siteHistoryDetail(item: Delivery): string {
  if (isCancelledSiteDelivery(item)) return `Status comercial: ${item.site_order_status || 'cancelado'} · ${historyDate(item.site_order_status_updated_at || item.site_order_last_event_at)}`;
  if (item.operational_dismissed_at) return `${item.operational_dismissal_reason || 'Motivo não informado'} · ${historyDate(item.operational_dismissed_at)}`;
  if (item.completed) return `Entrega concluída em ${historyDate(item.completed_at)}`;
  const last = item.delivery_attempts?.[item.delivery_attempts.length - 1];
  if (last) return `${deliveryAttemptLabel(last.reason)} · ${historyDate(last.at)}${last.note ? ` · ${last.note}` : ''}`;
  return item.route_id?.trim() ? 'Rota vinculada' : 'Sem encerramento confirmado';
}
export function siteHistoryRows(deliveries: readonly Delivery[], limit = 30): Delivery[] {
  const byId = new Map<string, Delivery>();
  for (const item of deliveries) {
    if (item.source_system !== 'dfl_site') continue;
    if (!['cancelado','retirado_operacao','entregue','tentativa'].includes(siteHistoryKind(item))) continue;
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((a,b) =>
    String(b.operational_dismissed_at || b.completed_at || b.site_order_status_updated_at || b.updated_at || b.created_at || '').localeCompare(
      String(a.operational_dismissed_at || a.completed_at || a.site_order_status_updated_at || a.updated_at || a.created_at || ''))
    || a.id.localeCompare(b.id)).slice(0,Math.max(0,limit));
}
