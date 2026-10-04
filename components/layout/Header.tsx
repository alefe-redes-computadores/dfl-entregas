'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';
import { User, LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/UserAvatar';
import { latestSyncDiagnostic, SYNC_DIAGNOSTIC_EVENT } from '@/lib/sync-diagnostics';

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
  const lastForegroundSyncRef = useRef(0);
  
  const [greeting, setGreeting] = useState('Boa noite');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | undefined>();
  const [, setClock] = useState(0);

  useEffect(() => {
    setGreeting(getGreeting());
    setLastUpdate(latestSyncDiagnostic()?.finishedAt);
  }, []);

  useEffect(() => {
    const update = (event: Event) => setLastUpdate((event as CustomEvent<{ finishedAt?: string }>).detail?.finishedAt);
    let timer = 0;
    const tick = () => {
      timer = window.setTimeout(() => {
        setClock((value) => value + 1);
        tick();
      }, 60_000);
    };
    tick();
    window.addEventListener(SYNC_DIAGNOSTIC_EVENT, update);
    return () => { window.clearTimeout(timer); window.removeEventListener(SYNC_DIAGNOSTIC_EVENT, update); };
  }, []);

  const refreshNow = useCallback(async (showFeedback = true) => {
    if (useAppStore.getState().isSyncing) {
      if (showFeedback) toast.info('A atualização já está em andamento.');
      return;
    }

    lastForegroundSyncRef.current = Date.now();
    const toastId = showFeedback ? toast.loading('Buscando pedidos novos...') : undefined;
    await initData();

    const failed = useAppStore.getState().syncError;
    if (showFeedback && toastId !== undefined) {
      if (failed) toast.error('Não foi possível atualizar agora.', { id: toastId });
      else toast.success('Operação atualizada.', { id: toastId, duration: 1400 });
    }
  }, [initData]);

  useEffect(() => {
    const refreshOnForeground = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastForegroundSyncRef.current < 120_000) return;
      void refreshNow(false);
    };
    document.addEventListener('visibilitychange', refreshOnForeground);
    window.addEventListener('dfl:app-foreground', refreshOnForeground);
    return () => {
      document.removeEventListener('visibilitychange', refreshOnForeground);
      window.removeEventListener('dfl:app-foreground', refreshOnForeground);
    };
  }, [refreshNow]);

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
                  ) : syncError ? (
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
                
                <span className={`text-[11px] font-medium tracking-wide ${syncError && !isSyncing ? 'text-red-400' : 'text-zinc-400'}`}>
                  {isSyncing ? 'Sincronizando...' : syncError ? 'Offline / Erro' : relativeUpdate(lastUpdate)}
                </span>

              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshNow(true)}
              disabled={isSyncing}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Perfil da conta"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsProfileOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-[28px] border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
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
