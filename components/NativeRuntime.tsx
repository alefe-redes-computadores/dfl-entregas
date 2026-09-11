// components/NativeRuntime.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';
import { nativeBackTarget } from '@/lib/native/navigation';

function safeInternalHref(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : null;
}

async function configureStatusBar() {
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#09090b' });
    await StatusBar.setStyle({ style: Style.Light });
  } catch (error) {
    console.warn('[NATIVE] Status bar:', error);
  }
}

export function NativeRuntime() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const removers: Array<() => Promise<void>> = [];

    const setup = async () => {
      await configureStatusBar();

      try {
        const notificationListener = await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          (event) => {
            const href = safeInternalHref(event.notification.extra?.href);
            if (href) {
              // Replace evita voltar para uma tela antiga ao entrar pelo aviso.
              router.replace(href);
            }
          },
        );
        removers.push(() => notificationListener.remove());
      } catch (error) {
        console.warn('[NATIVE] Listener de notificação:', error);
      }

      try {
        const stateListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) void configureStatusBar();
        });
        removers.push(() => stateListener.remove());
      } catch (error) {
        console.warn('[NATIVE] Ciclo de vida:', error);
      }

      try {
        const backListener = await App.addListener('backButton', () => {
          const target = nativeBackTarget(
            window.location.pathname,
            window.location.search,
          );

          if (target) {
            router.replace(target);
            return;
          }

          // Home/Loja são raízes do app. No Android, voltar minimiza.
          void App.minimizeApp();
        });
        removers.push(() => backListener.remove());
      } catch (error) {
        console.warn('[NATIVE] Botão voltar:', error);
      }
    };

    void setup();

    return () => {
      removers.forEach((remove) => {
        void remove();
      });
    };
  }, [router]);

  return null;
}
