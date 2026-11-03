'use client';

import { type FormEvent, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bike, Boxes, ChevronRight, Clock3, Inbox, PackageSearch, Search, Sparkles, Star, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useHiddenInsightsToday } from '@/hooks/useHiddenInsightsToday';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';
import { assistantDestinations, searchAssistantSnapshot } from '@/lib/operation/assistant-intent';
import type { Delivery } from '@/types';
import { useAssistantShortcuts } from '@/hooks/useAssistantShortcuts';
import { assistantShortcutByCommand, assistantShortcutById, type AssistantShortcutId } from '@/lib/operation/assistant-shortcuts';

const examples = [
  { id: 'routes-building' as const, text: 'Rotas em montagem', icon: Bike },
  { id: 'stock-low' as const, text: 'Produtos abaixo do mínimo', icon: Boxes },
  { id: 'deliveries-pending' as const, text: 'Entregas pendentes', icon: PackageSearch },
];

export function OperationalAssistant({ dayDeliveries, dateKey }: { dayDeliveries: readonly Delivery[]; dateKey: string }) {
  const router = useRouter();
  const deliveries = useAppStore(s => s.deliveries);
  const customers = useAppStore(s => s.customers);
  const routes = useAppStore(s => s.routes);
  const products = useAppStore(s => s.stockProducts);
  const privacy = useAppStore(s => s.isPrivacyMode);
  const { hiddenIds, hideForToday } = useHiddenInsightsToday();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const { shortcuts, toggleFavorite, remember } = useAssistantShortcuts();
  const [typedHint, setTypedHint] = useState('Pedido, motoboy, bacon, rota...');
  // O texto só é animado enquanto o campo está vazio, visível e sem foco.
  useEffect(() => {
    if (focused || value || typeof window === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) { setTypedHint('Pedido, motoboy, bacon, rota...'); return; }
    const hints = ['Buscar um pedido...', 'Mostrar rotas em montagem...', 'Encontrar bacon no estoque...', 'Ver compras pendentes...'];
    let current = 0;
    let length = 0;
    let hold = 0;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (hold > 0) { hold -= 1; return; }
      const target = hints[current];
      if (length < target.length) length += 1;
      else { hold = 18; current = (current + 1) % hints.length; length = 0; }
      setTypedHint(target.slice(0, length));
    }, 115);
    return () => window.clearInterval(timer);
  }, [focused, value]);
  const deferred = useDeferredValue(value.trim());
  const suggestions = useMemo(() => assistantDestinations(deferred, dateKey), [deferred, dateKey]);
  const found = useMemo(() => privacy ? [] : searchAssistantSnapshot(deferred, { deliveries, customers, routes, products }), [deferred, deliveries, customers, routes, products, privacy]);

  const unrouted = useMemo(() => dayDeliveries.reduce((total, item) => total + Number(
    !item.completed && !item.route_id && !item.operational_dismissed_at && !item.scheduled_for &&
    isDeliveryFulfillment(item) && !isCancelledSiteDelivery(item)
  ), 0), [dayDeliveries]);
  const belowMinimum = useMemo(() => products.reduce((total, p) => total + Number(p.active && Number.isFinite(p.minimum_quantity) && p.minimum_quantity > 0 && p.current_quantity < p.minimum_quantity), 0), [products]);
  const insight = unrouted > 0
    ? { id: `assistant:unrouted:${dateKey}`, text: `${unrouted} entrega${unrouted === 1 ? '' : 's'} sem rota neste período.`, action: 'Abrir pendências', href: `/entregas?date=${encodeURIComponent(dateKey)}&status=incompletas` }
    : belowMinimum > 0
      ? { id: 'assistant:stock-low', text: `${belowMinimum} produto${belowMinimum === 1 ? '' : 's'} abaixo do mínimo cadastrado.`, action: 'Conferir estoque', href: '/estoque?filter=baixo' }
      : null;

  const goTo = (href: string) => {
    const safe = assistantShortcutByCommand(value.trim());
    if (safe) remember(safe.id);
    router.push(href);
  };
  const runShortcut = (id: AssistantShortcutId) => {
    const safe = assistantShortcutById(id);
    if (!safe) return;
    const destination = assistantDestinations(safe.command, dateKey)[0];
    if (!destination) return;
    remember(id);
    router.push(destination.href);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (suggestions[0]) goTo(suggestions[0].href);
    else if (found[0]) goTo(found[0].href);
    else if (deferred) goTo(`/entregas?date=${encodeURIComponent(dateKey)}&q=${encodeURIComponent(deferred)}`);
  };

  return (
    <section aria-label="DFL Assistente Operacional" className="dfl-assistant-premium overflow-hidden rounded-[24px] border border-amber-500/20 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-3.5 shadow-[0_10px_35px_rgba(0,0,0,0.16)]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300"><Sparkles size={17} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.15em] text-amber-300/80">DFL · Busca 360</p><h2 className="text-sm font-bold text-zinc-100">Assistente operacional</h2></div>
        <span className="rounded-lg border border-emerald-500/20 px-2 py-1 text-[9px] font-bold text-emerald-400">Local · offline</span>
      </div>

      <form onSubmit={submit} role="search" className={`flex min-h-12 items-center gap-2 rounded-2xl border bg-zinc-950/80 px-3 transition-colors ${focused ? 'border-amber-400/60 shadow-[0_0_16px_rgba(251,191,36,0.09)]' : 'border-zinc-700/70'}`}>
        <Search size={17} className="shrink-0 text-amber-300/80" aria-hidden="true" />
        <input type="search" value={value} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={e => setValue(e.target.value)} placeholder={typedHint} aria-label="Buscar pedidos rotas e produtos ou digitar um comando" maxLength={110} className="h-12 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500" />
        {value ? <button type="button" onClick={() => setValue('')} aria-label="Limpar busca" className="grid h-9 w-9 place-items-center text-zinc-400"><X size={17} /></button> : null}
        <button type="submit" disabled={!value.trim()} aria-label="Executar pesquisa" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400 text-zinc-950 disabled:opacity-40"><ArrowRight size={17} /></button>
      </form>

      {!value.trim() ? <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-1.5" aria-label="Sugestões de comandos">
          {examples.map(({id, text, icon: Icon}) => <div key={id} className="inline-flex items-center rounded-xl border border-zinc-800 bg-zinc-900/70">
            <button type="button" onClick={() => setValue(text)} className="flex min-h-10 items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-zinc-300 active:text-amber-300"><Icon size={13} />{text}</button>
            <button type="button" onClick={() => toggleFavorite(id)} aria-pressed={shortcuts.favorites.includes(id)} aria-label={`${shortcuts.favorites.includes(id) ? 'Desfavoritar' : 'Favoritar'}: ${text}`} className={`grid h-10 w-9 place-items-center border-l border-zinc-800 ${shortcuts.favorites.includes(id) ? 'text-amber-300' : 'text-zinc-600'}`}><Star size={13} fill={shortcuts.favorites.includes(id) ? 'currentColor' : 'none'} /></button>
          </div>)}
        </div>
        {shortcuts.favorites.length > 0 && <div className="flex flex-wrap items-center gap-1.5" aria-label="Comandos favoritos">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-300/80"><Star size={12} /> Favoritos</span>
          {shortcuts.favorites.map(id => { const shortcut = assistantShortcutById(id); return shortcut ? <button key={id} type="button" onClick={() => runShortcut(id)} className="min-h-9 rounded-lg border border-amber-500/20 bg-amber-500/[.06] px-2 text-[10px] font-bold text-amber-200">{shortcut.title}</button> : null; })}
        </div>}
        {shortcuts.recent.length > 0 && <div className="flex flex-wrap items-center gap-1.5" aria-label="Comandos recentes">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500"><Clock3 size={12} /> Recentes</span>
          {shortcuts.recent.map(id => { const shortcut = assistantShortcutById(id); return shortcut ? <button key={id} type="button" onClick={() => runShortcut(id)} className="min-h-9 rounded-lg border border-zinc-800 px-2 text-[10px] text-zinc-400">{shortcut.title}</button> : null; })}
        </div>}
      </div> : <div className="mt-3 space-y-1.5" aria-live="polite">
        {suggestions.map(item => <button type="button" key={item.id} onClick={() => goTo(item.href)} className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 text-left"><Inbox size={16} className="shrink-0 text-amber-300"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-zinc-100">{item.title}</span><span className="block truncate text-[10px] text-zinc-500">{item.subtitle}</span></span><ChevronRight size={15} className="text-zinc-500" /></button>)}
        {found.map(item => <button type="button" key={item.id} onClick={() => goTo(item.href)} className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-zinc-800/80 px-3 text-left"><PackageSearch size={16} className="shrink-0 text-emerald-400"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-zinc-200">{item.title}</span><span className="block truncate text-[10px] text-zinc-500">{item.detail}</span></span><ChevronRight size={15} className="text-zinc-500" /></button>)}
        {!suggestions.length && !found.length && <p className="px-1 text-[11px] text-zinc-500">Sem correspondência local. Use Enter para pesquisar na lista de entregas.</p>}
        {privacy && <p className="text-[10px] text-zinc-500">Modo privacidade: nomes e pedidos ocultos nesta busca.</p>}
      </div>}

      {insight && !hiddenIds.has(insight.id) && !value.trim() && <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[.045] p-3">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true"/>
        <div className="min-w-0 flex-1"><p className="text-[11px] leading-relaxed text-zinc-300">{insight.text}</p><button type="button" onClick={() => router.push(insight.href)} className="mt-1.5 text-[11px] font-black text-amber-300 underline-offset-2 hover:underline">{insight.action}</button></div>
        <button type="button" onClick={() => hideForToday(insight.id)} aria-label="Dispensar sugestão de hoje" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-500"><X size={15}/></button>
      </div>}
      <p className="mt-2.5 text-[9px] leading-relaxed text-zinc-600">Somente consulta e navegação. Não altera pedidos, rotas, pagamentos nem estoque.</p>
    </section>
  );
}
