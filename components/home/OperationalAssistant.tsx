'use client';

import { type FormEvent, useDeferredValue, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bike, Boxes, ChevronRight, Inbox, PackageSearch, Search, Sparkles, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useHiddenInsightsToday } from '@/hooks/useHiddenInsightsToday';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';
import { assistantDestinations, searchAssistantSnapshot } from '@/lib/operation/assistant-intent';
import type { Delivery } from '@/types';

const examples = [
  { text: 'Rotas em montagem', icon: Bike },
  { text: 'Produtos abaixo do mínimo', icon: Boxes },
  { text: 'Entregas pendentes', icon: PackageSearch },
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (suggestions[0]) router.push(suggestions[0].href);
    else if (found[0]) router.push(found[0].href);
    else if (deferred) router.push(`/entregas?date=${encodeURIComponent(dateKey)}&q=${encodeURIComponent(deferred)}`);
  };

  return (
    <section aria-label="DFL Assistente Operacional" className="overflow-hidden rounded-[24px] border border-amber-500/20 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-3.5 shadow-[0_10px_35px_rgba(0,0,0,0.16)]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300"><Sparkles size={17} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.15em] text-amber-300/80">DFL · Busca 360</p><h2 className="text-sm font-bold text-zinc-100">Assistente operacional</h2></div>
        <span className="rounded-lg border border-emerald-500/20 px-2 py-1 text-[9px] font-bold text-emerald-400">Local · offline</span>
      </div>

      <form onSubmit={submit} role="search" className={`flex min-h-12 items-center gap-2 rounded-2xl border bg-zinc-950/80 px-3 transition-colors ${focused ? 'border-amber-400/60 shadow-[0_0_16px_rgba(251,191,36,0.09)]' : 'border-zinc-700/70'}`}>
        <Search size={17} className="shrink-0 text-amber-300/80" aria-hidden="true" />
        <input type="search" value={value} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={e => setValue(e.target.value)} placeholder="Pedido, motoboy, bacon, rota..." aria-label="Buscar pedidos rotas e produtos ou digitar um comando" maxLength={110} className="h-12 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500" />
        {value ? <button type="button" onClick={() => setValue('')} aria-label="Limpar busca" className="grid h-9 w-9 place-items-center text-zinc-400"><X size={17} /></button> : null}
        <button type="submit" disabled={!value.trim()} aria-label="Executar pesquisa" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400 text-zinc-950 disabled:opacity-40"><ArrowRight size={17} /></button>
      </form>

      {!value.trim() ? <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Sugestões de comandos">
        {examples.map(({text, icon: Icon}) => <button type="button" key={text} onClick={() => setValue(text)} className="flex min-h-9 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-[10px] font-semibold text-zinc-300 active:bg-zinc-800"><Icon size={13} />{text}</button>)}
      </div> : <div className="mt-3 space-y-1.5" aria-live="polite">
        {suggestions.map(item => <button type="button" key={item.id} onClick={() => router.push(item.href)} className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 text-left"><Inbox size={16} className="shrink-0 text-amber-300"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-zinc-100">{item.title}</span><span className="block truncate text-[10px] text-zinc-500">{item.subtitle}</span></span><ChevronRight size={15} className="text-zinc-500" /></button>)}
        {found.map(item => <button type="button" key={item.id} onClick={() => router.push(item.href)} className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-zinc-800/80 px-3 text-left"><PackageSearch size={16} className="shrink-0 text-emerald-400"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-zinc-200">{item.title}</span><span className="block truncate text-[10px] text-zinc-500">{item.detail}</span></span><ChevronRight size={15} className="text-zinc-500" /></button>)}
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
