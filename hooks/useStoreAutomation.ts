'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAppStore } from '@/store/useAppStore';
import { isWithinSchedule } from '@/lib/operational-time';
import { syncShiftNotifications } from '@/lib/native/notifications';

export function useStoreAutomation() {
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const alertsEnabled = useAppStore(
    (state) => state.storeSettings.alertsEnabled,
  );
  const schedule = useAppStore((state) => state.storeSettings.schedule);
  const pauses = useAppStore((state) => state.storeSettings.pauses);
  const holidaysOverrides = useAppStore(
    (state) => state.storeSettings.holidaysOverrides,
  );
  const notificationPreferences = useAppStore(
    (state) => state.storeSettings.notificationPreferences,
  );
  const lastCheckMinute = useRef<number | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;

    void syncShiftNotifications({
      alertsEnabled,
      schedule,
      pauses,
      holidaysOverrides,
      notificationPreferences,
    });
  }, [
    alertsEnabled,
    hasHydrated,
    holidaysOverrides,
    notificationPreferences,
    pauses,
    schedule,
  ]);

  useEffect(() => {
    if (!hasHydrated) return;

    const checkOperationState = () => {
      const state = useAppStore.getState();
      const settings = state.storeSettings;
      if (!settings?.schedule || !settings.alertsEnabled) return;

      const now = new Date();
      const currentMinute = Math.floor(now.getTime() / 60_000);
      if (currentMinute === lastCheckMinute.current) return;
      lastCheckMinute.current = currentMinute;

      const shouldBeOpen = isWithinSchedule(
        now,
        settings.schedule,
        settings.pauses,
        settings.holidaysOverrides,
      );

      if (shouldBeOpen === Boolean(settings.isOpen)) return;

      void state.updateStoreSettings({ isOpen: shouldBeOpen });
      if (Capacitor.isNativePlatform()) {
        void Haptics.impact({ style: ImpactStyle.Heavy });
      }
    };

    checkOperationState();
    const interval = window.setInterval(checkOperationState, 10_000);

    return () => window.clearInterval(interval);
  }, [hasHydrated]);

  return null;
}
