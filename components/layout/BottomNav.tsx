// components/layout/BottomNav.tsx
'use client';

import {
  BarChart3,
  Bike,
  Home,
  PackagePlus,
  Plus,
  Store,
  UserPlus,
  MoreHorizontal,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { readUnreadSiteOrderIds, SITE_UNREAD_EVENT } from '@/lib/site-order-inbox';

const NAV_ITEMS = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/loja', label: 'Loja', icon: Store },
  { href: '__fab__', label: 'Adicionar', icon: Plus },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/mais', label: 'Mais', icon: MoreHorizontal },
] as const;

type AddMode =
  | { kind: 'direct'; href: string; label: string }
  | { kind: 'sheet'; label: string; options: Array<{ href: string; label: string; description: string; icon: typeof Plus; tone: 'sky' | 'emerald' | 'violet' }> }
  | null;

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [siteUnread, setSiteUnread] = useState(0);

  useEffect(() => {
    const refresh = () => setSiteUnread(readUnreadSiteOrderIds().length);
    refresh();
    window.addEventListener(SITE_UNREAD_EVENT, refresh);
    return () => window.removeEventListener(SITE_UNREAD_EVENT, refresh);
  }, []);

  const addMode: AddMode =
    pathname === '/estoque'
      ? { kind: 'direct', href: '/estoque/novo', label: 'Novo produto' }
      : pathname === '/abastecimentos'
        ? { kind: 'direct', href: '/abastecimentos/novo', label: 'Nova compra' }
        : pathname === '/entregas'
          ? { kind: 'direct', href: '/entregas/nova', label: 'Nova entrega' }
          : pathname === '/rotas'
            ? { kind: 'direct', href: '/rotas/nova', label: 'Nova rota' }
            : pathname === '/clientes'
              ? { kind: 'direct', href: '/clientes/novo', label: 'Novo cliente' }
              : pathname === '/motoboys'
                ? { kind: 'direct', href: '/motoboys/novo', label: 'Novo entregador' }
                : pathname === '/despesas'
                  ? { kind: 'direct', href: '/despesas/novo', label: 'Nova despesa' }
                  : pathname === '/confirmacoes'
                    ? { kind: 'direct', href: '/confirmacoes?add=1', label: 'Nova pendência iFood' }
                    : pathname === '/equipe'
                      ? {
                          kind: 'sheet',
                          label: 'Adicionar pessoa',
                          options: [
                            {
                              href: '/equipe?add=interno',
                              label: 'Integrante da loja',
                              description: 'Administração, cozinha, atendimento ou compras',
                              icon: UserPlus,
                              tone: 'violet',
                            },
                            {
                              href: '/motoboys/novo',
                              label: 'Entregador / motoboy',
                              description: 'Cadastro, regra de pagamento e acerto',
                              icon: Bike,
                              tone: 'sky',
                            },
                          ],
                        }
                      : pathname === '/' || pathname === '/loja'
                        ? {
                            kind: 'sheet',
                            label: 'Adicionar',
                            options: [
                              {
                                href:
                                  pathname === '/'
                                    ? '/rotas/nova?returnTo=%2F'
                                    : '/rotas/nova?returnTo=%2Floja',
                                label: 'Adicionar rota',
                                description: 'Abrir uma nova rota de entrega',
                                icon: Bike,
                                tone: 'sky',
                              },
                              {
                                href:
                                  pathname === '/'
                                    ? '/entregas/nova?returnTo=%2F'
                                    : '/entregas/nova?returnTo=%2Floja',
                                label: 'Adicionar entrega',
                                description: 'Lançar um pedido em uma rota aberta',
                                icon: PackagePlus,
                                tone: 'emerald',
                              },
                            ],
                          }
                        : null;

  const handleAdd = () => {
    if (!addMode) return;
    if (addMode.kind === 'direct') {
      router.push(addMode.href);
      return;
    }
    setShowAddSheet(true);
  };

  if (
    pathname.includes('/nova') ||
    pathname.includes('/novo') ||
    pathname.includes('/editar') ||
    pathname.includes('/movimentar') ||
    pathname.includes('/contagem')
  ) {
    return null;
  }

  return (
    <>
      <nav className="dfl-fixed-width safe-bottom pointer-events-none fixed bottom-0 left-1/2 z-40 -translate-x-1/2 px-2 pb-1">
        <div className="pointer-events-auto mx-auto flex w-full items-center justify-between rounded-[22px] border border-zinc-800/80 bg-zinc-950/95 px-1.5 py-1.5 shadow-[0_-10px_36px_rgba(0,0,0,.38)] backdrop-blur-xl">
          {NAV_ITEMS.filter((item) => item.href !== '__fab__' || Boolean(addMode)).map((item) => {
            const Icon = item.icon;
            const isFab = item.href === '__fab__';
            const isActive = !isFab && pathname === item.href;

            if (isFab) {
              return (
                <div key={item.label} className="flex flex-1 justify-center">
                  <button
                    onClick={handleAdd}
                    aria-label={addMode?.label || 'Adicionar'}
                    className="-mt-6 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] border border-amber-300/40 bg-gradient-to-br from-amber-300 to-amber-500 text-zinc-950 shadow-[0_10px_26px_rgba(245,158,11,.28)] transition-transform active:scale-90"
                  >
                    <Icon size={26} strokeWidth={2.5} />
                  </button>
                </div>
              );
            }

            return (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                className={clsx(
                  'mx-0.5 flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[14px] py-1.5 text-[9px] font-black transition',
                  isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-600 active:bg-zinc-900',
                )}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  {siteUnread > 0 && (item.href === '/' || item.href === '/loja') && (
                    <b className="absolute -right-3 -top-2 grid min-w-[17px] place-items-center rounded-full border-2 border-zinc-950 bg-amber-400 px-1 text-[7px] leading-[13px] text-zinc-950">
                      {siteUnread > 9 ? '9+' : siteUnread}
                    </b>
                  )}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {showAddSheet && addMode?.kind === 'sheet' && (
        <div
          className="fixed inset-0 z-[100] flex items-end bg-black/75 backdrop-blur-sm"
          onClick={() => setShowAddSheet(false)}
        >
          <div
            className="dfl-bottom-sheet safe-bottom mx-auto w-full max-w-md p-5 pb-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-zinc-700" />
            <h2 className="font-heading text-lg font-black text-zinc-100">
              {addMode.label}
            </h2>

            <div className="mt-4 space-y-2">
              {addMode.options.map((option) => {
                const OptionIcon = option.icon;
                const tone = option.tone === 'sky'
                  ? 'border-sky-500/20 bg-sky-500/[.055] text-sky-400'
                  : option.tone === 'emerald'
                    ? 'border-emerald-500/20 bg-emerald-500/[.055] text-emerald-400'
                    : 'border-violet-500/20 bg-violet-500/[.055] text-violet-400';
                return (
                  <button
                    key={option.href}
                    type="button"
                    onClick={() => {
                      setShowAddSheet(false);
                      router.push(option.href);
                    }}
                    className={clsx('flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[.985]', tone)}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-current/10">
                      <OptionIcon size={19} />
                    </span>
                    <span className="min-w-0">
                      <strong className="block text-sm text-zinc-100">{option.label}</strong>
                      <span className="mt-0.5 block text-[10px] text-zinc-600">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
