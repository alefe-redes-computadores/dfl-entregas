'use client';

import { AlertTriangle, CheckCircle2, ChevronRight, Database } from 'lucide-react';
import type { DataQualityIssue } from '@/lib/reports/types';

interface DataQualityCardProps {
  issues: DataQualityIssue[];
  totalDeliveries: number;
  onExplore: () => void;
}

export function DataQualityCard({
  issues,
  totalDeliveries,
  onExplore,
}: DataQualityCardProps) {
  const affected = issues.reduce((sum, issue) => sum + issue.count, 0);
  const hasIssues = issues.some((issue) => issue.count > 0);

  return (
    <section className="overflow-hidden rounded-[26px] border border-zinc-800/80 bg-zinc-900/55">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Database size={18} className="text-violet-400" />
              <h2 className="font-black text-zinc-100">Qualidade dos dados</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Mostra cobertura e registros que foram excluídos apenas das métricas que dependem do campo problemático.
            </p>
          </div>

          {hasIssues ? (
            <AlertTriangle size={20} className="shrink-0 text-amber-400" />
          ) : (
            <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
              Entregas no período
            </div>
            <div className="mt-1 text-xl font-black text-zinc-100">{totalDeliveries}</div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
              Ocorrências de qualidade
            </div>
            <div className="mt-1 text-xl font-black text-amber-300">{affected}</div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {issues
            .filter((issue) => issue.count > 0)
            .slice(0, 4)
            .map((issue) => (
              <div
                key={issue.key}
                className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/45 px-3 py-2"
              >
                <span className="text-xs font-medium text-zinc-400">{issue.label}</span>
                <span className="text-xs font-black text-zinc-200">{issue.count}</span>
              </div>
            ))}

          {!hasIssues && (
            <div className="rounded-xl bg-emerald-500/10 px-3 py-3 text-xs font-semibold text-emerald-300">
              Nenhuma inconsistência catalogada neste período.
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onExplore}
        className="flex w-full items-center justify-between border-t border-zinc-800/70 px-5 py-3 text-xs font-bold text-zinc-400 active:bg-zinc-800/70"
      >
        <span>Ver cobertura e critérios</span>
        <ChevronRight size={15} />
      </button>
    </section>
  );
}
