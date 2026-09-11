// lib/native/notifications.ts
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type {
  DaySchedule,
  HolidayOverride,
  Route,
  StockProduct,
  StorePause,
} from '@/types';
import {
  dateKey,
  minutes,
  nextOperationalClosingAt,
  shiftDateKey,
} from '@/lib/operational-time';

const MAX_ID = 2147483647;
const SHIFT_HORIZON_DAYS = 21;
const SHIFT_NOTICE_MINUTES = 15;
const SUPPLY_CHECK_DELAY_MINUTES = 10;
const lastSent = new Map<string, number>();

type NotificationOwner =
  | 'immediate'
  | 'shift'
  | 'route-reminder'
  | 'stock-supply';

export type NotificationPreferences = {
  enabled: boolean;
  shiftPrepare: boolean;
  shiftOpen: boolean;
  shiftPreClose: boolean;
  shiftClose: boolean;
  routeOpenReminder: boolean;
  routeFinished: boolean;
  ifoodPending: boolean;
  stockLow: boolean;
  stockZero: boolean;
  supplyCheck: boolean;
  syncFailure: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  shiftPrepare: true,
  shiftOpen: false,
  shiftPreClose: true,
  shiftClose: false,
  routeOpenReminder: true,
  routeFinished: true,
  ifoodPending: true,
  stockLow: true,
  stockZero: true,
  supplyCheck: true,
  syncFailure: true,
};

export function resolveNotificationPreferences(
  value?: Partial<NotificationPreferences>,
): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(value || {}),
  };
}

export type NotificationPreferenceKey = Exclude<
  keyof NotificationPreferences,
  'enabled'
>;

function preferenceEnabled(
  value: Partial<NotificationPreferences> | undefined,
  key: NotificationPreferenceKey,
) {
  const resolved = resolveNotificationPreferences(value);
  return resolved.enabled && resolved[key];
}

type ScheduleSettings = {
  alertsEnabled?: boolean;
  routeReminderEnabled?: boolean;
  notificationPreferences?: Partial<NotificationPreferences>;
  schedule?: Record<number, DaySchedule>;
  pauses?: StorePause[];
  holidaysOverrides?: Record<string, HolidayOverride>;
};

type StockThresholdChange = {
  before: StockProduct;
  after: StockProduct;
};

export function notificationIdFromKey(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const value = Math.abs(hash) % MAX_ID;
  return value || 1;
}

function isNative() {
  return Capacitor.isNativePlatform();
}

async function ensurePermission() {
  if (!isNative()) return false;

  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;

  const requested = await LocalNotifications.requestPermissions();
  return requested.display === 'granted';
}

function persistentLastSent(key: string) {
  const memory = lastSent.get(key) || 0;
  try {
    const persisted = Number(localStorage.getItem(`dfl-notification:${key}`) || 0);
    return Math.max(memory, Number.isFinite(persisted) ? persisted : 0);
  } catch {
    return memory;
  }
}

function rememberSent(key: string, value: number) {
  lastSent.set(key, value);
  try {
    localStorage.setItem(`dfl-notification:${key}`, String(value));
  } catch {
    // WebView sem storage disponível: o cooldown em memória continua valendo.
  }
}

async function cancelOwner(owner: NotificationOwner) {
  if (!isNative()) return;

  try {
    const pending = await LocalNotifications.getPending();
    const notifications = pending.notifications.filter(
      (item) => (item.extra as { dflOwner?: string } | undefined)?.dflOwner === owner,
    );
    if (notifications.length) {
      await LocalNotifications.cancel({ notifications });
    }
  } catch (error) {
    console.warn(`[NOTIFICATIONS] Falha ao limpar ${owner}:`, error);
  }
}

async function cancelId(id: number) {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    // Cancelamento idempotente.
  }
}

function ownerExtra(
  owner: NotificationOwner,
  extra?: Record<string, unknown>,
) {
  return {
    dflOwner: owner,
    ...extra,
  };
}

