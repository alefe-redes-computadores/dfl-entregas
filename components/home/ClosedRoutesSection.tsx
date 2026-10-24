'use client';

import { useMemo, useState } from 'react';
import { Bike, CheckCircle2, ChevronDown, UserRound, Users } from 'lucide-react';
import type { Motoboy, Route } from '@/types';
import { LazyClosedRouteCard } from '@/components/home/LazyClosedRouteCard';
import { firstValidTimestamp } from '@/lib/reports/time';

/**
 * Histórico fechado é secundário à execução. Renderizar dezenas de accordions
 * completos (e seus seletores Zustand) sem intenção de consulta custa caro.
 */
export function ClosedRoutesSection({
  routes,
  motoboys,
  motoboyFilter,
}: {
  routes: Route[];
  motoboys: Motoboy[];
  motoboyFilter: string | null;
}) {
  const [visibleLimit, setVisibleLimit] = useState(2);
  const expanded = visibleLimit > 2;
  const recentFirst = useMemo(() => [...routes].sort((a, b) => {
    const aTime = firstValidTimestamp(a.end_time, a.departure_time, a.created_at)?.getTime() || 0;
    const bTime = firstValidTimestamp(b.end_time, b.departure_time, b.created_at)?.getTime() || 0;
    return bTime - aTime;
  }), [routes]);
  // Renderização progressiva: histórico grande não monta todos os accordions de uma vez.
  const visibleRoutes = useMemo(() => recentFirst.slice(0, visibleLimit), [visibleLimit, recentFirst]);
  const moreCount = Math.min(10, Math.max(0, routes.length - visibleRoutes.length));
  const groups = useMemo(() => {
    const result = new Map<string, Route[]>();
    for (const route of visibleRoutes) {
      const current = result.get(route.motoboy_name) || [];
      current.push(route);
      result.set(route.motoboy_name, current);
    }
    return Array.from(result.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [visibleRoutes]);
  const motoboyByName = useMemo(() => new Map(motoboys.map(item => [item.name, item])), [motoboys]);
  const showGroups = !motoboyFilter;

  return (
    <section className="mt-2 space-y-2" aria-label="Histórico de rotas finalizadas">
      <header className="flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><CheckCircle2 size={16} /></span>
          <div className="min-w-0">
            <h2 className="text-xs font-black text-zinc-200">Rotas finalizadas</h2>
            <p className="text-[10px] text-zinc-500">{routes.length} concluída{routes.length === 1 ? '' : 's'}{motoboyFilter ? ` · ${motoboyFilter}` : ''}</p>
          </div>
        </div>
        {routes.length > 2 && expanded && (
          <button type="button" aria-expanded={expanded} onClick={() => setVisibleLimit(2)} className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 text-[11px] font-bold text-zinc-300 active:bg-zinc-800">
            Recolher <ChevronDown size={14} className="rotate-180" />
          </button>
        )}
      </header>
      {showGroups ? groups.map(([name, groupedRoutes]) => {
        const motoboy = motoboyByName.get(name);
        const Icon = motoboy?.avatar?.includes('woman') ? UserRound : motoboy?.avatar?.includes('bike') ? Bike : Users;
        return (
          <div key={name} className="space-y-1.5">
            <div className="flex items-center gap-1.5 px-1.5 text-zinc-500"><Icon size={13} /><span className="text-[10px] font-bold">{name}</span><span className="ml-auto text-[10px] tabular-nums">{groupedRoutes.length}{expanded ? '' : ' recente(s)'}</span></div>
            {groupedRoutes.map(route => <LazyClosedRouteCard key={route.id} route={route} />)}
          </div>
        );
      }) : visibleRoutes.map(route => <LazyClosedRouteCard key={route.id} route={route} />)}
      {moreCount > 0 && (
        <button type="button" onClick={() => setVisibleLimit(limit => limit + 10)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 text-xs font-bold text-zinc-300 active:bg-zinc-800">
          Ver mais {moreCount} rota{moreCount === 1 ? '' : 's'} · {visibleRoutes.length} de {routes.length}
          <ChevronDown size={15} />
        </button>
      )}
    </section>
  );
}
