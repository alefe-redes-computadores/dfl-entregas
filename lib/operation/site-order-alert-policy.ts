/** R228 — Somente um evento recente pode emitir alerta do Site.
 * O backlog continua pertencendo ao Firestore/Inbox, nunca a este filtro.
 */
type SiteOrderAge = {
  created_at?: unknown;
  createdAt?: unknown;
  updated_at?: unknown;
};
export const SITE_ORDER_ALERT_MAX_AGE_MS = 4 * 60_000;
function timestampMillis(value: unknown): number | null {
  if (typeof value === 'string' || typeof value === 'number') {
    const n = typeof value === 'string' ? Date.parse(value) : value;
    return Number.isFinite(n) ? n : null;
  }
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && 'toDate' in value) {
    const maybe = (value as { toDate?: unknown }).toDate;
    if (typeof maybe === 'function') {
      try { const dt = maybe.call(value) as Date; return dt instanceof Date ? dt.getTime() : null; }
      catch { return null; }
    }
  }
  return null;
}
export function shouldAlertSiteOrderNow(delivery: SiteOrderAge, nowMs: number): boolean {
  if (!Number.isFinite(nowMs)) return false;
  const created = timestampMillis(delivery.created_at ?? delivery.createdAt ?? delivery.updated_at);
  if (created === null) return false; // sem timestamp confiável, nenhuma notificação fantasma
  const age = nowMs - created;
  return age >= -15_000 && age <= SITE_ORDER_ALERT_MAX_AGE_MS;
}