export async function notifyOperational(
  key: string,
  title: string,
  body: string,
  options?: {
    cooldownMs?: number;
    extra?: Record<string, unknown>;
    preferences?: Partial<NotificationPreferences>;
    preferenceKey?: NotificationPreferenceKey;
  },
) {
  if (!isNative()) return false;
  if (
    options?.preferenceKey &&
    !preferenceEnabled(options.preferences, options.preferenceKey)
  ) {
    return false;
  }

  const now = Date.now();
  const cooldown = options?.cooldownMs ?? 60_000;
  if (now - persistentLastSent(key) < cooldown) return false;

  try {
    if (!(await ensurePermission())) return false;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationIdFromKey(key),
          title,
          body,
          schedule: {
            at: new Date(now + 500),
            allowWhileIdle: true,
          },
          extra: ownerExtra('immediate', options?.extra),
        },
      ],
    });

    rememberSent(key, now);
    return true;
  } catch (error) {
    console.error('[NOTIFICATIONS] Falha operacional:', error);
    return false;
  }
}

function weekdayFromDateKey(key: string) {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

function isPaused(pauses: StorePause[] | undefined, key: string) {
  return Boolean(
    pauses?.some(
      (pause) =>
        key >= pause.start_date.slice(0, 10) &&
        key <= pause.end_date.slice(0, 10),
    ),
  );
}

function resolvedDay(
  key: string,
  settings: ScheduleSettings,
): DaySchedule | undefined {
  if (isPaused(settings.pauses, key)) return undefined;

  const holiday = settings.holidaysOverrides?.[key];
  if (holiday) {
    return {
      active: holiday.active,
      shifts: holiday.shifts || [],
    };
  }

  return settings.schedule?.[weekdayFromDateKey(key)];
}

function operationalDateTime(key: string, time: string) {
  return new Date(`${key}T${time}:00-03:00`);
}

function minusMinutes(value: Date, amount: number) {
  return new Date(value.getTime() - amount * 60_000);
}

function shiftCloseAt(key: string, start: string, end: string) {
  const startMinutes = minutes(start);
  const endMinutes = minutes(end);
  if (startMinutes < 0 || endMinutes < 0 || startMinutes === endMinutes) {
    return null;
  }

  const closeKey = endMinutes < startMinutes ? shiftDateKey(key, 1) : key;
  return operationalDateTime(closeKey, end);
}

export async function syncShiftNotifications(settings: ScheduleSettings) {
  if (!isNative()) return;

  await cancelOwner('shift');
  const preferences = resolveNotificationPreferences(
    settings.notificationPreferences,
  );
  if (!preferences.enabled || !settings.schedule) return;
  if (!(await ensurePermission())) return;

  const now = new Date();
  const today = dateKey(now);
  const notifications: Array<{
    id: number;
    title: string;
    body: string;
    schedule: { at: Date; allowWhileIdle: boolean };
    extra: Record<string, unknown>;
  }> = [];

  const push = (
    key: string,
    title: string,
    body: string,
    at: Date,
    preferenceKey: NotificationPreferenceKey,
  ) => {
    if (!preferences[preferenceKey]) return;
    if (at.getTime() <= now.getTime() + 5_000) return;

    notifications.push({
      id: notificationIdFromKey(key),
      title,
      body,
      schedule: { at, allowWhileIdle: true },
      extra: ownerExtra('shift', { href: '/loja' }),
    });
  };

  for (let offset = 0; offset < SHIFT_HORIZON_DAYS; offset += 1) {
    const key = shiftDateKey(today, offset);
    const day = resolvedDay(key, settings);
    if (!day?.active || !day.shifts?.length) continue;

    day.shifts.forEach((shift, index) => {
      const start = operationalDateTime(key, shift.start);
      const close = shiftCloseAt(key, shift.start, shift.end);
      if (!close) return;

      push(
        `shift:prepare:${key}:${index}`,
        'Expediente em 15 minutos',
        `Prepare equipe, estoque e operação para o turno das ${shift.start}.`,
        minusMinutes(start, SHIFT_NOTICE_MINUTES),
        'shiftPrepare',
      );

      push(
        `shift:open:${key}:${index}`,
        'Expediente iniciado',
        `O turno das ${shift.start} começou. A operação está em horário de atendimento.`,
        start,
        'shiftOpen',
      );

      push(
        `shift:preclose:${key}:${index}`,
        'Fechamento em 15 minutos',
        'Revise rotas abertas, confirmações do iFood e pendências antes de encerrar.',
        minusMinutes(close, SHIFT_NOTICE_MINUTES),
        'shiftPreClose',
      );

      push(
        `shift:close:${key}:${index}`,
        'Fim do expediente',
        'Horário programado encerrado. Confira se restou alguma pendência operacional.',
        close,
        'shiftClose',
      );
    });
  }

  if (!notifications.length) return;

  try {
    await LocalNotifications.schedule({ notifications });
  } catch (error) {
    console.error('[NOTIFICATIONS] Falha ao agendar expediente:', error);
  }
}

export async function syncOpenRouteReminderNotifications(
  routes: Route[],
  settings: ScheduleSettings,
) {
  if (!isNative()) return;

  await cancelOwner('route-reminder');
  if (
    settings.routeReminderEnabled === false ||
    !preferenceEnabled(
      settings.notificationPreferences,
      'routeOpenReminder',
    ) ||
    !settings.schedule
  ) {
    return;
  }

  const active = routes.filter(
    (route) => route.status === 'aberta' && Boolean(route.started_at || route.departure_time),
  );
  if (!active.length) return;

  const closing = nextOperationalClosingAt(
    new Date(),
    settings.schedule,
    settings.pauses,
    settings.holidaysOverrides,
  );
  if (!closing) return;

  const now = new Date();
  const normalReminder = minusMinutes(closing, SHIFT_NOTICE_MINUTES);
  const at =
    normalReminder.getTime() > now.getTime()
      ? normalReminder
      : new Date(now.getTime() + 5_000);

  if (at.getTime() >= closing.getTime()) return;
  if (!(await ensurePermission())) return;

  const count = active.length;
  const names = active.slice(0, 2).map((route) => route.name).join(', ');
  const remaining = count > 2 ? ` e mais ${count - 2}` : '';

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationIdFromKey(`route-reminder:${closing.toISOString()}`),
          title: count === 1 ? 'Rota ainda aberta' : `${count} rotas ainda abertas`,
          body:
            count === 1
              ? `Finalize ${names} antes de encerrar o expediente.`
              : `Ainda estão abertas: ${names}${remaining}.`,
          schedule: { at, allowWhileIdle: true },
          extra: ownerExtra('route-reminder', { href: '/rotas' }),
        },
      ],
    });
  } catch (error) {
    console.error('[NOTIFICATIONS] Falha no lembrete de rota:', error);
  }
}

