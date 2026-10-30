// app/mais/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { BellRing,
  Activity,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Store,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { UserAvatar } from '@/components/UserAvatar';
import { isSuperadminUid } from '@/lib/access/roles';

export default function MaisPage() {
  const router = useRouter();

  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const fullName = user?.displayName?.trim() || 'Usuário DFL';
  const isDiagnosticsAdmin = isSuperadminUid(user?.uid);
  const operationalSettings = useAppStore((state) => state.storeSettings);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Sessão encerrada.');
    } catch {
      toast.error('Não foi possível sair da conta.');
    }
  };

  return (
    <div className="dfl-page relative animate-in fade-in duration-300">
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

      <section className="flex items-center gap-3 rounded-[22px] border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[.055] via-zinc-900/45 to-zinc-950 p-4 shadow-[0_14px_32px_rgba(0,0,0,.14)]">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[18px] bg-gradient-to-br from-emerald-500 to-emerald-700 ring-2 ring-zinc-800">
          <UserAvatar photoURL={user?.photoURL} name={user?.displayName} fallbackClassName="text-xl" />
        </div>

        <div className="min-w-0 flex-1 text-left">
          <h2 className="break-words font-heading text-lg font-bold text-zinc-50">
            {fullName}
          </h2>
          <p className="break-all text-sm text-zinc-500">
            {user?.email || 'Administrador Operacional'}
          </p>
        </div>
      </section>
      {isDiagnosticsAdmin && (
        <section aria-label="Resumo administrativo da operação" className="rounded-[22px] border border-sky-500/20 bg-gradient-to-br from-sky-500/[.07] to-zinc-950 p-3.5">
          <div className="mb-3 flex items-center gap-2"><SlidersHorizontal size={17} className="text-sky-300"/><h2 className="text-sm font-black text-zinc-100">Preferências operacionais</h2></div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <span className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 text-zinc-300">Rotas: {operationalSettings.routeReminderEnabled !== false ? 'avisos ativos' : 'avisos pausados'}</span>
            <span className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 text-zinc-300">Fechamento: {operationalSettings.autoCloseCompletedRoutes !== false ? 'automático' : 'manual'}</span>
          </div>
          <button type="button" onClick={() => router.push('/loja')} className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 text-left text-xs font-black text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"><span className="flex items-center gap-2"><Store size={15}/> Configurar na Minha Loja</span><ChevronRight size={16}/></button>
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">Somente administradores acessam os controles. O resumo não altera configurações.</p>
        </section>
      )}
<section className="flex flex-col gap-2">
        <h2 className="px-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Sistema e dados
        </h2>

        <div className="flex flex-col overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40">
          <button
            type="button"
            onClick={() => router.push('/mais/notificacoes')}
            className="flex w-full items-center gap-4 border-b border-zinc-800/80 p-4 text-left transition-colors active:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <BellRing size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-100">Notificações</p>
              <p className="text-xs text-zinc-500">
                Expediente, rotas, iFood, estoque e sistema
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-zinc-600" />
          </button>

          {isDiagnosticsAdmin && <button
            type="button"
            onClick={() => router.push('/mais/acessos')}
            className="flex w-full items-center gap-4 border-b border-zinc-800/80 p-4 text-left transition-colors active:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400"><ShieldCheck size={20}/></div>
            <div className="min-w-0 flex-1"><p className="font-semibold text-zinc-100">Equipe e permissoes</p><p className="text-xs text-zinc-500">Preparar acessos, funcoes e vinculos de funcionarios</p></div>
            <ChevronRight size={18} className="shrink-0 text-zinc-600" />
          </button>}

          {isDiagnosticsAdmin && <button
            type="button"
            onClick={() => router.push('/mais/diagnostico')}
            className="flex w-full items-center gap-4 p-4 text-left transition-colors active:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
              <Activity size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-100">Diagnóstico local</p>
              <p className="text-xs text-zinc-500">
                Leituras retornadas, duração e notificações agendadas
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-zinc-600" />
          </button>}
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
