'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Delivery, Route } from '@/types';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';

interface Props { routes: Route[]; deliveries: Delivery[]; pendingSettlements: number; pendingSiteOrders: number; }

export function OperationReadiness({ routes, deliveries, pendingSettlements, pendingSiteOrders }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const active = deliveries.filter((delivery) =>
    !delivery.completed && !isCancelledSiteDelivery(delivery) && isDeliveryFulfillment(delivery),
  );
  const validRoutes = new Set(routes.map((route) => route.id));
  const withoutRoute = active.filter((delivery) => !delivery.route_id || !validRoutes.has(delivery.route_id));
  const withoutAddress = active.filter((delivery) => !String(delivery.address_string || '').trim());
  const openRoutes = routes.filter((route) => route.status === 'aberta').length;
  const issues = [
    { key: 'site', label: 'Pedidos do Site na caixa de entrada', count: pendingSiteOrders, href: '/loja/caixa-de-entrada?aba=site' },
    { key: 'route', label: 'Entregas sem rota válida', count: withoutRoute.length, href: withoutRoute[0]?.id ? `/entregas/editar?id=${encodeURIComponent(withoutRoute[0].id)}` : '/entregas' },
    { key: 'address', label: 'Endereço ausente', count: withoutAddress.length, href: withoutAddress[0]?.id ? `/entregas/editar?id=${encodeURIComponent(withoutAddress[0].id)}` : '/entregas' },
    { key: 'settle', label: 'Acertos de motoboys pendentes', count: pendingSettlements, href: '/motoboys' },
  ].filter((item) => item.count > 0);
  const critical = issues.filter((item) => item.key !== 'settle').length;
  return (
    <section className="mb-2 rounded-[20px] border border-zinc-800 bg-zinc-900/65 p-3" aria-label="Prontidão da operação">
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}
        className="flex min-h-12 w-full items-center gap-3 text-left">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${critical ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {critical ? <ClipboardCheck size={19}/> : <ShieldCheck size={19}/>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-black text-zinc-100">Prontidão operacional</span>
          <span className="mt-0.5 block text-[10px] text-zinc-400">
            {active.length} entrega{active.length === 1 ? '' : 's'} pendente{active.length === 1 ? '' : 's'} · {openRoutes} rota{openRoutes === 1 ? '' : 's'} aberta{openRoutes === 1 ? '' : 's'}
          </span>
        </span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${critical ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
          {critical ? `${critical} atenção` : 'Sem alerta crítico'}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}/>
      </button>
      {expanded && <div className="mt-2 space-y-1.5 border-t border-zinc-800 pt-3">
        {issues.length ? issues.map((item) => <button key={item.key} type="button" onClick={() => router.push(item.href)}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/45 px-3 text-left text-[11px] text-zinc-300">
          <AlertTriangle size={14} className="shrink-0 text-amber-400"/>
          <span className="min-w-0 flex-1">{item.label}</span><span className="font-black tabular-nums">{item.count}</span><ChevronRight size={14}/>
        </button>) : <p className="rounded-xl border border-emerald-500/15 bg-emerald-500/[.04] p-3 text-[11px] text-emerald-300">Nenhuma pendência identificada nos dados carregados.</p>}
        <p className="px-1 pt-1 text-[10px] leading-relaxed text-zinc-500">Conferência baseada nos dados carregados neste dispositivo. Não substitui a conferência física dos pedidos, do caixa e do APK.</p>
      </div>}
    </section>
  );
}