export const notifyIfoodRoutePending = (
  routeId: string,
  routeName: string,
  count: number,
  preferences?: Partial<NotificationPreferences>,
) =>
  notifyOperational(
    `ifood-route:${routeId}`,
    'Confirmações do iFood pendentes',
    `${count} ${
      count === 1 ? 'pedido ainda precisa' : 'pedidos ainda precisam'
    } ser confirmado${count === 1 ? '' : 's'} no iFood após ${routeName}.`,
    {
      cooldownMs: 5 * 60_000,
      extra: {
        href: `/confirmacoes?route=${encodeURIComponent(routeId)}`,
      },
      preferences,
      preferenceKey: 'ifoodPending',
    },
  );

export const notifyRouteFinished = (
  routeId: string,
  routeName: string,
  preferences?: Partial<NotificationPreferences>,
) =>
  notifyOperational(
    `route-finished:${routeId}`,
    'Rota concluída',
    `${routeName} foi finalizada sem confirmações do iFood pendentes.`,
    {
      cooldownMs: 5 * 60_000,
      extra: {
        href: `/rotas/details?id=${encodeURIComponent(routeId)}`,
      },
      preferences,
      preferenceKey: 'routeFinished',
    },
  );

export const notifySyncFailure = (
  preferences?: Partial<NotificationPreferences>,
) =>
  notifyOperational(
    'sync-failure',
    'Falha de sincronização',
    'Há dados que não puderam ser sincronizados. Abra o app e verifique a conexão.',
    {
      cooldownMs: 15 * 60_000,
      extra: { href: '/mais' },
      preferences,
      preferenceKey: 'syncFailure',
    },
  );

