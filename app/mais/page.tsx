// app/mais/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckSquare,
  ChevronRight,
  ReceiptText,
  LockKeyhole,
  LogOut,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';

export default function MaisPage() {
  const router = useRouter();

  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const initData = useAppStore((state) => state.initData);
  const isSyncing = useAppStore((state) => state.isSyncing);
  const syncError = useAppStore((state) => state.syncError);

  const [syncChecking, setSyncChecking] = useState(false);

  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Álefe';
  const fullName = user?.displayName || 'Álefe Jôhsefe';

  const handleSync = async () => {
    if (isSyncing || syncChecking) return;

    setSyncChecking(true);
    toast.loading('Sincronizando com a nuvem...', { id: 'sync-toast' });

    try {
      await initData();

      window.setTimeout(() => {
        const currentState = useAppStore.getState();

        if (currentState.syncError) {
          toast.error('Falha na sincronização', {
            id: 'sync-toast',
            description:
              'Não foi possível conectar. Confira sua internet e tente novamente.',
            duration: 4000,
          });
        } else {
          toast.success('Sincronização concluída', {
            id: 'sync-toast',
            description:
              'Rotas, clientes e entregas estão atualizados com a nuvem.',
            duration: 3000,
          });
        }

        setSyncChecking(false);
      }, 500);
    } catch {
      setSyncChecking(false);
      toast.error('Não foi possível sincronizar', {
        id: 'sync-toast',
        description: 'Tente novamente quando a conexão estiver estável.',
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Sessão encerrada.');
    } catch {
      toast.error('Não foi possível sair da conta.');
    }
  };

  const syncing = isSyncing || syncChecking;

  return (
    <div className="relative flex flex-col gap-6 pb-24 animate-in fade-in duration-300">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">
          Sistema
        </p>
        <h1 className="mt-1 font-heading text-2xl font-black text-zinc-50">
          Configurações e Mais
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Conta, ferramentas operacionais e estado da sincronização.
        </p>
      </header>

      <section className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-zinc-800 bg-zinc-900/40 p-6 shadow-sm">
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 ring-4 ring-zinc-800">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="Perfil"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-heading text-2xl font-bold text-white">
              {firstName.charAt(0)}
            </div>
          )}
        </div>

        <div className="text-center">
          <h2 className="font-heading text-lg font-bold text-zinc-50">
            {fullName}
          </h2>
          <p className="text-sm text-zinc-500">
            {user?.email || 'Administrador Operacional'}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Ferramentas
        </h2>

        <div className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40">
          <button
            type="button"
            onClick={() => router.push('/confirmacoes')}
            className="flex w-full items-center gap-4 p-4 text-left transition-colors active:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <CheckSquare size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-100">
                Central de Confirmações
              </p>
              <p className="text-xs text-zinc-500">
                Pendências do iFood e acesso ao portal
              </p>
            </div>

            <ChevronRight size={18} className="shrink-0 text-zinc-600" />
          </button>

          <button
            type="button"
            onClick={() => router.push('/despesas')}
            className="flex w-full items-center gap-4 border-t border-zinc-800/80 p-4 text-left transition-colors active:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
              <ReceiptText size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-100">
                Despesas operacionais
              </p>
              <p className="text-xs text-zinc-500">
                Diárias, fretes, taxas e outros custos fora do estoque
              </p>
            </div>

            <ChevronRight size={18} className="shrink-0 text-zinc-600" />
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Sistema e dados
        </h2>

        <div className="flex flex-col overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-4 border-b border-zinc-800/80 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
              <Moon size={20} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-semibold text-zinc-100">Tema escuro</p>
              <p className="text-xs text-zinc-500">
                Padrão visual ativo no aplicativo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="flex w-full items-center gap-4 border-b border-zinc-800/80 p-4 text-left transition-colors active:bg-zinc-800/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                syncError
                  ? 'bg-red-500/10 text-red-500'
                  : 'bg-emerald-500/10 text-emerald-500'
              }`}
            >
              <RefreshCw size={20} className={syncing ? 'animate-spin' : ''} />
            </div>

            <div className="min-w-0 flex-1">
              <p
                className={`font-semibold ${
                  syncError ? 'text-red-400' : 'text-zinc-100'
                }`}
              >
                {syncing
                  ? 'Buscando dados...'
                  : syncError
                    ? 'Falha na última sincronização'
                    : 'Sincronizar agora'}
              </p>
              <p className="text-xs text-zinc-500">
                {syncing
                  ? 'Aguarde a atualização terminar'
                  : 'Forçar atualização dos dados na nuvem'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-500">
              <LockKeyhole size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-300">
                Limpeza local protegida
              </p>
              <p className="text-xs leading-relaxed text-zinc-600">
                A exclusão em massa permanece indisponível para evitar perda
                acidental de dados.
              </p>
            </div>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={handleLogout}
        className="mx-auto mb-4 mt-4 flex items-center gap-2 text-sm font-bold text-red-500 transition active:scale-95"
      >
        <LogOut size={16} />
        Sair da conta
      </button>
    </div>
  );
}
