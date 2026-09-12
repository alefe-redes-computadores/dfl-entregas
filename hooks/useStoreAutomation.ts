'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAppStore } from '@/store/useAppStore';
import { isWithinSchedule } from '@/lib/operational-time';
import { syncShiftNotifications } from '@/lib/native/notifications';

const millisecondsToNextMinute = () => {
  const now = Date.now();

  /*
   * A automação só depende de minuto.
   * A pequena margem evita disparar exatamente antes da virada do relógio.
   */
  return 60_000 - (now % 60_000) + 150;
};

export function useStoreAutomation() {
  const hasHydrated = useAppStore(
    (state) => state.hasHydrated,
  );

  const alertsEnabled = useAppStore(
    (state) => state.storeSettings.alertsEnabled,
  );

  const schedule = useAppStore(
    (state) => state.storeSettings.schedule,
  );

  const pauses = useAppStore(
    (state) => state.storeSettings.pauses,
  );

  const holidaysOverrides = useAppStore(
    (state) => state.storeSettings.holidaysOverrides,
  );

  const notificationPreferences = useAppStore(
    (state) => state.storeSettings.notificationPreferences,
  );

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

    let timer: number | undefined;
    let disposed = false;

    const checkOperationState = async () => {
      const state = useAppStore.getState();
      const settings = state.storeSettings;

      if (
        !settings?.schedule ||
        !settings.alertsEnabled
      ) {
        return;
      }

      const shouldBeOpen = isWithinSchedule(
        new Date(),
        settings.schedule,
        settings.pauses,
        settings.holidaysOverrides,
      );

      if (shouldBeOpen === Boolean(settings.isOpen)) {
        return;
      }

      try {
        await state.updateStoreSettings({
          isOpen: shouldBeOpen,
        });

        if (Capacitor.isNativePlatform()) {
          void Haptics.impact({
            style: ImpactStyle.Heavy,
          });
        }
      } catch (error) {
        console.error(
          'Falha ao atualizar estado automático da loja:',
          error,
        );
      }
    };

    const scheduleNextCheck = () => {
      if (disposed) return;

      window.clearTimeout(timer);

      timer = window.setTimeout(async () => {
        await checkOperationState();
        scheduleNextCheck();
      }, millisecondsToNextMinute());
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      void checkOperationState();
      scheduleNextCheck();
    };

    /*
     * Verifica imediatamente e depois apenas na próxima virada de minuto.
     * Ao voltar para o PWA, sincroniza novamente.
     */
    void checkOperationState();
    scheduleNextCheck();

    document.addEventListener(
      'visibilitychange',
      onVisibilityChange,
    );

    window.addEventListener(
      'focus',
      onVisibilityChange,
    );

    return () => {
      disposed = true;
      window.clearTimeout(timer);

      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      );

      window.removeEventListener(
        'focus',
        onVisibilityChange,
      );
    };
  }, [hasHydrated]);

  return null;
}