export async function scheduleStockSupplyCheckReminder(
  supplyId: string,
  supplier?: string,
  itemsCount?: number,
  preferences?: Partial<NotificationPreferences>,
) {
  if (!isNative()) return false;
  if (!preferenceEnabled(preferences, 'supplyCheck')) return false;

  const key = `stock-supply:${supplyId}`;
  const id = notificationIdFromKey(key);
  await cancelId(id);

  try {
    if (!(await ensurePermission())) return false;

    const detail = supplier?.trim() || 'Compra recebida';
    const countText =
      itemsCount && itemsCount > 0
        ? `${itemsCount} ${itemsCount === 1 ? 'item aguarda' : 'itens aguardam'}`
        : 'A compra aguarda';

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: 'Compra aguardando conferência',
          body: `${detail}: ${countText} conferência e lançamento no estoque.`,
          schedule: {
            at: new Date(Date.now() + SUPPLY_CHECK_DELAY_MINUTES * 60_000),
            allowWhileIdle: true,
          },
          extra: ownerExtra('stock-supply', {
            href: `/abastecimentos/detalhes?id=${encodeURIComponent(supplyId)}`,
          }),
        },
      ],
    });

    return true;
  } catch (error) {
    console.error('[NOTIFICATIONS] Falha no lembrete da compra:', error);
    return false;
  }
}

export async function cancelStockSupplyCheckReminder(supplyId: string) {
  await cancelId(notificationIdFromKey(`stock-supply:${supplyId}`));
}

export async function notificationPermissionStatus() {
  if (!isNative()) return 'web' as const;
  try {
    const current = await LocalNotifications.checkPermissions();
    return current.display;
  } catch {
    return 'unknown' as const;
  }
}

export async function requestNotificationPermission() {
  return ensurePermission();
}

export async function sendTestNotification() {
  return notifyOperational(
    `test:${Date.now()}`,
    'DFL Entregas',
    'Notificações operacionais funcionando corretamente.',
    {
      cooldownMs: 0,
      extra: { href: '/mais/notificacoes' },
    },
  );
}

export async function notifyStockThresholdChanges(
  changes: StockThresholdChange[],
  preferences?: Partial<NotificationPreferences>,
) {
  if (!resolveNotificationPreferences(preferences).enabled) return false;

  const relevant = changes
    .filter(({ after }) => after.active !== false && after.minimum_quantity > 0)
    .map(({ before, after }) => {
      const zeroCrossed =
        before.current_quantity > 0 && after.current_quantity <= 0;
      const lowCrossed =
        before.current_quantity > after.minimum_quantity &&
        after.current_quantity <= after.minimum_quantity;

      if (
        zeroCrossed &&
        preferenceEnabled(preferences, 'stockZero')
      ) {
        return {
          product: after,
          level: 'zero' as const,
        };
      }

      if (
        lowCrossed &&
        preferenceEnabled(preferences, 'stockLow')
      ) {
        return {
          product: after,
          level: 'low' as const,
        };
      }

      return null;
    })
    .filter(
      (
        item,
      ): item is {
        product: StockProduct;
        level: 'zero' | 'low';
      } => Boolean(item),
    );

  if (!relevant.length) return false;

  const zero = relevant.filter((item) => item.level === 'zero');
  const names = relevant
    .slice(0, 3)
    .map((item) => item.product.name)
    .join(', ');
  const rest = relevant.length > 3 ? ` e mais ${relevant.length - 3}` : '';

  const title =
    zero.length > 0
      ? zero.length === 1
        ? 'Produto zerado no estoque'
        : `${zero.length} produtos zerados`
      : relevant.length === 1
        ? 'Estoque no nível de reposição'
        : `${relevant.length} produtos precisam de reposição`;

  const body =
    zero.length > 0
      ? `${names}${rest}. Reponha o estoque antes que afete a operação.`
      : `${names}${rest} atingiu${relevant.length === 1 ? '' : 'ram'} o nível mínimo cadastrado.`;

  const key = `stock-threshold:${relevant
    .map((item) => `${item.product.id}:${item.level}`)
    .sort()
    .join('|')}`;

  return notifyOperational(key, title, body, {
    cooldownMs: 5 * 60_000,
    extra: { href: '/estoque/compras' },
  });
}
