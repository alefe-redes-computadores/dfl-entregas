'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Runtime PWA independente do prompt de instalação.
 *
 * O registro do service worker precisa existir mesmo quando o
 * componente visual de instalação não é renderizado.
 *
 * No APK Capacitor o bundle já é local, portanto não registramos SW.
 */
export function PwaRuntime() {
  useEffect(() => {
    if (
      Capacitor.isNativePlatform() ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    let disposed = false;

    const register = async () => {
      try {
        const registration =
          await navigator.serviceWorker.register(
            '/sw.js',
            {
              scope: '/',
              updateViaCache: 'none',
            },
          );

        if (!disposed) {
          void registration.update();
        }
      } catch (error) {
        console.warn(
          '[PWA] Service Worker indisponível:',
          error,
        );
      }
    };

    void register();

    return () => {
      disposed = true;
    };
  }, []);

  return null;
}
