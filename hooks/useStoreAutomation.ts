'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { StorePause, Shift } from '@/types';

export function useStoreAutomation() {
  const storeSettings = useAppStore(state => state.storeSettings);
  const updateStoreSettings = useAppStore(state => state.updateStoreSettings);
  const hasHydrated = useAppStore(state => state.hasHydrated);
  
  const lastCheckMinute = useRef<number | null>(null);

  useEffect(() => {
    if (!hasHydrated || !storeSettings || !storeSettings.schedule) return;

    const setupNativeAlarms = async () => {
      if (!Capacitor.isNativePlatform() || !storeSettings.alertsEnabled) return;
      
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') await LocalNotifications.requestPermissions();
        
        await LocalNotifications.cancel({ notifications: await LocalNotifications.getPending().then(res => res.notifications) });

        const notifications = [];
        let idCounter = 1000;

        // Itera sobre todos os dias da semana
        for (let jsDay = 0; jsDay <= 6; jsDay++) {
          const capDay = jsDay + 1; // Capacitor usa 1=Dom, 7=Sab
          const dayConfig = storeSettings.schedule[jsDay];

          if (!dayConfig || !dayConfig.active || !dayConfig.shifts) continue;

          for (const shift of dayConfig.shifts) {
            const [openH, openM] = shift.start.split(':').map(Number);
            const [closeH, closeM] = shift.end.split(':').map(Number);

            // 10 min antes de Abrir
            let prepM = openM - 10;
            let prepH = openH;
            if (prepM < 0) { prepM += 60; prepH -= 1; }
            if (prepH < 0) prepH = 23;

            notifications.push({
              id: idCounter++,
              title: '🟡 Prepara a chapa!',
              body: 'Faltam 10 minutos para abrir. Organize os itens.',
              schedule: { on: { weekday: capDay, hour: prepH, minute: prepM } }
            });

            // Hora de Abrir
            notifications.push({
              id: idCounter++,
              title: '🟢 Loja Aberta!',
              body: 'O sistema iniciou o recebimento de pedidos.',
              schedule: { on: { weekday: capDay, hour: openH, minute: openM } }
            });

            // 10 min antes de Fechar
            let preCloseM = closeM - 10;
            let preCloseH = closeH;
            if (preCloseM < 0) { preCloseM += 60; preCloseH -= 1; }
            if (preCloseH < 0) preCloseH = 23;

            notifications.push({
              id: idCounter++,
              title: '🟠 Reta final!',
              body: 'Faltam 10 minutos para fechar. Já comece a organizar a limpeza.',
              schedule: { on: { weekday: capDay, hour: preCloseH, minute: preCloseM } }
            });

            // Hora de Fechar
            notifications.push({
              id: idCounter++,
              title: '🔴 Loja Fechada!',
              body: 'Expediente encerrado. Bom descanso, Capitão!',
              schedule: { on: { weekday: capDay, hour: closeH, minute: closeM } }
            });
          }
        }
        await LocalNotifications.schedule({ notifications });
      } catch (error) { console.error("Erro ao configurar alarmes nativos", error); }
    };

    setupNativeAlarms();

    // 2. VIGIA DE PRIMEIRO PLANO (Aciona as chaves sozinho)
    const interval = setInterval(() => {
      const now = new Date();
      const currentMin = now.getMinutes();
      
      // Roda a checagem apenas se virar o minuto para economizar bateria
      if (currentMin === lastCheckMinute.current) return;
      lastCheckMinute.current = currentMin;

      // Verifica Pausas
      const todayIso = now.toISOString().split('T')[0];
      const isPaused = storeSettings.pauses?.some(p => todayIso >= p.start_date.split('T')[0] && todayIso <= p.end_date.split('T')[0]);
      if (isPaused) {
        if (storeSettings.isOpen) updateStoreSettings({ isOpen: false });
        return;
      }

      const jsDay = now.getDay();
      const dayConfig = storeSettings.schedule[jsDay];
      
      if (!dayConfig || !dayConfig.active || !dayConfig.shifts || dayConfig.shifts.length === 0) {
        if (storeSettings.isOpen) updateStoreSettings({ isOpen: false });
        return;
      }

      const currentH = now.getHours();
      const nowTotalMins = currentH * 60 + currentMin;

      let isWithinAnyShift = false;

      for (const shift of dayConfig.shifts) {
        const [openH, openM] = shift.start.split(':').map(Number);
        const [closeH, closeM] = shift.end.split(':').map(Number);
        const startTotal = openH * 60 + openM;
        const endTotal = closeH * 60 + closeM;

        if (nowTotalMins >= startTotal && nowTotalMins < endTotal) {
          isWithinAnyShift = true;
          break;
        }
      }

      if (isWithinAnyShift && !storeSettings.isOpen) {
        updateStoreSettings({ isOpen: true });
        if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Heavy });
      } else if (!isWithinAnyShift && storeSettings.isOpen) {
        updateStoreSettings({ isOpen: false });
        if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Heavy });
      }

    }, 10000); 

    return () => clearInterval(interval);
  }, [storeSettings, hasHydrated, updateStoreSettings]);

  return null;
}
