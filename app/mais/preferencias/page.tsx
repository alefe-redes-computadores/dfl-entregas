'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, BellRing, Bike, CheckCircle2, ChevronRight,
  Clock3, MapPin, Search, ShieldCheck, SlidersHorizontal, Store,
  CalendarDays, Settings2, type LucideIcon,
} from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { configuredMarketplaceMode, mergeMarketplacePreference } from '@/lib/operation/marketplace-modes';

type Tone = 'emerald' | 'amber' | 'sky' | 'violet';
const tone: Record<Tone, string> = {
  emerald: 'border-emerald-500/25 bg-emerald-500/[.075] text-emerald-300',
  amber: 'border-amber-500/25 bg-amber-500/[.07] text-amber-200',
  sky: 'border-sky-500/25 bg-sky-500/[.07] text-sky-300',
  violet: 'border-violet-500/25 bg-violet-500/[.07] text-violet-300',
};
function Heading({ icon: Icon, title, subtitle, tint = 'emerald' }: {
  icon: LucideIcon; title: string; subtitle: string; tint?: Tone;
}) {
  return <div className="flex items-start gap-3">
    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border ${tone[tint]}`}><Icon size={19}/></div>
    <div className="min-w-0"><h2 className="text-[13px] font-black text-zinc-100">{title}</h2><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{subtitle}</p></div>
  </div>;
}
function Choice({ selected, onClick, disabled, children, tint = 'emerald' }: {
  selected: boolean; onClick: () => void; disabled: boolean; children: ReactNode; tint?: Tone;
}) {
  return <button type="button" aria-pressed={selected} onClick={onClick} disabled={disabled || selected}
    className={`flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-[13px] border px-2 text-[11px] font-black transition active:scale-[.985] disabled:cursor-default ${selected ? tone[tint] : 'border-zinc-700/75 bg-zinc-950/35 text-zinc-400 active:bg-zinc-800/60'} ${disabled && !selected ? 'opacity-45' : ''}`}>
    {selected && <CheckCircle2 size={13} className="shrink-0" />}{children}
  </button>;
}
function Destination({ title, subtitle, icon: Icon, onClick, value }: {
  title: string; subtitle: string; icon: LucideIcon; onClick: () => void; value?: string;
}) {
  return <button type="button" onClick={onClick} className="flex min-h-[66px] w-full items-center gap-3 border-b border-zinc-800/60 px-3 py-2.5 text-left last:border-b-0 active:bg-white/[.035]">
    <Icon size={18} className="shrink-0 text-emerald-300"/>
    <span className="min-w-0 flex-1"><strong className="block text-[12px] font-black text-zinc-100">{title}</strong><small className="mt-0.5 block text-[10px] leading-snug text-zinc-400">{subtitle}</small></span>
    {value && <span className="max-w-[35%] truncate text-[10px] font-bold text-amber-200">{value}</span>}
    <ChevronRight size={15} className="shrink-0 text-zinc-500"/>
  </button>;
}
export default function Preferencias360() {
  const router = useRouter();
  const settings = useAppStore(s => s.storeSettings);
  const updateSettings = useAppStore(s => s.updateStoreSettings);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const saveBusyRef = useRef(false);
  const mode = settings.routeOrderingMode === 'smart' ? 'smart' : 'manual';
  const prep = ([15, 30, 60] as const).find(v => v === settings.sitePreparationLeadMinutes) ?? 30;
  const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = normalize(search.trim());
  const show = (labels: string) => !q || normalize(labels).includes(q);

  async function save(patch: Parameters<typeof updateSettings>[0]) {
    if (saveBusyRef.current) return;
    saveBusyRef.current = true;
    setBusy(true);
    try {
      await updateSettings(patch);
      toast.success('Preferência salva na operação.');
    } catch {
      toast.error('Não foi possível salvar. A configuração anterior foi preservada.');
    } finally {
      saveBusyRef.current = false;
      setBusy(false);
    }
  }
  const platforms = useMemo(() => ([
    { source: 'ifood' as const, label: 'iFood', tint: 'text-red-300' },
    { source: 'food99' as const, label: '99Food', tint: 'text-amber-300' },
    { source: 'keeta' as const, label: 'Keeta', tint: 'text-violet-300' },
  ]), []);

  return <main className="dfl-page mx-auto max-w-3xl space-y-4 pb-[calc(env(safe-area-inset-bottom)+110px)] animate-in fade-in duration-300">
    <header className="flex items-center gap-3 px-1 pt-1">
      <button type="button" onClick={() => router.push('/mais')} aria-label="Voltar para Mais" className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] border border-zinc-800 bg-zinc-900/60 text-zinc-200 active:bg-zinc-800"><ArrowLeft size={18}/></button>
      <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-300">Seu jeito de operar</p><h1 className="mt-0.5 font-heading text-[21px] font-black text-zinc-50">Preferências 360</h1><p className="mt-0.5 text-[11px] text-zinc-400">Ajustes claros. Uma escolha de cada vez.</p></div>
    </header>

    <section className="rounded-[21px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[.085] via-zinc-900/40 to-zinc-950 p-3.5">
      <div className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-emerald-300"/><p className="text-[12px] font-black text-zinc-100">Resumo da operação</p></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <span className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-2.5 text-zinc-300">Ordem <strong className="mt-0.5 block text-emerald-300">{mode === 'smart' ? 'Inteligente' : 'Manual'}</strong></span>
        <span className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-2.5 text-zinc-300">Preparo Site <strong className="mt-0.5 block text-sky-300">{prep} min antes</strong></span>
        <span className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-2.5 text-zinc-300">Rotas <strong className="mt-0.5 block text-emerald-300">{settings.routeReminderEnabled === false ? 'Lembretes pausados' : 'Lembretes ativos'}</strong></span>
        <span className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-2.5 text-zinc-300">Fechamento <strong className="mt-0.5 block text-amber-200">{settings.autoCloseCompletedRoutes === false ? 'Manual' : 'Automático'}</strong></span>
      </div>
    </section>

    <label className="flex min-h-12 items-center gap-2.5 rounded-[15px] border border-zinc-800 bg-zinc-900/45 px-3.5 focus-within:border-emerald-400/40">
      <Search size={17} className="shrink-0 text-zinc-500"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Encontrar configuração" aria-label="Buscar preferências" className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-500"/>
      {search && <button type="button" onClick={() => setSearch('')} className="text-[11px] text-zinc-400">Limpar</button>}
    </label>

    {show('rotas ordem entregas inteligente manual fechamento lembretes') && <section aria-label="Preferências de rotas" className="space-y-4 rounded-[21px] border border-zinc-800 bg-zinc-900/35 p-3.5">
      <Heading icon={Bike} title="Rotas e entregas" subtitle="Define novos pedidos; não reorganiza rotas nem decisões manuais existentes." />
      <div className="space-y-2">
        <p className="text-[11px] font-bold text-zinc-200">Ordem de novas entregas</p>
        <div className="flex gap-2" role="group" aria-label="Modo de ordenação das entregas">
          <Choice selected={mode === 'manual'} disabled={busy} onClick={() => void save({routeOrderingMode: 'manual'})}>Manual</Choice>
          <Choice selected={mode === 'smart'} disabled={busy} onClick={() => void save({routeOrderingMode: 'smart'})}>Inteligente</Choice>
        </div>
        <p className="text-[10px] leading-relaxed text-zinc-500">Inteligente sugere posição quando há localização suficiente. A sequência movimentada manualmente sempre tem prioridade.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[370px]:grid-cols-2">
        <button type="button" role="switch" aria-checked={settings.routeReminderEnabled !== false} disabled={busy} onClick={() => void save({routeReminderEnabled: settings.routeReminderEnabled === false})}
          className="flex min-h-[60px] items-center justify-between gap-2 rounded-[14px] border border-zinc-700/70 bg-zinc-950/35 px-3 text-left disabled:opacity-60"><span className="text-[11px] font-bold text-zinc-200">Lembretes de rota</span><span className={`text-[10px] font-black ${settings.routeReminderEnabled === false ? 'text-zinc-500' : 'text-emerald-300'}`}>{settings.routeReminderEnabled === false ? 'Pausados' : 'Ativos'}</span></button>
        <button type="button" role="switch" aria-checked={settings.autoCloseCompletedRoutes !== false} disabled={busy} onClick={() => void save({autoCloseCompletedRoutes: settings.autoCloseCompletedRoutes === false})}
          className="flex min-h-[60px] items-center justify-between gap-2 rounded-[14px] border border-zinc-700/70 bg-zinc-950/35 px-3 text-left disabled:opacity-60"><span className="text-[11px] font-bold text-zinc-200">Fechar rotas concluídas</span><span className={`text-[10px] font-black ${settings.autoCloseCompletedRoutes === false ? 'text-zinc-500' : 'text-emerald-300'}`}>{settings.autoCloseCompletedRoutes === false ? 'Manual' : 'Auto'}</span></button>
      </div>
    </section>}

    {show('site agendados preparo preparação antecedência caixa') && <section aria-label="Preparação agendada do Site" className="space-y-3 rounded-[21px] border border-sky-500/20 bg-sky-500/[.045] p-3.5">
      <Heading icon={Clock3} title="Pedidos agendados do Site" subtitle="Lembrete visual na Caixa antes do preparo. Não envia WhatsApp, não dispara push e não antecipa despacho." tint="sky"/>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Antecedência do lembrete de preparo">
        {([15, 30, 60] as const).map(v => <Choice key={v} tint="sky" selected={prep === v} disabled={busy} onClick={() => void save({sitePreparationLeadMinutes: v})}>{v} min</Choice>)}
      </div>
      <button type="button" onClick={() => router.push('/loja/caixa-de-entrada?aba=site')} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-sky-500/15 px-3 text-[11px] font-bold text-sky-300">Abrir pedidos do Site <ChevronRight size={16}/></button>
    </section>}

    {show('ifood 99food keeta marketplaces parceiros plataforma modalidade entrega') && <section aria-label="Modalidades das plataformas" className="space-y-3 rounded-[21px] border border-zinc-800 bg-zinc-900/35 p-3.5">
      <Heading icon={Store} title="Plataformas parceiras" subtitle="Escolha quem entrega cada pedido novo. Histórico, pagamentos e acertos não mudam." tint="amber"/>
      {platforms.map(row => { const current = configuredMarketplaceMode(settings.marketplaceDeliveryModes, row.source); return <div key={row.source} className="space-y-2 rounded-[15px] border border-zinc-800/80 bg-zinc-950/35 p-3">
        <div className="flex items-center justify-between gap-2"><strong className={`text-[12px] ${row.tint}`}>{row.label}</strong><span className="text-[10px] text-zinc-500">{current === 'platform' ? 'Sem rota DFL' : 'Com rota DFL'}</span></div>
        <div className="flex gap-2" role="group" aria-label={`Modo padrão ${row.label}`}>
          <Choice tint="amber" selected={current === 'dfl'} disabled={busy} onClick={() => void save({marketplaceDeliveryModes: mergeMarketplacePreference(settings.marketplaceDeliveryModes, row.source, 'dfl')})}>DFL entrega</Choice>
          <Choice tint="amber" selected={current === 'platform'} disabled={busy} onClick={() => void save({marketplaceDeliveryModes: mergeMarketplacePreference(settings.marketplaceDeliveryModes, row.source, 'platform')})}>Entrega da plataforma</Choice>
        </div>
        <p className="text-[10px] leading-snug text-zinc-500">{current === 'platform' ? 'A plataforma envia o próprio entregador. Não entra nas rotas da DFL.' : 'A equipe da DFL faz a entrega. O pedido pode entrar nas nossas rotas.'}</p>
      </div>; })}
    </section>}

    {show('expediente horarios abertura manual pausas feriados origem endereço navegação localização') && <section aria-label="Horários, abertura e localização" className="space-y-2.5 rounded-[21px] border border-zinc-800 bg-zinc-900/35 p-3.5">
      <Heading icon={CalendarDays} title="Expediente e localização" subtitle="Abertura manual e horários permanecem sob controle da Loja." tint="violet"/>
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/35">
        <Destination icon={CalendarDays} title="Horários e expediente" subtitle="Dias, turnos, pausas e feriados" onClick={() => router.push('/loja#dfl-loja-expediente')}/>
        <Destination icon={MapPin} title="Origem das rotas" subtitle="Endereço, ponto de partida e navegação" value={settings.storeAddress || 'Conferir origem'} onClick={() => router.push('/loja#dfl-loja-configuracoes')}/>
        <Destination icon={Store} title="Abrir ou fechar a Loja" subtitle="Ação manual com confirmação e regras atuais" onClick={() => router.push('/loja#dfl-loja-abertura')}/>
      </div>
    </section>}

    {show('notificações alertas categorias android horário sistema atualizações') && <section aria-label="Notificações e sistema" className="overflow-hidden rounded-[21px] border border-zinc-800 bg-zinc-900/35">
      <div className="p-3.5"><Heading icon={BellRing} title="Avisos e sistema" subtitle="Notificações do Android são separadas das mensagens para clientes." /></div>
      <Destination icon={BellRing} title="Central de Notificações" subtitle="Categorias, prioridade, frequência e privacidade" onClick={() => router.push('/mais/notificacoes')}/>
      <Destination icon={Settings2} title="Central de Atualizações" subtitle="APK, versões e instalação segura" onClick={() => router.push('/mais/atualizacoes')}/>
    </section>}
    {!['rotas ordem entregas inteligente manual fechamento lembretes','site agendados preparo preparação antecedência caixa','ifood 99food keeta marketplaces parceiros plataforma modalidade entrega','expediente horarios abertura manual pausas feriados origem endereço navegação localização','notificações alertas categorias android horário sistema atualizações'].some(show) && <p className="rounded-2xl border border-zinc-800 p-4 text-center text-[12px] text-zinc-400">Nenhuma configuração encontrada.</p>}
    {busy && <p role="status" className="text-center text-[11px] font-bold text-sky-300">Salvando configuração…</p>}
    <p className="flex items-start gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[.035] p-3 text-[10px] leading-relaxed text-zinc-400"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-300"/>As escolhas rápidas são gravadas individualmente no mesmo registro da operação. Não alteram entregas passadas nem ativam mensagens externas.</p>
  </main>;
}
