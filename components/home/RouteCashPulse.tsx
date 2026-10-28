'use client';

import { useMemo, useState } from 'react';
import { Banknote, ChevronDown, Wallet } from 'lucide-react';
import type { Delivery, Route } from '@/types';
import { routeCashFlow } from '@/lib/route-cash-flow';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { useAppStore } from '@/store/useAppStore';

const formatBRL = (amount: number) => amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Projeções operacionais: não são lançamentos de caixa, saldo bancário nem conciliação. */
export function RouteCashPulse({ routes, deliveries }: { routes: Route[]; deliveries: Delivery[] }) {
  const [expanded, setExpanded] = useState(false);
  const privateMode = useAppStore((state) => state.isPrivacyMode);
  const report = useMemo(() => {
    const ids = new Set(routes.map((route) => route.id));
    const byRoute = new Map<string, Delivery[]>();
    for (const delivery of deliveries) {
      if (!delivery.route_id || !ids.has(delivery.route_id) || isCancelledSiteDelivery(delivery)) continue;
      const bucket = byRoute.get(delivery.route_id);
      if (bucket) bucket.push(delivery);
      else byRoute.set(delivery.route_id, [delivery]);
    }
    return routes.map((route) => {
      const flow = routeCashFlow(byRoute.get(route.id) || [], route.change_money || 0);
      return { id: route.id, name: route.name, ...flow };
    }).filter((item) => item.initialCash > 0 || item.cashOrders.length > 0);
  }, [routes, deliveries]);
  if (report.length === 0) return null;
  const totalBag = report.reduce((sum, route) => sum + route.initialCash, 0);
  const totalReturn = report.reduce((sum, route) => sum + route.expectedPhysicalReturn, 0);
  const totalPixChange = report.reduce((sum, route) => sum + route.plannedPixChange, 0);
  const showAmount = (value: number) => privateMode ? 'R$ •••' : formatBRL(value);
  return (
    <div className="mb-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3" aria-label="Previsão de dinheiro das rotas abertas">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left">
        <span className="flex min-w-0 items-center gap-2"><Wallet size={17} className="shrink-0 text-emerald-400"/><span className="min-w-0"><span className="block text-xs font-black text-zinc-100">Dinheiro nas rotas</span><span className="block text-[10px] text-zinc-500">Projeção · {report.length} rota{report.length !== 1 ? 's' : ''} com dinheiro</span></span></span>
        <ChevronDown size={16} className={`text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}/>
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-zinc-950/50 px-3 py-2"><p className="text-[10px] text-zinc-500">Saiu na bag</p><p className="text-sm font-black tabular-nums text-zinc-100">{showAmount(totalBag)}</p></div>
        <div className="rounded-xl bg-zinc-950/50 px-3 py-2"><p className="text-[10px] text-zinc-500">Retorno previsto</p><p className="text-sm font-black tabular-nums text-emerald-300">{showAmount(totalReturn)}</p></div>
      </div>
      {totalPixChange > 0 && <p className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-300"><Banknote size={13}/>Troco via Pix previsto: {showAmount(totalPixChange)}</p>}
      {expanded && <div className="mt-2 space-y-1.5 border-t border-zinc-800/70 pt-2">{report.map((route) => <div key={route.id} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950/40 px-2.5 py-2"><span className="min-w-0 truncate text-[11px] font-semibold text-zinc-300">{route.name}</span><span className="shrink-0 text-[11px] font-black tabular-nums text-emerald-300">{showAmount(route.expectedPhysicalReturn)}</span></div>)}<p className="text-[10px] leading-relaxed text-zinc-500">Estimativa baseada nas cobranças e trocos previstos. Não substitui conferência do motoboy nem acerto financeiro.</p></div>}
    </div>
  );
}
