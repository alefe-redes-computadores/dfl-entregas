/** R295 — filtro local por data de criação real, fuso da operação; nunca consulta o servidor. */
export type TrackingDateScope = 'day' | 'week' | 'all';
export type TrackingDatedDelivery = { created_at?: string; createdAt?: string };
const TZ = 'America/Sao_Paulo';
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function trackingTodayKey(value: Date = new Date()): string {
  return formatter.format(value);
}

export function trackingShiftKey(key: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isInteger(days)) return '';
  const date = new Date(`${key}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Não confundir data de criação com atualização da rota, conclusão ou envio de mensagem. */
export function trackingDeliveryDayKey(delivery: TrackingDatedDelivery): string {
  const stamp = delivery.created_at || delivery.createdAt;
  if (typeof stamp !== 'string' || !stamp.trim()) return '';
  const parsed = new Date(stamp);
  return Number.isFinite(parsed.getTime()) ? trackingTodayKey(parsed) : '';
}

export function matchingTrackingDate(delivery: TrackingDatedDelivery, scope: TrackingDateScope, day: string): boolean {
  if (scope === 'all') return true;
  const actual = trackingDeliveryDayKey(delivery);
  if (!actual || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  if (scope === 'day') return actual === day;
  return scope === 'week' && actual >= trackingShiftKey(day, -6) && actual <= day;
}
