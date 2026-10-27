'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';
import { User, LogOut, RefreshCw } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { UserAvatar } from '@/components/UserAvatar';
import { latestSyncDiagnostic, latestSuccessfulSyncDiagnostic, SYNC_DIAGNOSTIC_EVENT } from '@/lib/sync-diagnostics';
import { shouldRefreshOnForeground } from '@/lib/operation/foreground-sync-policy';

function relativeUpdate(value?: string) {
  if (!value) return 'Ainda nao atualizado';
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 45) return 'Atualizado agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Atualizado ha ${minutes} min`;
  return `Atualizado as ${new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function Header() {
  const isSyncing = useAppStore((state) => state.isSyncing);
  const syncError = useAppStore((state) => state.syncError);
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const initData = useAppStore((state) => state.initData);
  const lastForegroundSyncRef = useRef(Date.now());
  const refreshInFlightRef = useRef(false);
  
  const [greeting, setGreeting] = useState('Boa noite');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | undefined>();
  const [online, setOnline] = useState(true);
  const [, setClock] = useState(0);

  useEffect(() => {
    setGreeting(getGreeting());
    setLastUpdate(latestSuccessfulSyncDiagnostic()?.finishedAt);
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
  }, []);

  useEffect(() => {
    const update = (event: Event) => {
      const diagnostic = (event as CustomEvent<{ finishedAt?: string; status?: string }>).detail;
      if (diagnostic?.status === 'success') setLastUpdate(diagnostic.finishedAt);
    };
    let timer = 0;
    const tick = () => {
      timer = window.setTimeout(() => {
        setClock((value) => value + 1);
        setGreeting(getGreeting());
        tick();
      }, 60_000);
    };
    tick();
    window.addEventListener(SYNC_DIAGNOSTIC_EVENT, update);
    return () => { window.clearTimeout(timer); window.removeEventListener(SYNC_DIAGNOSTIC_EVENT, update); };
  }, []);

  const refreshNow = useCallback(async (showFeedback = true) => {
    // Não iniciar leituras antes da autenticação e hidratação local.
    const snapshot = useAppStore.getState();
    if (!snapshot.user || !snapshot.authLoaded || !snapshot.hasHydrated) {
      if (showFeedback) toast.info('Aguarde o carregamento da sessão.');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (showFeedback) toast.info('Sem conexão. Os dados locais continuam disponíveis.');
      return;
    }
    if (refreshInFlightRef.current || snapshot.isSyncing) {
      if (showFeedback) toast.info('A atualização já está em andamento.', { id: 'operation-sync' });
      return;
    }

    refreshInFlightRef.current = true;
    lastForegroundSyncRef.current = Date.now();
    const toastId = showFeedback ? toast.loading('Buscando pedidos novos...', { id: 'operation-sync' }) : undefined;
    try {
      await initData();
      const failed = useAppStore.getState().syncError;
      if (showFeedback && toastId !== undefined) {
        if (failed) toast.error('Não foi possível atualizar agora.', { id: toastId });
        else toast.success('Operação atualizada.', { id: toastId, duration: 1400 });
      }
    } catch (error) {
      console.warn('[DFL SYNC] Atualização interrompida:', error);
      if (showFeedback) toast.error('Falha na atualização. Tente novamente.', { id: 'operation-sync' });
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [initData]);

  useEffect(() => {
    const refreshOnForeground = () => {
      if (document.visibilityState !== 'visible') return;
      // Proteção histórica: o mesmo evento pode chegar pelo WebView e pelo PWA.
      if (Date.now() - lastForegroundSyncRef.current < 120_000) return;
      const state = useAppStore.getState();
      const latest = latestSyncDiagnostic();
      const eligible = shouldRefreshOnForeground({
        nowMs: Date.now(),
        lastAttemptMs: lastForegroundSyncRef.current,
        lastSuccessfulSyncMs: latestSuccessfulSyncDiagnostic()?.finishedAt,
        online: navigator.onLine,
        visible: document.visibilityState === 'visible',
        recovering: state.syncError || latest?.status === 'error',
      });
      if (!eligible || state.isSyncing || !state.user || !state.authLoaded || !state.hasHydrated) return;
      // Reservar o horário antes de iniciar o fetch: dois eventos não podem duplicá-lo.
      lastForegroundSyncRef.current = Date.now();
      void refreshNow(false);
    };
    const onNetworkOnline = () => {
      setOnline(true);
      refreshOnForeground();
    };
    const onNetworkOffline = () => setOnline(false);
    document.addEventListener('visibilitychange', refreshOnForeground);
    window.addEventListener('dfl:app-foreground', refreshOnForeground);
    window.addEventListener('online', onNetworkOnline);
    window.addEventListener('offline', onNetworkOffline);
    return () => {
      document.removeEventListener('visibilitychange', refreshOnForeground);
      window.removeEventListener('dfl:app-foreground', refreshOnForeground);
      window.removeEventListener('online', onNetworkOnline);
      window.removeEventListener('offline', onNetworkOffline);
    };
  }, [refreshNow]);

  useEffect(() => {
    if (!isProfileOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsProfileOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [isProfileOpen]);

  const firstName = user?.displayName?.trim().split(/\s+/)[0] || 'Usuário';

  return (
    <>
      <header className="safe-top sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 px-5 pb-4 pt-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar Clicável que abre o modal de perfil */}
            <button
              type="button"
              aria-label="Abrir perfil"
              onClick={() => setIsProfileOpen(true)}
              className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 ring-2 ring-zinc-800 active:scale-95 transition-transform"
            >
              <UserAvatar photoURL={user?.photoURL} name={user?.displayName} fallbackClassName="text-sm" />
            </button>

            <div className="flex flex-col">
              <span className="font-heading text-lg font-bold leading-tight text-zinc-50">
                {greeting}, {firstName}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                
                {/* A Mágica da Bolinha Pulsante (Radar Inteligente) */}
                <span className="relative flex h-2.5 w-2.5">
                  {isSyncing ? (
                    <>
                      <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping bg-sky-500" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                    </>
                  ) : (syncError || !online) ? (
                    <>
                      <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-pulse bg-red-500" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    </>
                  ) : (
                    <>
                      <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-pulse bg-emerald-500" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </>
                  )}
                </span>
                
                {(syncError || !online) && !isSyncing ? (
                  <button
                    type="button"
                    onClick={() => void refreshNow(true)}
                    disabled={!online}
                    aria-label={online ? 'Falha na atualização; tentar novamente' : 'Sem conexão; dados locais preservados'}
                    className="min-h-8 rounded-lg border border-red-500/25 bg-red-500/[.06] px-2 text-left text-[10px] font-bold text-red-300 active:bg-red-500/15"
                  >
                    {online ? 'Falha na atualização · Tentar novamente' : 'Sem conexão · dados locais'}
                  </button>
                ) : (
                  <span aria-live="polite" className="text-[11px] font-medium tracking-wide text-zinc-400">
                    {isSyncing ? 'Sincronizando...' : relativeUpdate(lastUpdate)}
                  </span>
                )}

              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshNow(true)}
              disabled={isSyncing || !online}
              className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-300 transition active:scale-95 disabled:opacity-60"
              aria-label={isSyncing ? 'Atualizando operação' : 'Buscar pedidos novos'}
              title="Buscar pedidos novos"
            >
              <RefreshCw size={17} className={isSyncing ? 'animate-spin text-sky-400' : ''} />
            </button>
            <PwaInstallPrompt />
          </div>
        </div>
      </header>

      {/* Modal de Edição / Visualização de Perfil */}
      {isProfileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/80 px-4 py-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Perfil da conta"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsProfileOpen(false);
          }}
        >
          <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-[28px] border border-zinc-800 bg-zinc-900 p-5 shadow-2xl sm:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative h-20 w-20 overflow-hidden rounded-full ring-4 ring-emerald-500/20">
                <UserAvatar photoURL={user?.photoURL} name={user?.displayName} fallbackClassName="text-xl" />
              </div>
              <h2 className="mt-4 font-heading text-lg font-bold text-zinc-50">{user?.displayName || 'Usuário DFL'}</h2>
              <p className="text-xs text-zinc-400">{user?.email || 'Conectado via Google'}</p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  logout();
                  setIsProfileOpen(false);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-red-500/10 py-3.5 font-semibold text-red-400 border border-red-500/20 active:scale-95"
              >
                <LogOut size={18} />
                Sair da Conta
              </button>
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className="rounded-2xl bg-zinc-800 py-3.5 font-semibold text-zinc-200 active:scale-95"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
