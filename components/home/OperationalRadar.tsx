// components/home/OperationalRadar.tsx
'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  EyeOff,
  Info,
  Radar,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeliveryIntelligence } from '@/hooks/useDeliveryIntelligence';
import { useHiddenInsightsToday } from '@/hooks/useHiddenInsightsToday';
import type {
  InsightSeverity,
  OperationalInsight,
} from '@/lib/delivery-intelligence';

const meta: Record<
  InsightSeverity,
  {
    label: string;
    icon: typeof Info;
    border: string;
    surface: string;
    text: string;
  }
> = {
  warning: {
    label: 'Alerta',
    icon: AlertTriangle,
    border: 'border-red-500/25',
    surface: 'bg-red-500/[.055]',
    text: 'text-red-400',
  },
  attention: {
    label: 'Atenção',
    icon: AlertTriangle,
    border: 'border-amber-500/25',
    surface: 'bg-amber-500/[.055]',
    text: 'text-amber-400',
  },
  positive: {
    label: 'Sinal positivo',
    icon: CheckCircle2,
    border: 'border-emerald-500/20',
    surface: 'bg-emerald-500/[.045]',
    text: 'text-emerald-400',
  },
  info: {
    label: 'Leitura',
    icon: Info,
    border: 'border-sky-500/20',
    surface: 'bg-sky-500/[.045]',
    text: 'text-sky-400',
  },
};

function chooseHomeSignal(insights: OperationalInsight[]): OperationalInsight | null {
  const actionable = insights.find(
    (item) => item.severity === 'warning' || item.severity === 'attention',
  );
  if (actionable) return actionable;

  return (
    insights.find((item) => item.category === 'demand') ??
    insights.find((item) => item.category === 'routes') ??
    insights.find((item) => item.severity === 'positive') ??
    insights[0] ??
    null
  );
}

export function OperationalRadar() {
  const router = useRouter();
  const intelligence = useDeliveryIntelligence({
    lookbackDays: 30,
    minimumSample: 3,
    highlightLimit: 5,
  });
  const { hiddenIds, hideForToday } = useHiddenInsightsToday();

  const visibleHighlights = intelligence.highlights.filter(
    (insight) => !hiddenIds.has(insight.id),
  );
  const signal = chooseHomeSignal(visibleHighlights);
  if (!signal) return null;

  const tone = meta[signal.severity];
  const Icon = tone.icon;

  return (
    <article
      className={`w-full rounded-[22px] border ${tone.border} ${tone.surface} p-4`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-950/45 ${tone.text}`}
        >
          <Icon size={17} />
        </div>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => router.push('/loja')}
            className="block w-full text-left active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Radar size={12} className="shrink-0 text-indigo-400" />
                <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
                  Radar operacional · {tone.label}
                </p>
              </div>
              <ChevronRight size={14} className="shrink-0 text-zinc-700" />
            </div>

            <p className="mt-2 text-sm font-black leading-snug text-zinc-100">
              {signal.title}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              {signal.summary}
            </p>
            <p className="mt-2 text-[9px] font-bold text-zinc-700">
              Base: {signal.sampleSize} · abrir leitura completa
            </p>
          </button>

          <button
            type="button"
            onClick={() => hideForToday(signal.id)}
            className="mt-3 flex h-9 items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/35 px-3 text-[9px] font-black text-zinc-600 active:scale-95"
          >
            <EyeOff size={13} />
            Ocultar por hoje
          </button>
        </div>
      </div>
    </article>
  );
}
