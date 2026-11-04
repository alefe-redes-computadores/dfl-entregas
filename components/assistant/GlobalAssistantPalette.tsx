'use client';

import { type FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bike, Boxes, CheckCircle2, ChevronRight, Clock3, Inbox, PackageSearch, Search, ShieldCheck, Sparkles, Star, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { saoPauloDateKey } from '@/lib/reports/time';
import { assistantDestinations } from '@/lib/operation/assistant-intent';
import { assistantSessionExamples, parseAssistantTimeIntent, resolveAssistantEnter, searchAssistantSnapshotPremium } from '@/lib/operation/assistant-search-premium';
import { ASSISTANT_SHORTCUTS, assistantShortcutByCommand, assistantShortcutById, type AssistantShortcutId } from '@/lib/operation/assistant-shortcuts';
import { useAssistantShortcuts } from '@/hooks/useAssistantShortcuts';

/** R237: Busca 360 global; só monta assinaturas ao abrir. Não grava nem consulta remotamente. */
export function GlobalAssistantPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [noResults, setNoResults] = useState(false);
  const [kindFilter, setKindFilter] = useState<'all'|'delivery'|'customer'|'route'|'stock'|'motoboy'>('all');
  const [sessionSeed, setSessionSeed] = useState(0);
  useEffect(() => { setSessionSeed(Math.floor(Math.random() * 100000)); }, []);
  const deferred = useDeferredValue(query.trim());
  const deliveries = useAppStore(state => state.deliveries);
  const customers = useAppStore(state => state.customers);
  const routes = useAppStore(state => state.routes);
  const products = useAppStore(state => state.stockProducts);
  const motoboys = useAppStore(state => state.motoboys);
  const privacy = useAppStore(state => state.isPrivacyMode);
  const selectedDate = useAppStore(state => state.selectedDate);
  const { shortcuts, toggleFavorite, remember } = useAssistantShortcuts();
  const day = saoPauloDateKey(selectedDate);
  const timeIntent = useMemo(() => parseAssistantTimeIntent(deferred), [deferred]);
  const suggestions = useMemo(() => timeIntent ? [] : assistantDestinations(deferred, day), [deferred, day, timeIntent]);
  const matches = useMemo(() => privacy ? [] : searchAssistantSnapshotPremium(deferred, { deliveries, customers, routes, products, motoboys }, 24), [deferred, deliveries, customers, routes, products, motoboys, privacy]);
  const found = useMemo(() => (kindFilter === 'all' ? matches : matches.filter(item => item.kind === kindFilter)).slice(0, 12), [matches, kindFilter]);
  const sessionExamples = useMemo(() => assistantSessionExamples(sessionSeed), [sessionSeed]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const navigate = (href: string, knownId?: AssistantShortcutId) => {
    if (!href.startsWith('/') || href.startsWith('//')) return;
    if (knownId) remember(knownId);
    else {
      const known = assistantShortcutByCommand(query.trim());
      if (known) remember(known.id);
    }
    onClose();
    router.push(href);
  };
  const runShortcut = (id: AssistantShortcutId) => {
    const item = assistantShortcutById(id);
    if (!item) return;
    const destination = assistantDestinations(item.command, day)[0];
    if (destination) navigate(destination.href, id);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const typed = query.trim();
    if (!typed) return;
    // Cálculo síncrono com o texto atual: nunca navegar para resultado antigo do useDeferredValue.
    const destination = parseAssistantTimeIntent(typed) ? undefined : assistantDestinations(typed, day)[0];
    const ranked = privacy ? [] : searchAssistantSnapshotPremium(typed, { deliveries, customers, routes, products, motoboys }, 24).filter(item => kindFilter === 'all' || item.kind === kindFilter);
    const decision = resolveAssistantEnter(typed, ranked, destination?.href);
    if (decision.state === 'choose') return; // Nomes iguais: escolher cartão individual.
    if (decision.href) navigate(decision.href);
    else setNoResults(true);
  };

  return (
    <div className="fixed inset-0 z-[170] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/75 px-3 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="DFL Busca 360 global" className="dfl-r237-command-sheet dfl-assistant-premium relative my-auto w-full max-w-xl overflow-hidden rounded-[26px] border border-amber-500/25 bg-zinc-950 p-3.5 text-zinc-100 shadow-[0_30px_90px_rgba(0,0,0,.75)] sm:p-4" onMouseDown={event => event.stopPropagation()}>
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300"><Sparkles size={19} /></span>
          <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.16em] text-amber-300/85">DFL · Assistente operacional</p><h2 className="text-base font-black">Busca 360 em qualquer tela</h2></div>
          <button type="button" aria-label="Fechar busca" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 active:bg-zinc-800"><X size={18} /></button>
        </div>
        <form role="search" onSubmit={submit} className="relative z-10 mt-3 flex min-h-12 items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/90 px-3 focus-within:border-amber-400/60">
          <Search size={18} className="shrink-0 text-amber-300" />
          <input ref={inputRef} type="search" value={query} onChange={event => { setQuery(event.target.value.slice(0, 110)); setKindFilter('all'); setNoResults(false); }} maxLength={110} placeholder="Pedido, cliente, rota, estoque..." aria-label="Digite sua busca ou um comando" className="h-12 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500" />
          {query && <button type="button" onClick={() => { setQuery(''); setNoResults(false); inputRef.current?.focus(); }} aria-label="Limpar busca" className="grid h-9 w-9 place-items-center text-zinc-500"><X size={16}/></button>}
          <button type="submit" disabled={!query.trim()} aria-label="Executar busca" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400 text-zinc-950 disabled:opacity-40"><ArrowRight size={17}/></button>
        </form>
        <div className="relative z-10 mt-3 max-h-[min(52dvh,420px)] space-y-2 overflow-y-auto overscroll-contain pr-0.5 sm:max-h-[min(60dvh,520px)]">
          {!query.trim() ? <>
            {shortcuts.favorites.length > 0 && <div aria-label="Comandos favoritos"><p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-300"><Star size={12}/>Favoritos</p><div className="flex flex-wrap gap-1.5">{shortcuts.favorites.map(id => { const item = assistantShortcutById(id); return item ? <button type="button" key={id} onClick={() => runShortcut(id)} className="min-h-10 rounded-xl border border-amber-500/25 bg-amber-500/[.07] px-3 text-xs font-semibold text-amber-100">{item.title}</button> : null; })}</div></div>}
            {shortcuts.recent.length > 0 && <div aria-label="Comandos recentes"><p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold text-zinc-400"><Clock3 size={12}/>Recentes</p><div className="flex flex-wrap gap-1.5">{shortcuts.recent.slice(0, 4).map(id => { const item = assistantShortcutById(id); return item ? <button type="button" key={id} onClick={() => runShortcut(id)} className="min-h-10 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 text-xs text-zinc-300">{item.title}</button> : null; })}</div></div>}
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Experimente nesta sessão</p>
            <div className="flex flex-wrap gap-1.5" aria-label="Exemplos variados de busca">{sessionExamples.map(example => <button key={example} type="button" onClick={() => { setQuery(example); setKindFilter('all'); setNoResults(false); inputRef.current?.focus(); }} className="min-h-9 rounded-xl border border-zinc-800 bg-zinc-900/75 px-2.5 text-[10px] font-semibold text-zinc-300 active:border-amber-500/40">{example}</button>)}</div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Ações rápidas</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{ASSISTANT_SHORTCUTS.map(item => {
              const Icon = item.category === 'rotas' ? Bike : item.category === 'estoque' ? Boxes : item.category === 'caixa' ? Inbox : item.category === 'compras' ? CheckCircle2 : PackageSearch;
              const favorite = shortcuts.favorites.includes(item.id);
              return <div key={item.id} className="flex min-w-0 items-center rounded-xl border border-zinc-800 bg-zinc-900/65"><button type="button" onClick={() => runShortcut(item.id)} className="flex min-h-12 min-w-0 flex-1 items-center gap-1.5 pl-2.5 text-left text-[11px] font-semibold text-zinc-200"><Icon size={14} className="shrink-0 text-emerald-400"/><span className="truncate">{item.title}</span></button><button type="button" aria-label={`${favorite ? 'Desfavoritar' : 'Favoritar'} ${item.title}`} aria-pressed={favorite} onClick={() => toggleFavorite(item.id)} className="grid h-11 w-8 shrink-0 place-items-center border-l border-zinc-800 text-amber-300"><Star size={13} fill={favorite ? 'currentColor' : 'none'}/></button></div>;
            })}</div>
          </> : <div aria-live="polite" className="space-y-1.5">
            {timeIntent && <p className="rounded-lg border border-amber-500/15 bg-amber-500/[.05] px-2.5 py-2 text-[10px] text-amber-200">{timeIntent.around ? 'Por volta de ' : 'Horário exato: '}{String(timeIntent.hour).padStart(2,'0')}:{String(timeIntent.minute).padStart(2,'0')} · somente pedidos com horário registrado em São Paulo</p>}
            <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Filtrar resultados locais">{([['all','Todos'],['delivery','Pedidos'],['customer','Clientes'],['route','Rotas'],['stock','Estoque'],['motoboy','Motoboys']] as const).map(([key,label]) => <button type="button" key={key} aria-pressed={kindFilter===key} onClick={() => setKindFilter(key)} className={`min-h-9 shrink-0 rounded-xl border px-2.5 text-[10px] font-bold ${kindFilter===key?'border-amber-500/40 bg-amber-500/10 text-amber-200':'border-zinc-800 bg-zinc-900/60 text-zinc-400'}`}>{label}</button>)}</div>
            {suggestions.map(item => <button key={`d:${item.id}`} type="button" onClick={() => navigate(item.href)} className="flex min-h-12 w-full items-center gap-2.5 rounded-xl border border-amber-500/15 bg-amber-500/[.04] p-2.5 text-left active:bg-amber-500/10"><Sparkles size={16} className="shrink-0 text-amber-300"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{item.title}</span><span className="block truncate text-[10px] text-zinc-400">{item.subtitle}</span></span><ChevronRight size={15} className="text-zinc-500"/></button>)}
            {found.map(item => <button key={`r:${item.id}`} type="button" onClick={() => navigate(item.href)} className="flex min-h-12 w-full items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/65 p-2.5 text-left active:bg-zinc-800"><Search size={15} className="shrink-0 text-emerald-400"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{item.title}<span className="ml-2 text-[9px] font-black uppercase tracking-wide text-emerald-400/80">{item.kind === 'delivery' ? 'Pedido' : item.kind === 'customer' ? 'Cliente' : item.kind === 'route' ? 'Rota' : item.kind === 'motoboy' ? 'Motoboy' : 'Estoque'}</span></span><span className="block truncate text-[10px] text-zinc-400">{item.detail}</span></span><ChevronRight size={15} className="text-zinc-500"/></button>)}
            {!suggestions.length && !found.length && (noResults || deferred.length >= 2) && <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-xs text-zinc-400">Nenhuma correspondência nos dados disponíveis neste aparelho. Experimente nome, código ou um dos comandos sugeridos.</div>}
            {privacy && <p className="text-[10px] text-zinc-400">Privacidade ativa: resultados com dados de pessoas estão ocultos.</p>}
          </div>}
        </div>
        <div className="relative z-10 mt-3 flex items-center gap-1.5 border-t border-zinc-800/80 pt-3 text-[10px] text-zinc-500"><ShieldCheck size={13} className="shrink-0 text-emerald-400"/><span className="min-w-0 flex-1">Local e offline. Nunca altera pedidos, pagamentos, rotas ou estoque.</span></div>
      </section>
    </div>
  );
}
