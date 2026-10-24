'use client';

import { memo, useState } from 'react';
import { Bike, CheckCircle2, ChevronDown } from 'lucide-react';
import type { Route } from '@/types';
import { RouteAccordion } from '@/components/home/RouteAccordion';

/**
 * R90: a linha histórica é uma prévia barata, sem listeners, seletores de
 * deliveries ou memória de inteligência. O accordion real só monta por ação
 * explícita e volta a liberar seus recursos quando o usuário recolhe.
 */
export const LazyClosedRouteCard = memo(function LazyClosedRouteCard({ route }: { route: Route }) {
  const [showDetails, setShowDetails] = useState(false);

  if (showDetails) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          aria-expanded={true}
          onClick={() => setShowDetails(false)}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900/45 px-3 text-[11px] font-bold text-zinc-300 transition-colors active:bg-zinc-800"
        >
          <ChevronDown size={14} className="rotate-180" /> Recolher detalhes da {route.name}
        </button>
        <RouteAccordion route={route} defaultOpen={true} />
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={false}
      aria-label={`Consultar histórico da ${route.name}, entregador ${route.motoboy_name}`}
      onClick={() => setShowDetails(true)}
      className="flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-zinc-800/80 bg-zinc-900/35 px-3.5 py-3 text-left transition-colors active:bg-zinc-800/70"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-500/15 bg-emerald-500/[.06] text-emerald-400">
        <CheckCircle2 size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-black text-zinc-200">{route.name}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-zinc-500">
          <Bike size={11} className="shrink-0" /><span className="truncate">{route.motoboy_name}</span>
        </span>
      </span>
      <span className="shrink-0 text-[10px] font-bold text-emerald-400">Concluída</span>
      <ChevronDown size={15} className="shrink-0 text-zinc-500" />
    </button>
  );
});
