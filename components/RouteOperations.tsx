'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
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
  const updateRoute = useAppStore((state) => state.updateRoute);
  const previousOpenRoutes = useRef<number | null>(null);
  const previousRoutes = useRef(routes);
  // Evita múltiplas gravações da mesma rota enquanto o Firestore confirma.
  const autoClosing = useRef(new Set<string>());

  useEffect(() => {
    if (!hydrated || settings.autoCloseCompletedRoutes === false) return;

    const today = dateKey(new Date());
    routes
      .filter(
        (route) =>
          route.status === 'aberta' &&
          routeStartedAt(route) &&
          !route.reopened_at &&
          dateKey(routeDate(route) || new Date()) < today,
      )
      .forEach((route) => {
        // Pedidos cancelados não são entregas pendentes e não devem
        // impedir o fechamento; rotas só de cancelados NÃO fecham sozinhas.
        const linked = deliveries.filter(
          (delivery) => delivery.route_id === route.id && !isCancelledSiteDelivery(delivery),
        );

        if (linked.length && linked.every((delivery) => delivery.completed) && !autoClosing.current.has(route.id)) {
          autoClosing.current.add(route.id);
          const base = routeDate(route) || new Date();
          const end = new Date(base);
          end.setHours(23, 59, 0, 0);

          void updateRoute(route.id, {
            status: 'fechada',
            end_time: route.end_time || end.toISOString(),
            auto_closed_at: new Date().toISOString(),
          }).catch((error) => {
            console.warn('[ROUTE_OPERATIONS] Fechamento automático falhou; rota preservada.', error);
          }).finally(() => {
            autoClosing.current.delete(route.id);
          });
        }
      });
  }, [
    deliveries,
    hydrated,
    routes,
    settings.autoCloseCompletedRoutes,
    updateRoute,
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
