// components/store/OperationalIntelligencePanel.tsx
'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  Info,
} from 'lucide-react';
import { useDeliveryIntelligence } from '@/hooks/useDeliveryIntelligence';
import type {
  InsightConfidence,
  InsightSeverity,
  OperationalInsight,
} from '@/lib/delivery-intelligence';

const severityMeta: Record<
  InsightSeverity,
  {
    label: string;
    badge: string;
    border: string;
    surface: string;
    icon: typeof Info;
  }
> = {
  warning: {
    label: 'Alerta',
    badge: 'border-red-500/25 bg-red-500/10 text-red-400',
    border: 'border-red-500/20',
    surface: 'bg-red-500/[.045]',
    icon: AlertTriangle,
  },
  attention: {
    label: 'Atenção',
    badge: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
    border: 'border-amber-500/20',
    surface: 'bg-amber-500/[.04]',
    icon: AlertTriangle,
  },
  positive: {
    label: 'Sinal positivo',
    badge: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
    border: 'border-emerald-500/20',
    surface: 'bg-emerald-500/[.04]',
    icon: CheckCircle2,
  },
  info: {
    label: 'Leitura',
    badge: 'border-sky-500/25 bg-sky-500/10 text-sky-400',
    border: 'border-sky-500/20',
    surface: 'bg-sky-500/[.04]',
    icon: Info,
  },
};

const confidenceLabel: Record<InsightConfidence, string> = {
  low: 'Confiança inicial',
  medium: 'Confiança média',
  high: 'Confiança alta',
};

function InsightCard({
  insight,
  expanded,
  onToggle,
}: {
  insight: OperationalInsight;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = severityMeta[insight.severity];
  const Icon = meta.icon;

  return (
    <article className={`overflow-hidden rounded-[22px] border ${meta.border} ${meta.surface}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 text-left active:bg-white/[.015]"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border ${meta.badge}`}>
            <Icon size={16} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] ${meta.badge}`}>
                {meta.label}
              </span>
              <span className="text-[9px] font-bold text-zinc-600">
                {confidenceLabel[insight.confidence]}
              </span>
            </div>

            <h3 className="mt-2 font-heading text-sm font-black leading-snug text-zinc-100">
              {insight.title}
            </h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
              {insight.summary}
            </p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[9px] font-bold text-zinc-600">
                Amostra: {insight.sampleSize}
              </span>
              <span className="flex items-center gap-1 text-[9px] font-black text-zinc-500">
                {expanded ? 'Ocultar evidências' : 'Ver evidências'}
                <ChevronDown
                  size={12}
                  className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </span>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[.055] px-4 pb-4 pt-3">
          <p className="text-[10px] leading-relaxed text-zinc-500">
            {insight.explanation}
          </p>

          {insight.evidence.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {insight.evidence.map((item) => (
                <div
                  key={`${insight.id}-${item.label}`}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-950/45 px-3 py-2.5"
                >
                  <p className="text-[8px] font-black uppercase tracking-wide text-zinc-600">
                    {item.label}
                  </p>
                  <p className="mt-1 text-[10px] font-black leading-snug text-zinc-300">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function OperationalIntelligencePanel() {
  const intelligence = useDeliveryIntelligence({
    lookbackDays: 30,
    minimumSample: 3,
    highlightLimit: 3,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasSignals = intelligence.highlights.length > 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-400">
            Inteligência operacional
          </p>
          <h2 className="font-heading text-base font-black text-zinc-100">
            Leitura dos últimos 30 dias
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              intelligence.summary.warning > 0
                ? 'bg-red-400'
                : intelligence.summary.attention > 0
                  ? 'bg-amber-400'
                  : hasSignals
                    ? 'bg-emerald-400'
                    : 'bg-zinc-600'
            }`}
          />
          <span className="text-[9px] font-black text-zinc-500">
            {intelligence.summary.total} sinal
            {intelligence.summary.total === 1 ? '' : 'is'}
          </span>
        </div>
      </div>

      {hasSignals ? (
        <div className="flex flex-col gap-2.5">
          {intelligence.highlights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              expanded={expandedId === insight.id}
              onToggle={() =>
                setExpandedId((current) =>
                  current === insight.id ? null : insight.id,
                )
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-500">
              <Database size={17} />
            </div>
            <div>
              <p className="text-sm font-black text-zinc-300">
                Ainda sem leitura suficiente
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
                O cérebro espera uma amostra mínima antes de destacar padrões.
                Ele não fabrica conclusões quando os dados ainda são poucos.
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="px-1 text-[9px] leading-relaxed text-zinc-700">
        Sinais são contextuais e explicáveis. Eles ajudam a investigar a
        operação, não substituem julgamento humano nem atribuem culpa.
      </p>
    </section>
  );
}
