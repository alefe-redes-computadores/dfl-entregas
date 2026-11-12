'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Activity, BellRing, ChevronDown, ChevronRight, LogOut, MessageSquareText,
  RefreshCw, ShieldCheck, SlidersHorizontal, Sparkles, UserRound,
  UsersRound, WalletCards, type LucideIcon,
} from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { OperationalRadar } from '@/components/home/OperationalRadar';
import { isSuperadminUid } from '@/lib/access/roles';

type Tone = 'emerald' | 'amber' | 'sky' | 'violet' | 'neutral';
const tones: Record<Tone, { icon: string; frame: string; arrow: string }> = {
  emerald: { icon: 'bg-emerald-400/10 text-emerald-300', frame: 'border-emerald-500/20', arrow: 'text-emerald-300' },
  amber: { icon: 'bg-amber-400/10 text-amber-300', frame: 'border-amber-500/20', arrow: 'text-amber-300' },
  sky: { icon: 'bg-sky-400/10 text-sky-300', frame: 'border-sky-500/20', arrow: 'text-sky-300' },
  violet: { icon: 'bg-violet-400/10 text-violet-300', frame: 'border-violet-500/20', arrow: 'text-violet-300' },
  neutral: { icon: 'bg-zinc-800 text-zinc-300', frame: 'border-zinc-800', arrow: 'text-zinc-500' },
};

function SectionHeading({ eyebrow, title, count }: { eyebrow: string; title: string; count?: string }) {
  return <div className="flex items-end justify-between gap-3 px-1">
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">{eyebrow}</p>
      <h2 className="mt-1 font-heading text-[15px] font-black text-zinc-100">{title}</h2>
    </div>
    {count && <span className="text-[10px] font-bold text-zinc-600">{count}</span>}
  </div>;
}

