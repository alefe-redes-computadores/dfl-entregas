'use client';

import { ChevronRight, Sparkles, X } from 'lucide-react';
import { useHiddenInsightsToday } from '@/hooks/useHiddenInsightsToday';
import type { ContextualSignal } from '@/lib/operation/contextual-signals';
import { chooseContextualSignal } from '@/lib/operation/assistant-signal-priority';

/** Um único sinal por tela. Sem I/O, animação pesada, ou ações de escrita. */
export function ContextualAssistantCard({
  scope,
  signals,
  onAction,
}: {
  scope: string;
  signals: readonly ContextualSignal[];
  onAction: (target: string) => void;
}) {
  const { hiddenIds, hideForToday } = useHiddenInsightsToday();
  const visibleSignal = signals.find(item => !hiddenIds.has(item.id));
  const signal = visibleSignal ? chooseContextualSignal(signals, hiddenIds) : null;
  if (!signal) return null;
  const accent = signal.tone === 'amber'
    ? 'border-amber-500/20 bg-amber-500/[.055] text-amber-300'
    : signal.tone === 'sky'
      ? 'border-sky-500/20 bg-sky-500/[.055] text-sky-300'
      : 'border-emerald-500/20 bg-emerald-500/[.055] text-emerald-300';
  return (
    <section aria-label={`DFL Assistente contextual — ${scope}`} className={`dfl-assistant-contextual rounded-[20px] border p-3 ${accent}`}>
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-zinc-700/30 bg-zinc-950/35"><Sparkles size={16} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[.12em] opacity-80">DFL · Contexto de {scope} · dados locais</p>
          <h2 className="mt-1 text-xs font-bold text-zinc-100">{signal.title}</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">{signal.message}</p>
          <button type="button" onClick={() => onAction(signal.target)} className="mt-2 flex min-h-9 items-center gap-1 text-left text-[11px] font-black underline-offset-2 hover:underline" aria-label={signal.action}>
            {signal.action}<ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
        <button type="button" aria-label="Dispensar este insight por hoje" title="Dispensar por hoje" onClick={() => hideForToday(signal.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:text-zinc-200"><X size={15} aria-hidden="true" /></button>
      </div>
    </section>
  );
}
