'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  dateKey,
  routeDate,
  routeStartedAt,
} from '@/lib/operational-time';
import { syncOpenRouteReminderNotifications } from '@/lib/native/notifications';

export function RouteOperations() {
  const hydrated = useAppStore((state) => state.hasHydrated);
  const routes = useAppStore((state) => state.routes);
  const deliveries = useAppStore((state) => state.deliveries);
  const settings = useAppStore((state) => state.storeSettings);
  const updateRoute = useAppStore((state) => state.updateRoute);

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
        const linked = deliveries.filter(
          (delivery) => delivery.route_id === route.id,
        );

        if (linked.length && linked.every((delivery) => delivery.completed)) {
          const base = routeDate(route) || new Date();
          const end = new Date(base);
          end.setHours(23, 59, 0, 0);

          void updateRoute(route.id, {
            status: 'fechada',
            end_time: route.end_time || end.toISOString(),
            auto_closed_at: new Date().toISOString(),
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

    void syncOpenRouteReminderNotifications(routes, {
      routeReminderEnabled: settings.routeReminderEnabled,
      schedule: settings.schedule,
      pauses: settings.pauses,
      holidaysOverrides: settings.holidaysOverrides,
      notificationPreferences: settings.notificationPreferences,
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
