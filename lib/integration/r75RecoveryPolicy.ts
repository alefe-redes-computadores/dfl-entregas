/** R75 P2 — revisão assistida individual. Pure, fail-closed; never sends, replays or issues tokens. */
import type { R75AuditView, R75AuditRecord } from './messagingAuditPolicyR75';

export type RecoveryDelivery = {
  id: string;
  origin?: unknown;
  source_system?: unknown;
  external_order_id?: unknown;
  fulfillment_mode?: unknown;
  notify_whatsapp?: unknown;
  manual_messaging_opt_in_v1?: unknown;
  completed?: unknown;
  operational_dismissed_at?: unknown;
  phone?: unknown;
};
export type RecoveryCase = {
  fingerprint: string;
  eventType: string;
  state: 'dead_letter' | 'failed';
  title: string;
  text: string;
};
export type RecoveryReview = {
  allowed: boolean;
  reason: 'ready' | 'no_order' | 'other_order' | 'audit_unavailable' | 'audit_stale' |
    'audit_limited' | 'not_manual' | 'no_consent' | 'no_contact' | 'not_active' |
    'no_reviewable_events';
  cases: RecoveryCase[];
};
const no = (reason: RecoveryReview['reason']): RecoveryReview => ({ allowed: false, reason, cases: [] });
const safeEvent = new Set(['order.created', 'order.ready', 'delivery.started']);
const titles: Record<string, string> = {
  'order.created': 'Pedido cadastrado',
  'order.ready': 'Pronto para retirada',
  'delivery.started': 'Saiu para entrega',
};
const OUTREACH = 'Olá! 🖤 Tivemos uma instabilidade temporária nos avisos da Da Família Lanches. Para confirmar a situação atual do seu pedido, fale com nossa equipe por esta conversa. Obrigado pela compreensão!';
/**
 * Audit evidence is intentionally INSUFFICIENT to prove that a provider did not accept an old event.
 * This decision only permits an owner to COPY a fresh, neutral customer contact text after
 * independent human verification. It never permits an automated replay or a new tracking link.
 */
export function r75RecoveryReview(
  audit: R75AuditView | null,
  delivery: RecoveryDelivery | null | undefined,
  selectedDeliveryId: string,
  auditedDeliveryId: string,
  now = Date.now(),
): RecoveryReview {
  if (!delivery || !selectedDeliveryId) return no('no_order');
  if (selectedDeliveryId !== delivery.id || auditedDeliveryId !== delivery.id) return no('other_order');
  if (!audit || audit.status !== 'ok' || !audit.checkedAt) return no('audit_unavailable');
  const checked = Date.parse(audit.checkedAt);
  if (!Number.isFinite(checked) || checked > now + 30_000 || now - checked > 180_000) return no('audit_stale');
  if (audit.sampleLimited || audit.records.length > 24) return no('audit_limited');
  if (!['loja', 'manual'].includes(String(delivery.origin)) ||
      !(delivery.source_system == null || delivery.source_system === 'manual') ||
      Boolean(delivery.external_order_id) ||
      !['pickup', 'delivery'].includes(String(delivery.fulfillment_mode))) return no('not_manual');
  if (delivery.notify_whatsapp !== true || delivery.manual_messaging_opt_in_v1 !== true) return no('no_consent');
  if (typeof delivery.phone !== 'string' || delivery.phone.replace(/\D/g, '').length < 10) return no('no_contact');
  if (delivery.completed === true || Boolean(delivery.operational_dismissed_at)) return no('not_active');
  const filtered = audit.records.filter(r => safeEvent.has(r.eventType) &&
    (r.eventType !== 'order.ready' || delivery.fulfillment_mode === 'pickup') &&
    (r.eventType !== 'delivery.started' || delivery.fulfillment_mode === 'delivery'));
  const byEvent = new Map<string, R75AuditRecord[]>();
  for (const row of filtered) byEvent.set(row.eventType, [...(byEvent.get(row.eventType) || []), row]);
  const cases: RecoveryCase[] = [];
  for (const [eventType, rows] of byEvent) {
    // No manual action when another record may still be sent or in flight.
    if (rows.some(r => ['sent','processing','pending','unknown','suppressed'].includes(r.state) || r.providerAccepted)) continue;
    // Multiple failures of the same event need human technical review, not a generic copy action.
    if (rows.length !== 1) continue;
    const row = rows[0];
    if (row.state !== 'dead_letter' && row.state !== 'failed') continue;
    cases.push({ fingerprint: row.fingerprint, eventType,
      state: row.state, title: titles[eventType] || 'Aviso', text: OUTREACH });
  }
  if (!cases.length) return no('no_reviewable_events');
  return { allowed: true, reason: 'ready', cases };
}

export const r75RecoveryReason: Record<RecoveryReview['reason'], string> = {
  ready: 'Escolha o aviso para preparar contato humano.',
  no_order: 'Selecione um pedido e consulte a auditoria.',
  other_order: 'A seleção mudou. Consulte novamente este pedido antes de qualquer contato.',
  audit_unavailable: 'Auditoria indisponível. Nenhuma recuperação autorizada.',
  audit_stale: 'Auditoria desatualizada. Atualize o panorama antes de continuar.',
  audit_limited: 'Amostra limitada; não é seguro decidir sem histórico completo.',
  not_manual: 'Esta origem não utiliza o canal manual de mensagens.',
  no_consent: 'Consentimento individual de WhatsApp ausente. Não usar esta assistência.',
  no_contact: 'Telefone ausente ou inválido. Conferir o cadastro.',
  not_active: 'Pedido concluído ou dispensado; confirmação operacional necessária.',
  no_reviewable_events: 'Nenhum aviso permite assistência neste estado. Enviados e pendentes não podem ser repetidos.',
};
