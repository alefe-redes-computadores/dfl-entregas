import { useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export function useNotifications() {
  // Solicita permissão de notificação no primeiro boot nativo
  useEffect(() => {
    async function requestPermission() {
      if (Capacitor.isNativePlatform()) {
        try {
          const status = await LocalNotifications.checkPermissions();
          if (status.display !== 'granted') {
            await LocalNotifications.requestPermissions();
          }
        } catch (error) {
          console.error('Erro ao gerenciar permissões de notificação:', error);
        }
      }
    }
    requestPermission();
  }, []);

  // 1. Disparar notificação customizada
  const sendLocalNotification = async (title: string, body: string, id = Date.now()) => {
    if (!Capacitor.isNativePlatform()) {
      console.log(`[Notificação Web]: ${title} - ${body}`);
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: id % 2147483647, // Garante que fica dentro do limite do inteiro no Android
            schedule: { at: new Date(Date.now() + 1000) }, // Dispara quase instantaneamente
            sound: undefined,
            smallIcon: 'ic_stat_icon_config_sample', // Usa o ícone padrão do app
          },
        ],
      });
    } catch (error) {
      console.error('Erro ao agendar notificação local:', error);
    }
  };

  // 2. Notificação específica de Rota Concluída
  const notifyRouteFinished = (routeName: string) => {
    sendLocalNotification(
      '🎉 Rota Concluída!',
      `Todas as entregas da rota "${routeName}" foram finalizadas com sucesso.`
    );
  };

  // 3. Notificação de Erro de Sincronização
  const notifySyncError = () => {
    sendLocalNotification(
      '⚠️ Falha de Sincronização',
      'Não foi possível salvar os dados na nuvem. Verifique sua conexão.'
    );
  };

  return {
    sendLocalNotification,
    notifyRouteFinished,
    notifySyncError,
  };
}
