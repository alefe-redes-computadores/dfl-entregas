'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CloudOff, RotateCw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { readWriteJournal, WRITE_JOURNAL_EVENT, writeJournalSummary } from '@/lib/operation/operational-write-journal';
import { mayReconcileAfterReconnect, RECONNECT_DELAY_MS } from '@/lib/operation/reconnect-policy';

/** Nenhum listener Firestore nem polling. Banner não afirma que dados foram enviados. */
export function ConnectivityRecovery() {
  const owner = useAppStore((state) => state.user?.uid);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [unverified, setUnverified] = useState(0);
  const offlineSeen = useRef(false);
  const lastAttempt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refresh = () => {
      const isOnline = navigator.onLine !== false;
      setOnline(isOnline);
      if (!isOnline) offlineSeen.current = true;
      const summary = writeJournalSummary(readWriteJournal(owner));
      setPending(summary.pending);
      setUnverified(summary.unverified);
    };
    const onOnline = () => {
      // Se o app reiniciou com escrita incerta, a retomada em primeiro plano
      // também pode solicitar UMA leitura de reconciliação (sem replay).
      const hasUnverified = readWriteJournal(owner).some(x => x.status === 'unverified');
      const wasOffline = offlineSeen.current || hasUnverified;
      refresh();
      const snapshot = useAppStore.getState();
      if (!mayReconcileAfterReconnect({
        wasOffline, online: navigator.onLine !== false,
        authenticated: Boolean(owner && snapshot.user?.uid === owner && snapshot.authLoaded),
        hydrated: snapshot.hasHydrated, syncing: snapshot.isSyncing,
        elapsedSinceLastAttemptMs: Date.now() - lastAttempt.current,
        hasSyncError: snapshot.syncError,
        hasUnverifiedWrite: readWriteJournal(owner).some(x => x.status === 'unverified'),
      })) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const current = useAppStore.getState();
        if (navigator.onLine === false || document.visibilityState === 'hidden' || !current.authLoaded ||
          !current.hasHydrated || current.user?.uid !== owner || current.isSyncing) return;
        // Só consumir cooldown após realmente disparar a leitura.
        lastAttempt.current = Date.now();
        offlineSeen.current = false;
        // Leitura de reconciliação, NÃO replay nem confirmação de escrita.
        void current.initData();
      }, RECONNECT_DELAY_MS);
    };
    const onForeground = () => {
      if (document.visibilityState !== 'hidden') onOnline();
    };
    refresh();
    window.addEventListener('focus', onForeground);
    window.addEventListener('dfl:app-foreground', onForeground);
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', refresh);
    window.addEventListener(WRITE_JOURNAL_EVENT, refresh);
    return () => {
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('dfl:app-foreground', onForeground);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', refresh);
      window.removeEventListener(WRITE_JOURNAL_EVENT, refresh);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [owner]);

  if (!owner || (online && !unverified && !pending)) return null;
  return (
    <div role="status" aria-live="polite" className="mx-3 mt-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[.08] px-3 py-2 text-xs text-amber-100">
      {!online ? <CloudOff size={17} className="mt-0.5 shrink-0" /> : unverified ? <AlertTriangle size={17} className="mt-0.5 shrink-0" /> : <RotateCw size={17} className="mt-0.5 shrink-0 animate-spin" />}
      <div>
        <span className="font-semibold">{!online ? 'Sem conexão detectada' : unverified ? 'Operações anteriores precisam de conferência' : 'Aguardando confirmação do servidor'}</span>
        <p className="mt-0.5 text-[11px] leading-relaxed text-amber-200/85">
          {!online ? 'Dados locais podem estar desatualizados; gravações críticas não devem ser consideradas confirmadas.' :
           unverified ? `${unverified} operação(ões) sem confirmação conhecida após reinício. Confira o histórico antes de repetir.` :
           `${pending} gravação(ões) aguardando resposta. A posição visual não é prova de sincronização.`}
        </p>
      </div>
    </div>
  );
}
