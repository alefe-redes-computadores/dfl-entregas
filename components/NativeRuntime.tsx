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

    let disposed = false;
    const removers: Array<() => Promise<void>> = [];
    let lastNavigation = { href: '', at: 0 };

    // O setup é assíncrono: um listener criado depois do unmount deve
    // ser removido imediatamente, não permanecer vivo até outro reload.
    const registerRemoval = (remove: () => Promise<void>) => {
      if (disposed) {
        void remove().catch((error) => console.warn('[NATIVE] Cleanup tardio:', error));
      } else {
        removers.push(remove);
      }
    };

    const navigate = (href: string, reason: string) => {
      if (disposed) return;
      const current = window.location.pathname + window.location.search;
      if (href === current) return;
      const now = Date.now();
      if (lastNavigation.href === href && now - lastNavigation.at < 900) return;
      lastNavigation = { href, at: now };
      console.info('[NATIVE] Navegação', { reason, from: current, to: href });
      router.replace(href);
    };

    const setup = async () => {
      await configureStatusBar();
      if (disposed) return;

      try {
        const notificationListener = await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          (event) => {
            const href = safeInternalHref(event.notification.extra?.href);
            if (href) navigate(href, 'notification');
          },
        );
        registerRemoval(() => notificationListener.remove());
      } catch (error) {
        console.warn('[NATIVE] Listener de notificação:', error);
      }
      if (disposed) return;

      try {
        const launchPath = window.location.pathname + window.location.search;
        const launch = await App.getLaunchUrl();
        const initialHref = deliveryDeepLinkToHref(launch?.url);
        const currentPath = window.location.pathname + window.location.search;
        if (initialHref && currentPath === launchPath) {
          navigate(initialHref, 'launch-url');
        }
        if (disposed) return;
        const urlListener = await App.addListener('appUrlOpen', ({ url }) => {
          const href = deliveryDeepLinkToHref(url);
          if (href) navigate(href, 'app-url-open');
        });
        registerRemoval(() => urlListener.remove());
      } catch (error) {
        console.warn('[NATIVE] Deep link:', error);
      }
      if (disposed) return;

      try {
        const stateListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive || disposed) return;
          window.dispatchEvent(new Event('dfl:app-foreground'));
          window.setTimeout(() => {
            if (!disposed) void configureStatusBar();
          }, 80);
        });
        registerRemoval(() => stateListener.remove());
      } catch (error) {
        console.warn('[NATIVE] Ciclo de vida:', error);
      }
      if (disposed) return;

      try {
        let lastBackAt = 0;
        const backListener = await App.addListener('backButton', () => {
          if (disposed) return;
          const now = Date.now();
          if (now - lastBackAt < 650) return;
          lastBackAt = now;
          const target = nativeBackTarget(
            window.location.pathname,
            window.location.search,
          );
          if (target) {
            navigate(target, 'android-back');
            return;
          }
          console.info('[NATIVE] Minimizar app pelo botão Voltar');
          void App.minimizeApp();
        });
        registerRemoval(() => backListener.remove());
      } catch (error) {
        console.warn('[NATIVE] Botão voltar:', error);
      }
    };

    void setup().catch((error) => console.warn('[NATIVE] Setup:', error));

    return () => {
      disposed = true;
      document.documentElement.style.removeProperty(
        '--dfl-native-statusbar-fallback',
      );
      delete document.documentElement.dataset.dflPlatform;
      removers.forEach((remove) => {
        void remove().catch((error) => console.warn('[NATIVE] Cleanup:', error));
      });
    };
  }, [router]);

  return null;
}
