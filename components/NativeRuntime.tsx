// components/NativeRuntime.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';
import { nativeBackTarget } from '@/lib/native/navigation';
import { deliveryDeepLinkToHref } from '@/lib/native/admin-bridge';

function safeInternalHref(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : null;
}

async function configureStatusBar() {
  try {
    // Fundo escuro do DFL + conteúdo claro.
    // Android possui um único owner das System Bars: MainActivity.
    // Não permitir que o runtime React/@capacitor/status-bar sobrescreva
    // WindowCompat/WindowInsetsController depois que a Activity configurou a janela.
    if (Capacitor.getPlatform() !== 'android') {
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setBackgroundColor({ color: '#09090b' });
      await StatusBar.setStyle({ style: Style.Light });
    }
  } catch (error) {
    console.warn('[NATIVE] Status bar:', error);
  }
}

export function NativeRuntime() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const rootStyle = document.documentElement.style;
    if (Capacitor.getPlatform() === 'android') {
      rootStyle.setProperty('--dfl-native-statusbar-fallback', '48px');
      document.documentElement.dataset.dflPlatform = 'android';
    }

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
        // O retorno assíncrono de getLaunchUrl não pode sobrescrever
        // uma navegação que ocorreu enquanto o Android inicializava.
        const launchPath = window.location.pathname + window.location.search;
        const launch = await App.getLaunchUrl();
        const initialHref = deliveryDeepLinkToHref(launch?.url);
        const currentPath = window.location.pathname + window.location.search;

        if (initialHref && currentPath === launchPath) {
          router.replace(initialHref);
        }
        const urlListener = await App.addListener('appUrlOpen', ({ url }) => {
          const href = deliveryDeepLinkToHref(url);
          if (href) router.replace(href);
        });
        removers.push(() => urlListener.remove());
      } catch (error) {
        console.warn('[NATIVE] Deep link:', error);
      }

      try {
        const stateListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            // O WebView Android nem sempre emite visibilitychange ao voltar
            // de outro aplicativo. O Header continua sendo o owner da
            // sincronização/cooldown; este evento apenas sinaliza o resume
            // nativo, sem criar polling ou uma segunda leitura concorrente.
            window.dispatchEvent(new Event('dfl:app-foreground'));

            // Algumas Activities externas (ex.: seletor Google) podem devolver
            // flags de system bars diferentes. Reaplicamos após o resume.
            window.setTimeout(() => {
              void configureStatusBar();
            }, 80);
          }
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
      document.documentElement.style.removeProperty(
        '--dfl-native-statusbar-fallback',
      );
      delete document.documentElement.dataset.dflPlatform;
      removers.forEach((remove) => {
        void remove();
      });
    };
  }, [router]);

  return null;
}
