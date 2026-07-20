'use client';

import { Home, Users, Plus, BarChart3, MoreHorizontal } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '__fab__', label: 'Adicionar', icon: Plus },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/mais', label: 'Mais', icon: MoreHorizontal },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAddSheet, setShowAddSheet] = useState(false);

  return (
    <>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isFab = item.href === '__fab__';
            const isActive = !isFab && pathname === item.href;

            if (isFab) {
              return (
                <button
                  key={item.label}
                  onClick={() => setShowAddSheet(true)}
                  aria-label="Adicionar"
                  className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/30 transition-transform active:scale-90"
                >
                  <Icon size={26} strokeWidth={2.5} />
                </button>
              );
            }

            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className="flex flex-col items-center gap-1 px-2 py-1.5 transition-colors active:scale-95"
              >
                <Icon
                  size={22}
                  strokeWidth={2}
                  className={clsx(isActive ? 'text-emerald-500' : 'text-zinc-500')}
                />
                <span
                  className={clsx(
                    'text-[11px] font-medium',
                    isActive ? 'text-emerald-500' : 'text-zinc-500'
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {showAddSheet && (
        <AddActionSheet onClose={() => setShowAddSheet(false)} />
      )}
    </>
  );
}

function AddActionSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <div className="safe-bottom relative w-full max-w-md rounded-t-[28px] border-t border-zinc-800 bg-zinc-900 p-5 pb-8">
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-zinc-700" />

        <h2 className="mb-4 font-heading text-lg font-bold text-zinc-50">
          O que deseja adicionar?
        </h2>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              onClose();
              router.push('/rotas/nova');
            }}
            className="flex items-center gap-3 rounded-[20px] border border-zinc-800 bg-zinc-800/50 p-4 text-left transition-transform active:scale-[0.97]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <Home size={20} />
            </div>
            <div>
              <p className="font-semibold text-zinc-100">Adicionar Rota</p>
              <p className="text-xs text-zinc-500">Abrir uma nova rota de entrega</p>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              router.push('/entregas/nova');
            }}
            className="flex items-center gap-3 rounded-[20px] border border-zinc-800 bg-zinc-800/50 p-4 text-left transition-transform active:scale-[0.97]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <Plus size={20} />
            </div>
            <div>
              <p className="font-semibold text-zinc-100">Adicionar Entrega</p>
              <p className="text-xs text-zinc-500">Lançar um pedido em uma rota aberta</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
