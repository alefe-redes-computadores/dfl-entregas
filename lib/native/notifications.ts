// lib/native/notifications.ts
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const MAX_ID = 2147483647;
const lastSent = new Map<string, number>();

function idFromKey(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const value = Math.abs(hash) % MAX_ID;
  return value || 1;
}

async function permission() {
  if (!Capacitor.isNativePlatform()) return false;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;
  const requested = await LocalNotifications.requestPermissions();
  return requested.display === 'granted';
}

export async function notifyOperational(
  key: string,
  title: string,
  body: string,
  options?: { cooldownMs?: number; extra?: Record<string, unknown> },
) {
  if (!Capacitor.isNativePlatform()) return false;

  const now = Date.now();
  const cooldown = options?.cooldownMs ?? 60_000;
  if (now - (lastSent.get(key) || 0) < cooldown) return false;

  try {
    if (!(await permission())) return false;
    await LocalNotifications.schedule({
      notifications: [{
        id: idFromKey(key),
        title,
        body,
        schedule: { at: new Date(now + 500) },
        extra: options?.extra,
      }],
    });
    lastSent.set(key, now);
    return true;
  } catch (error) {
    console.error('[NOTIFICATIONS] Falha operacional:', error);
    return false;
  }
}

export const notifyIfoodRoutePending = (
  routeId: string,
  routeName: string,
  count: number,
) => notifyOperational(
  `ifood-route:${routeId}`,
  'Confirmações do iFood pendentes',
  `${count} ${count === 1 ? 'pedido ainda precisa' : 'pedidos ainda precisam'} ser confirmado${count === 1 ? '' : 's'} no iFood após ${routeName}.`,
  { cooldownMs: 5 * 60_000, extra: { href: `/confirmacoes?route=${encodeURIComponent(routeId)}` } },
);

export const notifyRouteFinished = (routeId: string, routeName: string) =>
  notifyOperational(
    `route-finished:${routeId}`,
    'Rota concluída',
    `${routeName} foi finalizada sem confirmações do iFood pendentes.`,
    { cooldownMs: 5 * 60_000, extra: { href: `/rotas/details?id=${encodeURIComponent(routeId)}` } },
  );

export const notifySyncFailure = () =>
  notifyOperational(
    'sync-failure',
    'Falha de sincronização',
    'Há dados que não puderam ser sincronizados. Abra o app e verifique a conexão.',
    { cooldownMs: 15 * 60_000, extra: { href: '/mais' } },
  );
