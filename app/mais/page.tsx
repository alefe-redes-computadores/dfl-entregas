// app/mais/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BellRing,
  Activity,
  ChevronRight,
  LogOut,
  ShieldCheck,
  MessageSquareText,
  SlidersHorizontal,
  UsersRound,
  ClipboardCheck,
  Settings2,
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
    <div className="dfl-page relative mx-auto max-w-3xl space-y-4 pb-[calc(env(safe-area-inset-bottom)+88px)] animate-in fade-in duration-300">
      <header className="px-1 pt-1">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">R294 · Centro de controle</p>
        <h1 className="mt-1 font-heading text-[24px] font-black leading-tight tracking-tight text-zinc-50">Mais</h1>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">Sua conta, comunicação e ajustes da operação, sem misturar as tarefas do dia.</p>
      </header>

      <section aria-label="Conta atual" className="flex items-center gap-3 rounded-[22px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[.08] via-zinc-900/65 to-zinc-950 p-3.5 shadow-[0_14px_32px_rgba(0,0,0,.14)]">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[16px] bg-gradient-to-br from-emerald-500 to-emerald-700 ring-2 ring-zinc-800">
          <UserAvatar photoURL={user?.photoURL} name={user?.displayName} fallbackClassName="text-xl" />
        </div>

        <div className="min-w-0 flex-1 text-left">
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-300">Conta conectada</p>
          <h2 className="break-words font-heading text-base font-black leading-snug text-zinc-50">
            {fullName}
          </h2>
          <p className="break-all text-[11px] text-zinc-400">
            {user?.email || 'Administrador Operacional'}
          </p>
        </div>
      </section>
      {isDiagnosticsAdmin && (
        <section aria-label="Gestão e integrações" className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-400">Gestão e integrações</p>
              <h2 className="mt-0.5 text-sm font-black text-zinc-100">Comunicação e operação</h2>
            </div>
            <span className="rounded-full border border-zinc-700/70 bg-zinc-900 px-2 py-1 text-[9px] font-bold text-zinc-400">Admin</span>
          </div>
          <button type="button" onClick={() => router.push('/mais/mensageria')}
            className="group flex min-h-[68px] w-full items-center gap-3 rounded-[20px] border border-amber-400/25 bg-gradient-to-r from-amber-400/[.12] to-zinc-900/70 px-3.5 py-3 text-left transition active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-amber-400/20 bg-amber-400/[.12] text-amber-200"><MessageSquareText size={19}/></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm font-black text-amber-100">Central de Mensageria 360°</strong><small className="mt-0.5 block text-[11px] leading-snug text-zinc-400">Envios, pendências e falhas · acesso administrativo</small></span>
            <ChevronRight size={17} className="shrink-0 text-amber-300 transition-transform group-active:translate-x-0.5" />
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => router.push('/confirmacoes')} className="flex min-h-[68px] min-w-0 items-center gap-2 rounded-[18px] border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-left transition active:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
              <ClipboardCheck size={17} className="shrink-0 text-emerald-400"/>
              <span className="min-w-0"><strong className="block text-[11px] font-black text-zinc-100">Confirmações</strong><small className="mt-0.5 block text-[10px] leading-tight text-zinc-500">Pedidos e códigos</small></span>
            </button>
            <button type="button" onClick={() => router.push('/mais/acompanhamento')} className="flex min-h-[68px] min-w-0 items-center gap-2 rounded-[18px] border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-left transition active:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
              <ShieldCheck size={17} className="shrink-0 text-sky-400"/>
              <span className="min-w-0"><strong className="block text-[11px] font-black text-zinc-100">Acompanhamento</strong><small className="mt-0.5 block text-[10px] leading-tight text-zinc-500">Acesso protegido</small></span>
            </button>
          </div>
          <div className="rounded-[18px] border border-zinc-800 bg-zinc-900/35 px-3 py-3">
            <div className="flex items-center gap-2"><Settings2 size={14} className="text-sky-300"/><p className="text-[10px] font-black uppercase tracking-wide text-zinc-300">Estado operacional</p></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <div className="min-w-0 rounded-xl bg-zinc-950/60 px-2.5 py-2"><p className="text-[9px] text-zinc-500">Avisos das rotas</p><p className="mt-0.5 font-black text-zinc-100">{operationalSettings.routeReminderEnabled !== false ? 'Ativos' : 'Pausados'}</p></div>
              <div className="min-w-0 rounded-xl bg-zinc-950/60 px-2.5 py-2"><p className="text-[9px] text-zinc-500">Fechamento</p><p className="mt-0.5 font-black text-zinc-100">{operationalSettings.autoCloseCompletedRoutes !== false ? 'Automático' : 'Manual'}</p></div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">Para alterar a operação, abra Minha Loja. Estes indicadores são locais; não confirmam entrega de mensagens ou conexão com servidores.</p>
          </div>
        </section>
      )}
      <section aria-label="Análises históricas" aria-hidden="true" className="hidden rounded-[22px] border border-zinc-800 bg-zinc-900/30 p-2.5">
        <button type="button" aria-expanded={legacyRadarOpen} aria-controls="dfl-legacy-radar-mais"
          onClick={() => setLegacyRadarOpen(open => !open)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2.5 text-left text-xs font-black text-zinc-300 active:bg-zinc-800/50">
          <span className="flex items-center gap-2"><Activity size={16} className="text-sky-300" /> Radar legado · análises avançadas</span>
          <ChevronRight size={16} className={`shrink-0 transition-transform ${legacyRadarOpen ? 'rotate-90' : ''}`} />
        </button>
        {legacyRadarOpen && <div id="dfl-legacy-radar-mais" className="border-t border-zinc-800 pt-3"><OperationalRadar /></div>}
      </section>

      <section aria-label="Preferências e ferramentas" className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-1"><SlidersHorizontal size={15} className="text-zinc-400"/><h2 className="text-xs font-black uppercase tracking-[.12em] text-zinc-400">Preferências e ferramentas</h2></div>

        <div className="flex flex-col overflow-hidden rounded-[20px] border border-zinc-800 bg-zinc-900/40">
          <button
            type="button"
            onClick={() => router.push('/mais/notificacoes')}
            className="flex min-h-14 w-full items-center gap-3 border-b border-zinc-800/80 px-3.5 py-3 text-left transition-colors active:bg-zinc-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <BellRing size={18} />
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
            className="flex min-h-14 w-full items-center gap-3 border-b border-zinc-800/80 px-3.5 py-3 text-left transition-colors active:bg-zinc-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><UsersRound size={18}/></div>
            <div className="min-w-0 flex-1"><p className="font-semibold text-zinc-100">Equipe e permissoes</p><p className="text-xs text-zinc-500">Preparar acessos, funcoes e vinculos de funcionarios</p></div>
            <ChevronRight size={18} className="shrink-0 text-zinc-600" />
          </button>}


          {isDiagnosticsAdmin && <details className="group border-t border-zinc-800/80">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 text-left text-xs font-semibold text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
              <Activity size={17} className="text-sky-400"/><span className="min-w-0 flex-1">Ferramentas e diagnósticos</span><ChevronRight size={16} className="shrink-0 transition-transform group-open:rotate-90"/>
            </summary>
            <button type="button" onClick={() => router.push('/mais/diagnostico')} className="flex min-h-12 w-full items-center gap-3 border-t border-zinc-800/70 bg-zinc-950/40 px-4 py-3 text-left text-xs text-zinc-300 active:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
              <Activity size={16} className="text-sky-400"/><span className="min-w-0 flex-1"><strong className="block font-bold text-zinc-100">Diagnóstico local</strong><small className="block text-[10px] leading-tight text-zinc-500">Leituras, duração e notificações agendadas</small></span><ChevronRight size={16}/>
            </button>
          </details>}
        </div>
      </section>

      <button
        type="button"
        onClick={handleLogout}
        className="mx-auto mb-4 mt-1 flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold text-red-400 transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
      >
        <LogOut size={16} />
        Sair da conta
      </button>
    </div>
  );
}
