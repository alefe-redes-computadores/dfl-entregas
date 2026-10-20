'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { canAutoCloseRoute } from '@/lib/route-closure-eligibility';
import {
  dateKey,
  routeDate,
  routeStartedAt,
} from '@/lib/operational-time';
import { notifyShiftFinished, scheduleRouteDurationReminder, syncOpenRouteReminderNotifications } from '@/lib/native/notifications';

export function RouteOperations() {
  const hydrated = useAppStore((state) => state.hasHydrated);
  const routes = useAppStore((state) => state.routes);
  const deliveries = useAppStore((state) => state.deliveries);
  const settings = useAppStore((state) => state.storeSettings);
  const closeRoute = useAppStore((state) => state.closeRoute);
  const previousOpenRoutes = useRef<number | null>(null);
  const previousRoutes = useRef(routes);
  // Evita múltiplas gravações da mesma rota enquanto o Firestore confirma.
  const autoClosing = useRef(new Set<string>());
  const failedAutoCloseAt = useRef(new Map<string, number>());

  useEffect(() => {
    if (!hydrated || settings.autoCloseCompletedRoutes === false) return;

    const today = dateKey(new Date());
    const now = Date.now();
    // Indexação linear, em vez de filtrar TODAS as entregas para CADA rota.
    const deliveriesByRoute = new Map<string, typeof deliveries>();
    for (const delivery of deliveries) {
      if (!delivery.route_id) continue;
      const linked = deliveriesByRoute.get(delivery.route_id) || [];
      linked.push(delivery);
      deliveriesByRoute.set(delivery.route_id, linked);
    }
    for (const route of routes) {
      if (route.status !== 'aberta' || !routeStartedAt(route) || route.reopened_at) continue;
      if (dateKey(routeDate(route) || new Date()) >= today) continue;
      if (autoClosing.current.has(route.id)) continue;
      // Falha de rede não deve causar nova transação a cada atualização de UI.
      if (now - (failedAutoCloseAt.current.get(route.id) || 0) < 120_000) continue;
      if (!canAutoCloseRoute(route, deliveriesByRoute.get(route.id) || [])) continue;
      autoClosing.current.add(route.id);
      const end = new Date(routeDate(route) || new Date());
      end.setHours(23, 59, 0, 0);
      void closeRoute(route.id, {
        effectiveEndTime: route.end_time || end.toISOString(),
        autoClosedAt: new Date().toISOString(),
      }).then(() => {
        failedAutoCloseAt.current.delete(route.id);
      }).catch((error) => {
        failedAutoCloseAt.current.set(route.id, Date.now());
        console.warn('[ROUTE_OPERATIONS] Fechamento histórico não confirmado; rota preservada.', error);
      }).finally(() => {
        autoClosing.current.delete(route.id);
      });
    }
    // Evita reter referências de rotas já fechadas.
    const openIds = new Set(routes.filter(route => route.status === 'aberta').map(route => route.id));
    for (const id of failedAutoCloseAt.current.keys()) {
      if (!openIds.has(id)) failedAutoCloseAt.current.delete(id);
    }
  }, [
    deliveries,
    hydrated,
    routes,
    settings.autoCloseCompletedRoutes,
    closeRoute,
  ]);


  useEffect(() => {
    if (!hydrated) return;
    const open = routes.filter((route) => route.status === 'aberta');
    const before = previousOpenRoutes.current;
    if (before !== null && before > 0 && open.length === 0) {
      const previous = previousRoutes.current;
      const lastClosed = [...routes].filter((route) => route.status === 'fechada').sort((a,b)=>String(b.end_time||b.updated_at||'').localeCompare(String(a.end_time||a.updated_at||'')))[0] || previous.find((route)=>route.status==='aberta');
      void notifyShiftFinished(lastClosed?.motoboy_id, lastClosed?.motoboy_name, settings.notificationPreferences);
    }
    previousOpenRoutes.current = open.length;
    previousRoutes.current = routes;
  }, [hydrated, routes, settings.notificationPreferences]);

  useEffect(() => {
    if (!hydrated) return;

    void syncOpenRouteReminderNotifications(routes, {
      routeReminderEnabled: settings.routeReminderEnabled,
      schedule: settings.schedule,
      pauses: settings.pauses,
      holidaysOverrides: settings.holidaysOverrides,
      notificationPreferences: settings.notificationPreferences,
    }).catch((error) => console.warn('[ROUTE_OPERATIONS] Falha ao sincronizar lembretes; operação preservada.', error));
    routes
      .filter((route) => route.status === 'aberta' && Boolean(route.started_at || route.departure_time))
      .forEach((route) => {
        void scheduleRouteDurationReminder(
          route,
          useAppStore.getState().storeSettings.notificationPreferences,
        ).catch((error) => console.warn('[ROUTE_OPERATIONS] Lembrete não agendado; rota preservada.', error));
      });
  }, [
    hydrated,
    routes,
    settings.holidaysOverrides,
    settings.notificationPreferences,
    settings.pauses,
    settings.routeReminderEnabled,
    settings.schedule,
  ]);

  return null;
}
