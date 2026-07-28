'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';
import { User, LogOut } from 'lucide-react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function Header() {
  const isSyncing = useAppStore((state) => state.isSyncing);
  const syncError = useAppStore((state) => state.syncError); // <-- IMPORTAMOS O ESTADO DE ERRO
  const initData = useAppStore((state) => state.initData);
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  
  const [greeting, setGreeting] = useState('Boa noite');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    setGreeting(getGreeting());
    initData();
  }, [initData]);

  // Pega o primeiro nome do usuário ou usa "Álefe" como fallback
  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Álefe';

  return (
    <>
      <header className="safe-top sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 px-5 pb-4 pt-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar Clicável que abre o modal de perfil */}
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 ring-2 ring-zinc-800 active:scale-95 transition-transform"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Perfil" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-heading text-sm font-bold text-white">
                  {firstName.charAt(0)}
                </div>
              )}
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
                  {isSyncing ? 'Sincronizando...' : syncError ? 'Offline / Erro' : 'Online'}
                </span>

              </div>
            </div>
          </div>

          <PwaInstallPrompt />
        </div>
      </header>

      {/* Modal de Edição / Visualização de Perfil */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="relative h-20 w-20 overflow-hidden rounded-full ring-4 ring-emerald-500/20">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Perfil" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-xl font-bold text-white">
                    {firstName.charAt(0)}
                  </div>
                )}
              </div>
              <h2 className="mt-4 font-heading text-lg font-bold text-zinc-50">{user?.displayName || 'Usuário DFL'}</h2>
              <p className="text-xs text-zinc-400">{user?.email || 'Conectado via Google'}</p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
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
