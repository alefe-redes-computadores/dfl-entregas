'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function Header() {
  const isSyncing = useAppStore((state) => state.isSyncing);
  const initData = useAppStore((state) => state.initData);
  const [greeting, setGreeting] = useState('Boa noite');

  useEffect(() => {
    setGreeting(getGreeting());
    initData();
  }, [initData]);

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 px-5 pb-4 pt-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 ring-2 ring-zinc-800">
            <div className="flex h-full w-full items-center justify-center font-heading text-sm font-bold text-white">
              A
            </div>
          </div>

          <div className="flex flex-col">
            <span className="font-heading text-lg font-bold leading-tight text-zinc-50">
              {greeting}, Álefe
            </span>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                {isSyncing && (
                  <span className="absolute inline-flex h-full w-full animate-pulse-sync rounded-full bg-emerald-500 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isSyncing ? 'bg-emerald-500' : 'bg-emerald-500/30'
                  }`}
                />
              </span>
              <span className="text-xs text-zinc-500">
                {isSyncing ? 'Sincronizando...' : 'Online'}
              </span>
            </div>
          </div>
        </div>

        {/* Botão inteligente de instalação do PWA */}
        <PwaInstallPrompt />
      </div>
    </header>
  );
}
