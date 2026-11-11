/**
 * P360 P2 — Politica local de entrega de notificacoes do APK.
 * Nao envia push remoto nem WhatsApp; nao altera a autoridade do Site.
 * Ausencia da configuracao conserva rigorosamente a entrega anterior.
 */
export type NotificationDeliveryPolicy = {
  quietEnabled: boolean;
  quietFrom: string;
  quietUntil: string;
  frequency: 'immediate' | 'balanced' | 'minimal';
  priority: 'all' | 'important';
  criticalDuringQuiet: boolean;
};

export const DEFAULT_NOTIFICATION_DELIVERY_POLICY: NotificationDeliveryPolicy = {
  quietEnabled: false,
  quietFrom: '23:00',
  quietUntil: '08:00',
  frequency: 'immediate',
  priority: 'all',
  criticalDuringQuiet: true,
};

const CRITICAL = new Set([
  'siteOrderNew',
  'ifoodPending',
  'stockZero',
  'syncFailure',
  'routeOpenReminder',
]);

// Somente estes alertas repetitivos admitem consolidacao por tema.
// Pedidos novos, problemas graves e confirmacoes nunca sofrem agrupamento temporal.
const THROTTLED = new Set(['routeStarted', 'routeFinished', 'stockLow', 'supplyCheck']);

const timeValid = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function resolveNotificationDeliveryPolicy(
  raw?: Partial<NotificationDeliveryPolicy> | null,
): NotificationDeliveryPolicy {
  const p = raw || {};
  return {
    quietEnabled: p.quietEnabled === true,
    quietFrom: timeValid(p.quietFrom) ? p.quietFrom : DEFAULT_NOTIFICATION_DELIVERY_POLICY.quietFrom,
    quietUntil: timeValid(p.quietUntil) ? p.quietUntil : DEFAULT_NOTIFICATION_DELIVERY_POLICY.quietUntil,
    frequency: p.frequency === 'balanced' || p.frequency === 'minimal' ? p.frequency : 'immediate',
    priority: p.priority === 'important' ? 'important' : 'all',
    criticalDuringQuiet: p.criticalDuringQuiet !== false,
  };
}

export function isQuietTime(at: Date, raw?: Partial<NotificationDeliveryPolicy> | null): boolean {
  const p = resolveNotificationDeliveryPolicy(raw);
  if (!p.quietEnabled || p.quietFrom === p.quietUntil || !Number.isFinite(at.getTime())) return false;
  const start = Number(p.quietFrom.slice(0, 2)) * 60 + Number(p.quietFrom.slice(3));
  const end = Number(p.quietUntil.slice(0, 2)) * 60 + Number(p.quietUntil.slice(3));
  const now = at.getHours() * 60 + at.getMinutes();
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export function isCriticalNotification(key: string | undefined): boolean {
  return Boolean(key && CRITICAL.has(key));
}

export function notificationPolicyAllows(
  key: string | undefined,
  at: Date,
  raw?: Partial<NotificationDeliveryPolicy> | null,
): boolean {
  // O teste manual continua intencionalmente independente das politicas.
  if (!key) return true;
  const policy = resolveNotificationDeliveryPolicy(raw);
  const critical = isCriticalNotification(key);
  if (policy.priority === 'important' && !critical) return false;
  if (isQuietTime(at, policy) && !(critical && policy.criticalDuringQuiet)) return false;
  return true;
}

export function notificationTopicCooldownMs(
  key: string | undefined,
  raw?: Partial<NotificationDeliveryPolicy> | null,
): number {
  if (!key || !THROTTLED.has(key) || isCriticalNotification(key)) return 0;
  const frequency = resolveNotificationDeliveryPolicy(raw).frequency;
  return frequency === 'balanced' ? 10 * 60_000 : frequency === 'minimal' ? 45 * 60_000 : 0;
}