function Destination({ icon: Icon, title, description, tone = 'neutral', onClick, first = false }: {
  icon: LucideIcon; title: string; description: string; tone?: Tone; onClick: () => void; first?: boolean;
}) {
  const style = tones[tone];
  return <button type="button" onClick={onClick}
    className={`group flex min-h-[70px] w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-white/[.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${first ? '' : 'border-t border-zinc-800/75'}`}>
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] ${style.icon}`}><Icon size={19} strokeWidth={2}/></span>
    <span className="min-w-0 flex-1">
      <strong className="block text-[13px] font-black text-zinc-100">{title}</strong>
      <span className="mt-0.5 block text-[11px] leading-[1.45] text-zinc-400">{description}</span>
    </span>
    <ChevronRight size={16} className={`shrink-0 transition-transform group-active:translate-x-0.5 ${style.arrow}`} />
  </button>;
}

export default function MaisPage() {
  const router = useRouter();
  const user = useAppStore(state => state.user);
  const logout = useAppStore(state => state.logout);
  const isDiagnosticsAdmin = isSuperadminUid(user?.uid);
  const [leaving, setLeaving] = useState(false);
  const [legacyRadarOpen, setLegacyRadarOpen] = useState(false);
  const handleLogout = async () => {
    if (leaving) return;
    setLeaving(true);
    try { await logout(); toast.success('Sessão encerrada.'); }
    catch { toast.error('Não foi possível sair da conta.'); }
    finally { setLeaving(false); }
  };

  return <main className="dfl-page mx-auto max-w-3xl space-y-5 pb-[calc(env(safe-area-inset-bottom)+112px)] animate-in fade-in duration-300">
    <header className="px-1 pt-1">
      <div className="mb-1 flex items-center gap-2 text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <p className="text-[9px] font-black uppercase tracking-[0.2em]">Seu centro de controle</p>
      </div>
      <h1 className="font-heading text-[25px] font-black tracking-tight text-zinc-50">Mais</h1>
      <p className="mt-1 max-w-md text-[12px] leading-relaxed text-zinc-400">Preferências e ferramentas organizadas para a operação.</p>
    </header>

    <section aria-label="Acessos principais" className="grid grid-cols-2 gap-2.5">
      <button type="button" onClick={() => router.push('/mais/preferencias')}
        className="flex min-h-[116px] flex-col justify-between rounded-[20px] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[.14] to-zinc-900/70 p-3.5 text-left transition active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
        <div className="flex w-full items-start justify-between"><SlidersHorizontal size={21} className="text-emerald-300"/><ChevronRight size={15} className="text-emerald-500"/></div>
        <div><strong className="block text-[13px] font-black text-zinc-50">Preferências 360</strong><span className="mt-1 block text-[10px] leading-snug text-zinc-400">Rotas, parceiros e expediente</span></div>
      </button>
      <button type="button" onClick={() => router.push('/mais/notificacoes')}
        className="flex min-h-[116px] flex-col justify-between rounded-[20px] border border-sky-500/20 bg-gradient-to-br from-sky-500/[.09] to-zinc-900/70 p-3.5 text-left transition active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
        <div className="flex w-full items-start justify-between"><BellRing size={21} className="text-sky-300"/><ChevronRight size={15} className="text-sky-500"/></div>
        <div><strong className="block text-[13px] font-black text-zinc-50">Notificações</strong><span className="mt-1 block text-[10px] leading-snug text-zinc-400">Categorias, horários e privacidade</span></div>
      </button>
    </section>

    {isDiagnosticsAdmin && <section aria-label="Comunicação e inteligência" className="space-y-2.5">
      <SectionHeading eyebrow="Gestão e integrações" title="Comunicação e inteligência" />
      <div className="overflow-hidden rounded-[20px] border border-zinc-800 bg-zinc-900/35">
        <Destination first tone="amber" icon={MessageSquareText} title="Comunicação 360" description="Central de Mensageria 360° · acompanhamento privado · modelos e imagens" onClick={() => router.push('/mais/comunicacao')}/>
        <Destination tone="violet" icon={Sparkles} title="DFL Intelligence" description="Inteligência de Clientes · recomendações, bairros, qualidade e operação" onClick={() => router.push('/mais/inteligencia')}/>
      </div>
      <details className="group rounded-2xl border border-zinc-800 bg-zinc-950/35">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 text-[11px] font-semibold text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
          <Activity size={15} className="text-zinc-500"/><span className="flex-1">Acessos técnicos diretos</span><ChevronDown size={15} className="transition-transform group-open:rotate-180"/>
        </summary>
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 p-2.5">
          <button type="button" onClick={() => router.push('/mais/mensageria')} className="flex min-h-[55px] min-w-0 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-2.5 text-left text-[10px] font-bold text-zinc-300 transition-colors active:bg-zinc-800/60"><MessageSquareText size={17} className="shrink-0 text-amber-300"/><span className="min-w-0 leading-tight">Mensageria original</span></button>
          <button type="button" onClick={() => router.push('/mais/acompanhamento')} className="flex min-h-[55px] min-w-0 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-2.5 text-left text-[10px] font-bold text-zinc-300 transition-colors active:bg-zinc-800/60"><ShieldCheck size={17} className="shrink-0 text-sky-300"/><span className="min-w-0 leading-tight">Acompanhamento original</span></button>
        </div>
      </details>
    </section>}

    {/* O Radar legado permanece isolado para compatibilidade. Nao compete com a navegacao premium. */}
    {isDiagnosticsAdmin && <section aria-label="Análises históricas" aria-hidden="true" className="hidden">
      <button type="button" onClick={() => setLegacyRadarOpen(open => !open)} aria-expanded={legacyRadarOpen}
        className="min-h-11 text-xs text-zinc-500">Radar legado · análises avançadas</button>
      {legacyRadarOpen && <OperationalRadar />}
    </section>}

    <section aria-label="Aplicativo e ferramentas" className="space-y-2.5">
      <SectionHeading eyebrow="Sistema" title="Aplicativo e ferramentas" />
      <div className="overflow-hidden rounded-[20px] border border-zinc-800 bg-zinc-900/35">
        <Destination first tone="sky" icon={RefreshCw} title="Central de Atualizações" description="APK, novas versões e instalação segura" onClick={() => router.push('/mais/atualizacoes')}/>
        {isDiagnosticsAdmin && <Destination tone="neutral" icon={UsersRound} title="Equipe e permissões" description="Acessos e funções dos colaboradores" onClick={() => router.push('/mais/acessos')}/>}
        {isDiagnosticsAdmin && <Destination tone="neutral" icon={ShieldCheck} title="Diagnóstico local" description="Verificações técnicas e saúde do dispositivo" onClick={() => router.push('/mais/diagnostico')}/>}
      </div>
    </section>

    <section aria-label="Conta e segurança" className="space-y-2.5">
      <SectionHeading eyebrow="Conta" title="Sua sessão" />
      <details className="group overflow-hidden rounded-[18px] border border-zinc-800 bg-zinc-900/30">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-800 text-zinc-300"><UserRound size={17}/></span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-xs font-bold text-zinc-100">Conta conectada</strong><small className="block truncate text-[10px] text-zinc-500">{user?.displayName?.trim() || 'Usuário DFL'}</small></span>
          <ChevronDown size={16} className="text-zinc-500 transition-transform group-open:rotate-180"/>
        </summary>
        <div className="break-all border-t border-zinc-800 px-4 py-3 text-[11px] leading-relaxed text-zinc-400">{user?.email || 'Conta operacional'}<p className="mt-1 text-zinc-500">Acesso protegido pelas permissões da operação.</p></div>
      </details>
      <button type="button" disabled={leaving} onClick={() => void handleLogout()}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[15px] border border-rose-500/15 text-xs font-bold text-rose-300 transition active:bg-rose-500/5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"><LogOut size={16}/>{leaving ? 'Encerrando sessão…' : 'Sair da conta'}</button>
    </section>
    <p className="px-3 text-center text-[10px] leading-relaxed text-zinc-600"><WalletCards size={12} className="mr-1 inline-block align-[-2px]"/>O dia a dia continua no Início e na Loja. Aqui ficam os ajustes.</p>
  </main>;
}
