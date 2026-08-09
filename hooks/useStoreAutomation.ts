'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export function useStoreAutomation() {
  const storeSettings = useAppStore(state => state.storeSettings);
  const updateStoreSettings = useAppStore(state => state.updateStoreSettings);
  const hasHydrated = useAppStore(state => state.hasHydrated);
  
  const lastCheckMinute = useRef<number | null>(null);

  useEffect(() => {
    if (!hasHydrated || !storeSettings) return;

    // 1. AGENDAMENTO DE NOTIFICAÇÕES NATIVAS (Roda mesmo em 2º plano)
    const setupNativeAlarms = async () => {
      if (!Capacitor.isNativePlatform() || !storeSettings.alertsEnabled) return;
      
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') await LocalNotifications.requestPermissions();
        
        await LocalNotifications.cancel({ notifications: await LocalNotifications.getPending().then(res => res.notifications) });

        const [openH, openM] = storeSettings.openingTime.split(':').map(Number);
        const [closeH, closeM] = storeSettings.closingTime.split(':').map(Number);
        
        const notifications = [];
        let idCounter = 1000;

        // Capacitor Weekdays: 1=Domingo, 2=Segunda ... 7=Sábado
        // JS Weekdays: 0=Domingo, 1=Segunda ... 6=Sábado
        for (const jsDay of storeSettings.activeDays) {
          const capDay = jsDay + 1;

          // 17:50 - Prepara a chapa
          let prepM = openM - 10;
          let prepH = openH;
          if (prepM < 0) { prepM += 60; prepH -= 1; }
          notifications.push({
            id: idCounter++,
            title: '🟡 Prepara a chapa!',
            body: 'Faltam 10 minutos para abrir. Organize os itens.',
            schedule: { on: { weekday: capDay, hour: prepH, minute: prepM } }
          });

          // 18:00 - Loja Aberta
          notifications.push({
            id: idCounter++,
            title: '🟢 Loja Aberta!',
            body: 'Abra o app para confirmar a abertura no sistema.',
            schedule: { on: { weekday: capDay, hour: openH, minute: openM } }
          });

          // 22:50 - Prepara Fechamento
          let preCloseM = closeM - 10;
          let preCloseH = closeH;
          if (preCloseM < 0) { preCloseM += 60; preCloseH -= 1; }
          notifications.push({
            id: idCounter++,
            title: '🟠 Reta final!',
            body: 'Faltam 10 minutos para fechar. Já comece a organizar a limpeza.',
            schedule: { on: { weekday: capDay, hour: preCloseH, minute: preCloseM } }
          });

          // 23:01 - Loja Fechada
          let closedM = closeM + 2;
          let closedH = closeH;
          if (closedM > 59) { closedM -= 60; closedH = closedH >= 23 ? 0 : closedH + 1; }
          notifications.push({
            id: idCounter++,
            title: '🔴 Loja Fechada!',
            body: 'Pode fechar o notebook e descansar, Capitão!',
            schedule: { on: { weekday: capDay, hour: closedH, minute: closedM } }
          });
        }

        await LocalNotifications.schedule({ notifications });
      } catch (error) {
        console.error("Erro ao configurar alarmes nativos", error);
      }
    };

    setupNativeAlarms();

    // 2. VIGIA DE PRIMEIRO PLANO (Aciona as chaves sozinho se o app estiver aberto)
    const interval = setInterval(() => {
      const now = new Date();
      const currentMin = now.getMinutes();
      
      // Roda a checagem apenas se virar o minuto para economizar bateria
      if (currentMin === lastCheckMinute.current) return;
      lastCheckMinute.current = currentMin;

      const jsDay = now.getDay();
      if (!storeSettings.activeDays.includes(jsDay)) return;

      const currentH = now.getHours();
      
      const [openH, openM] = storeSettings.openingTime.split(':').map(Number);
      let [closeH, closeM] = storeSettings.closingTime.split(':').map(Number);
      let closedM = closeM + 2;
      let closedH = closeH;
      if (closedM > 59) { closedM -= 60; closedH = closedH >= 23 ? 0 : closedH + 1; }

      // Hora de Abrir (ex: 18:00)
      if (currentH === openH && currentMin === openM && !storeSettings.isOpen) {
        updateStoreSettings({ isOpen: true });
        if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Heavy });
      }

      // Hora de Fechar (ex: 23:01)
      if (currentH === closedH && currentMin === closedM && storeSettings.isOpen) {
        updateStoreSettings({ isOpen: false });
        if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Heavy });
      }
    }, 10000); 

    return () => clearInterval(interval);
  }, [storeSettings, hasHydrated, updateStoreSettings]);

  return null;
}
