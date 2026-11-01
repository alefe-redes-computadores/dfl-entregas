'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAppStore } from '@/store/useAppStore';
import { readWriteJournal, writeJournalSummary, WRITE_JOURNAL_EVENT } from '@/lib/operation/operational-write-journal';
import { mayApplyPwaUpdate } from '@/lib/operation/pwa-reload-guard';
import { toast } from '@/lib/operational-toast';

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
    let updatePending = false;
    let deferredNoticeShown = false;

    // Não reiniciar uma WebView/PWA no meio de compra ou confirmação Firestore.
    // O estado do diário R230 é só diagnóstico, nunca é reenviado como escrita.
    const applyUpdateWhenSafe = () => {
      if (disposed || refreshing || !updatePending) return;
      const owner = useAppStore.getState().user?.uid;
      const journal = writeJournalSummary(readWriteJournal(owner));
      const editingForm = Boolean(document.querySelector('[data-dfl-unsaved-form="true"]'));
      if (!mayApplyPwaUpdate({
        pendingWrites: journal.pending,
        unverifiedWrites: journal.unverified,
        editingForm,
      })) {
        if (!deferredNoticeShown) {
          deferredNoticeShown = true;
          toast.info('Atualização aguardando conclusão segura', {
            id: 'dfl-pwa-update-deferred', duration: 4200,
            description: 'Conclua a edição e confira operações pendentes antes de recarregar o PWA.',
          });
        }
        return;
      }
      refreshing = true;
      window.location.reload();
    };

    const handleControllerChange = () => {
      if (disposed || refreshing) return;
      updatePending = true;
      applyUpdateWhenSafe();
    };
    const handleResume = () => {
      if (document.visibilityState !== 'hidden') applyUpdateWhenSafe();
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange,
    );
    window.addEventListener(WRITE_JOURNAL_EVENT, applyUpdateWhenSafe);
    window.addEventListener('dfl:operation-form-state', applyUpdateWhenSafe);
    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);

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
      window.removeEventListener(WRITE_JOURNAL_EVENT, applyUpdateWhenSafe);
      window.removeEventListener('dfl:operation-form-state', applyUpdateWhenSafe);
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, []);

  return null;
}
