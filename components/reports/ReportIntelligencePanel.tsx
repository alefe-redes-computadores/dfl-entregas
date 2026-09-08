// components/reports/ReportIntelligencePanel.tsx
'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  EyeOff,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { selectOperationalHighlights } from '@/lib/delivery-intelligence';
import { useHiddenInsightsToday } from '@/hooks/useHiddenInsightsToday';
import type {
  InsightConfidence,
  InsightSeverity,
  OperationalIntelligenceSnapshot,
} from '@/lib/delivery-intelligence';

interface ReportIntelligencePanelProps {
  snapshot: OperationalIntelligenceSnapshot;
  periodLabel: string;
}

const severityMeta: Record<
  InsightSeverity,
  {
    label: string;
    icon: LucideIcon;
    border: string;
    surface: string;
    text: string;
  }
> = {
  warning: {
    label: 'Alerta',
    icon: AlertTriangle,
    border: 'border-rose-500/25',
    surface: 'bg-rose-500/[0.08]',
    text: 'text-rose-300',
  },
  attention: {
    label: 'Atenção',
    icon: CircleAlert,
    border: 'border-amber-500/25',
    surface: 'bg-amber-500/[0.08]',
    text: 'text-amber-300',
  },
  positive: {
    label: 'Positivo',
    icon: CheckCircle2,
    border: 'border-emerald-500/25',
    surface: 'bg-emerald-500/[0.08]',
    text: 'text-emerald-300',
  },
  info: {
    label: 'Leitura',
    icon: Info,
    border: 'border-sky-500/25',
    surface: 'bg-sky-500/[0.08]',
    text: 'text-sky-300',
  },
};

const confidenceLabel: Record<InsightConfidence, string> = {
  low: 'confiança baixa',
  medium: 'confiança média',
  high: 'confiança alta',
};

export function ReportIntelligencePanel({
  snapshot,
  periodLabel,
}: ReportIntelligencePanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { hiddenIds, hideForToday } = useHiddenInsightsToday();

  const highlights = useMemo(
    () =>
      selectOperationalHighlights(
        snapshot.insights.filter((insight) => !hiddenIds.has(insight.id)),
        {
          limit: 4,
          minimumSample: 3,
        },
      ),
    [hiddenIds, snapshot.insights],
  );

  return (
    <section className="overflow-hidden rounded-[28px] border border-violet-500/20 bg-gradient-to-b from-violet-500/[0.08] to-zinc-900/55">
      <div className="border-b border-zinc-800/80 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-violet-300">
              <BrainCircuit size={18} />
              <p className="text-[10px] font-black uppercase tracking-[.18em]">
                Inteligência do período
              </p>
            </div>
            <h2 className="mt-2 font-heading text-lg font-black text-zinc-100">
              Leitura contextual · {periodLabel}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              O cérebro usa somente a janela selecionada neste relatório. Sinais
              são contextuais e explicáveis; não são ranking de pessoas nem
              prova de causa.
            </p>
          </div>

          <div className="shrink-0 rounded-2xl border border-violet-500/15 bg-violet-500/10 px-3 py-2 text-center">
            <p className="text-lg font-black text-violet-200">
              {snapshot.summary.total}
            </p>
            <p className="text-[8px] font-black uppercase tracking-wider text-violet-400">
              sinais
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <CoveragePill
            label="Pedidos datados"
            value={snapshot.coverage.datedDeliveries}
          />
          <CoveragePill
            label="Com rota"
            value={snapshot.coverage.routedDeliveries}
          />
          <CoveragePill
            label="Abastecimentos"
            value={snapshot.coverage.fuelRecords}
          />
        </div>
      </div>

      <div className="space-y-2 p-3">
        {highlights.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/45 px-4 py-4">
            <p className="text-sm font-bold text-zinc-300">
              Sem sinal conclusivo nesta janela
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              O app prefere não fabricar uma conclusão quando a amostra ainda é
              pequena ou não há diferença operacional relevante.
            </p>
          </div>
        ) : (
          highlights.map((insight) => {
            const meta = severityMeta[insight.severity];
            const Icon = meta.icon;
            const expanded = expandedId === insight.id;

            return (
              <article
                key={insight.id}
                className={`overflow-hidden rounded-2xl border ${meta.border} ${meta.surface}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((current) =>
                      current === insight.id ? null : insight.id,
                    )
                  }
                  className="flex w-full items-start gap-3 p-4 text-left active:scale-[0.995]"
                >
                  <div className={`mt-0.5 shrink-0 ${meta.text}`}>
                    <Icon size={17} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[9px] font-black uppercase tracking-[.16em] ${meta.text}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[9px] font-bold text-zinc-600">
                        {confidenceLabel[insight.confidence]}
                      </span>
                      <span className="text-[9px] font-bold text-zinc-600">
                        amostra {insight.sampleSize}
                      </span>
                    </div>

                    <p className="mt-1.5 text-sm font-black leading-snug text-zinc-100">
                      {insight.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                      {insight.summary}
                    </p>
                  </div>

                  <div className="mt-1 shrink-0 text-zinc-600">
                    {expanded ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-white/[0.05] px-4 pb-4 pt-3">
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      {insight.explanation}
                    </p>

                    {insight.evidence.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {insight.evidence.map((item) => (
                          <div
                            key={`${insight.id}-${item.label}`}
                            className="rounded-xl bg-zinc-950/55 px-3 py-2.5"
                          >
                            <p className="text-[8px] font-black uppercase tracking-wider text-zinc-600">
                              {item.label}
                            </p>
                            <p className="mt-1 text-xs font-black text-zinc-200">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        hideForToday(insight.id);
                        setExpandedId(null);
                      }}
                      className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/45 text-[10px] font-black text-zinc-500 active:scale-[0.99]"
                    >
                      <EyeOff size={14} />
                      Ocultar por hoje
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {snapshot.coverage.undatedDeliveries > 0 && (
        <div className="border-t border-zinc-800/80 px-5 py-3 text-[10px] leading-relaxed text-zinc-600">
          Existem {snapshot.coverage.undatedDeliveries} pedido
          {snapshot.coverage.undatedDeliveries === 1 ? '' : 's'} sem data
          confiável na base. Eles não são inventados dentro de uma janela
          temporal.
        </div>
      )}
    </section>
  );
}

function CoveragePill({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-zinc-950/50 px-3 py-2.5">
      <p className="text-[8px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <p className="mt-1 text-base font-black text-zinc-100">{value}</p>
    </div>
  );
}
