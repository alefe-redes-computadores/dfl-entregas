// app/mais/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BellRing,
  Activity,
  ChevronRight,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { UserAvatar } from '@/components/UserAvatar';
import { isSuperadminUid } from '@/lib/access/roles';
import { OperationalRadar } from '@/components/home/OperationalRadar';

export default function MaisPage() {
  const router = useRouter();
  const [legacyRadarOpen, setLegacyRadarOpen] = useState(false);

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
        <section aria-label="Gestão e integrações" className="space-y-3">
          <div className="px-1">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-400">Gestão e integrações</p>
            <h2 className="mt-1 text-sm font-black text-zinc-100">Ferramentas administrativas</h2>
          </div>
          <button type="button" onClick={() => router.push('/mais/mensageria')}
            className="flex min-h-16 w-full items-center justify-between gap-3 rounded-[20px] border border-amber-400/25 bg-amber-400/[.07] px-4 text-left active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
            <span className="min-w-0"><strong className="block text-sm font-black text-amber-200">Central de Mensageria 360°</strong><small className="mt-1 block text-[10px] text-zinc-400">Envios, pendências e falhas · acesso administrativo</small></span>
            <ChevronRight size={18} className="shrink-0 text-amber-300" />
          </button>
          <div className="rounded-[20px] border border-sky-500/15 bg-zinc-900/40 px-3.5 py-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-sky-300">Estado operacional</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <span className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 text-zinc-300">Avisos das rotas: {operationalSettings.routeReminderEnabled !== false ? 'ativos' : 'pausados'}</span>
              <span className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 text-zinc-300">Fechamento: {operationalSettings.autoCloseCompletedRoutes !== false ? 'automático' : 'manual'}</span>
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">Configurações de abertura e operação continuam exclusivamente em Minha Loja.</p>
          </div>
        </section>
      )}
      <section aria-label="Análises históricas" className="rounded-[22px] border border-zinc-800 bg-zinc-900/30 p-2.5">
        <button type="button" aria-expanded={legacyRadarOpen} aria-controls="dfl-legacy-radar-mais"
          onClick={() => setLegacyRadarOpen(open => !open)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2.5 text-left text-xs font-black text-zinc-300 active:bg-zinc-800/50">
          <span className="flex items-center gap-2"><Activity size={16} className="text-sky-300" /> Radar legado · análises avançadas</span>
          <ChevronRight size={16} className={`shrink-0 transition-transform ${legacyRadarOpen ? 'rotate-90' : ''}`} />
        </button>
        {legacyRadarOpen && <div id="dfl-legacy-radar-mais" className="border-t border-zinc-800 pt-3"><OperationalRadar /></div>}
      </section>

<section className="flex flex-col gap-2">
        <h2 className="px-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Ferramentas e sistema
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
            onClick={() => router.push('/mais/acompanhamento')}
            className="flex w-full items-center gap-4 p-4 text-left transition-colors active:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-100">Central de Acompanhamento</p>
              <p className="text-xs text-zinc-500">Gate 1 interno · eventos, privacidade e confirmação segura</p>
            </div>
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
