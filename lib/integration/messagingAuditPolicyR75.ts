/** R75 P1: minimum public-to-owner audit projection. No PII, no replay authority. */
export type R75AuditState = 'pending' | 'processing' | 'sent' | 'failed' | 'dead_letter' | 'suppressed' | 'unknown';
export type R75AuditRecord = {
  eventType: string; state: R75AuditState; fingerprint: string;
  createdAt: string | null; sentAt: string | null; providerAccepted: boolean; failureCode: string | null;
};
export type R75AuditView = {
  status: 'ok' | 'not_applicable' | 'not_configured' | 'unavailable';
  checkedAt: string | null; sampleLimited: boolean; records: R75AuditRecord[];
  customerDeliveryVerified: false;
};
export const r75AuditUnavailable = (status: 'not_applicable' | 'not_configured' | 'unavailable'): R75AuditView =>
  ({ status, checkedAt: null, sampleLimited: false, records: [], customerDeliveryVerified: false });
const states = new Set<R75AuditState>(['pending','processing','sent','failed','dead_letter','suppressed','unknown']);
const events = new Set(['order.created','order.production','order.ready','order.cancelled','delivery.started','delivery.next_stop','delivery.position_changed','delivery.completed','delivery.failed','unknown']);
const isObj = (x: unknown): x is Record<string, unknown> => Boolean(x && typeof x === 'object' && !Array.isArray(x));
const validIso = (x: unknown): x is string => typeof x === 'string' && x.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(x) && Number.isFinite(Date.parse(x));
export function r75ValidAuditEnvelope(x: unknown, deliveryId: string): x is {
  contract: 'dfl.messaging.audit.v1'; version: 1; ok: true; source: 'manual'; orderId: string;
  eventType: 'all'; checkedAt: string; records: R75AuditRecord[]; sampleLimited: boolean; customerDeliveryVerified: false;
} {
  if (!isObj(x) || Object.keys(x).length !== 10 ||
      !Object.keys(x).every(k => ['contract','version','ok','source','orderId','eventType','checkedAt','records','sampleLimited','customerDeliveryVerified'].includes(k)) ||
      x.contract !== 'dfl.messaging.audit.v1' || x.version !== 1 || x.ok !== true || x.source !== 'manual' ||
      x.orderId !== `entregas:${deliveryId}` || x.eventType !== 'all' || !validIso(x.checkedAt) ||
      typeof x.sampleLimited !== 'boolean' || x.customerDeliveryVerified !== false ||
      !Array.isArray(x.records) || x.records.length > 24) return false;
  return x.records.every((row: unknown) => isObj(row) && Object.keys(row).length === 7 &&
    Object.keys(row).every(k => ['eventType','state','fingerprint','createdAt','sentAt','providerAccepted','failureCode'].includes(k)) &&
    events.has(String(row.eventType)) && states.has(row.state as R75AuditState) &&
    typeof row.fingerprint === 'string' && /^[a-f0-9]{16}$/.test(row.fingerprint) &&
    (row.createdAt === null || validIso(row.createdAt)) && (row.sentAt === null || validIso(row.sentAt)) &&
    typeof row.providerAccepted === 'boolean' &&
    (row.failureCode === null || (typeof row.failureCode === 'string' && /^[A-Z][A-Z0-9_]{2,80}$/.test(row.failureCode))));
}
export function r75AuditDisposition(row: R75AuditRecord): { title: string; note: string; requiresReview: boolean } {
  if (row.state === 'dead_letter') return { title: 'Retido para revisão', note: 'Sem reenvio automático. Conferir estado real e contato com o cliente.', requiresReview: true };
  if (row.state === 'sent') return { title: 'Aceito pelo provedor', note: 'Não comprova entrega no celular nem leitura.', requiresReview: false };
  if (row.state === 'pending') return { title: 'Aguardando processamento', note: 'O worker pode tentar novamente dentro do limite; não duplicar.', requiresReview: false };
  if (row.state === 'processing') return { title: 'Processando', note: 'Resultado ainda não confirmado. Não reenviar.', requiresReview: false };
  return { title: 'Exige conferência', note: 'Estado não suficiente para autorizar reenvio. Verifique a auditoria.', requiresReview: true };
}
