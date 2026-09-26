'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Autoridade única de registro/atualização do Service Worker.
 *
 * PwaInstallPrompt cuida somente da instalação visual.
 * No APK Capacitor não registramos SW.
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
    let refreshing = false;

    const handleControllerChange = () => {
      if (disposed || refreshing) return;

      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange,
    );

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

        if (disposed) return;

        const activateWaiting = () => {
          registration.waiting?.postMessage({
            type: 'SKIP_WAITING',
          });
        };

        if (registration.waiting) {
          activateWaiting();
        }

        registration.addEventListener(
          'updatefound',
          () => {
            const worker = registration.installing;

            if (!worker) return;

            worker.addEventListener(
              'statechange',
              () => {
                if (
                  worker.state === 'installed' &&
                  navigator.serviceWorker.controller
                ) {
                  worker.postMessage({
                    type: 'SKIP_WAITING',
                  });
                }
              },
            );
          },
        );

        await registration.update();
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

      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange,
      );
    };
  }, []);

  return null;
}
