'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, ChevronDown, Route as RouteIcon, ShieldCheck, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { futureRoutePlan } from '@/lib/operation/future-route-planning';
import { siteOrderDisplayReference } from '@/lib/operation/site-order-presentation';
import { toast } from '@/lib/operational-toast';

/**
 * R299 P10A — Reservas operacionais para pedidos do Site já aprovados.
 * Esta interface NÃO autoriza a saída, NÃO altera o preparo e NÃO envia WhatsApp.
 * A reserva é revalidada transacionalmente no Firestore pela store.
 */
export function SiteFutureRoutePlanner({ now }: { now: number }) {
  const deliveries = useAppStore(state => state.deliveries);
  const routes = useAppStore(state => state.routes);
  const reserve = useAppStore(state => state.reserveFutureSiteRoute);
  const plans = useMemo(() => futureRoutePlan(deliveries, routes, now), [deliveries, routes, now]);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const apply = async (deliveryId: string, routeId: string | null) => {
    if (busy) return;
    const plan = plans.find(item => item.delivery.id === deliveryId);
    if (!plan) return;
    if (routeId && (plan.issue || !plan.candidates.some(item => item.id === routeId))) {
      toast.warning('Esta rota não está disponível para o agendamento. Sincronize e revise.');
      return;
    }
    setBusy(deliveryId);
    try {
      await reserve(deliveryId, routeId);
      toast.success(routeId ? 'Rota reservada para planejamento.' : 'Reserva cancelada.', {
        description: 'Sem despacho, aviso ao cliente ou mudança no preparo.',
      });
      setSelected(old => ({ ...old, [deliveryId]: routeId || '' }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a reserva.');
    } finally {
      setBusy(null);
    }
  };

  if (plans.length === 0) return null;
  const reservedCount = plans.filter(item => Boolean(item.delivery.planned_route_id?.trim())).length;

  return (
    <section aria-label="Planejamento antecipado dos pedidos do Site" className="rounded-[20px] border border-sky-500/20 bg-sky-500/[.045] p-3">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="flex min-h-12 w-full items-center gap-3 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300"><CalendarClock size={19}/></span>
        <span className="min-w-0 flex-1">
          <strong className="block text-[12px] font-black text-sky-100">Planejar rotas antecipadamente</strong>
          <small className="mt-0.5 block text-[10px] leading-relaxed text-zinc-400">{plans.length} pedido(s) aprovado(s) com janela futura · {reservedCount} reserva(s)</small>
        </span>
        <ChevronDown size={17} className={`shrink-0 text-sky-300 transition-transform ${expanded ? 'rotate-180' : ''}`}/>
      </button>
      {expanded && <div className="mt-3 space-y-2 border-t border-sky-500/15 pt-3">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-zinc-300"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-sky-300"/>Reserva não é despacho. O pedido continua no estado comercial do Site e só poderá sair depois de liberado para logística.</p>
        {plans.map(plan => {
          const delivery = plan.delivery;
          const current = delivery.planned_route_id?.trim() || '';
          const currentRoute = routes.find(route => route.id === current);
          const chosen = selected[delivery.id] ?? current;
          const locked = busy !== null;
          return <article key={delivery.id} className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/65 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-black text-zinc-100">{delivery.customer_name || 'Pedido do Site'}</p>
                <p className="text-[10px] font-semibold text-sky-300">{siteOrderDisplayReference(delivery)}</p>
              </div>
              <span className="shrink-0 rounded-lg bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-200">{new Date(plan.releaseAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'})}</span>
            </div>
            {current && <p className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-300"><CheckCircle2 size={13}/> Reservada: {currentRoute?.name || 'Rota temporariamente indisponível'}</p>}
            {plan.issue && <p role="alert" className="rounded-lg bg-amber-500/10 px-2 py-2 text-[10px] font-bold text-amber-200">{plan.issue}. Revise antes de criar uma nova reserva.</p>}
            {!plan.candidates.length && <p className="text-[10px] text-zinc-400">Sem rota aberta e ainda não iniciada para essa data. Crie ou confira a rota antes de planejar.</p>}
            {plan.candidates.length > 0 && !plan.issue && <div className="flex flex-col gap-2 sm:flex-row">
              <label className="min-w-0 flex-1 text-[10px] font-semibold text-zinc-400">Rota de planejamento
                <select aria-label={`Selecionar rota futura de ${delivery.customer_name || 'pedido'}`} value={chosen} disabled={locked} onChange={event => setSelected(old => ({ ...old, [delivery.id]: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-100">
                  <option value="">Escolha uma rota</option>
                  {plan.candidates.map(route => <option value={route.id} key={route.id}>{route.name} · {route.motoboy_name || 'Sem responsável'}</option>)}
                </select>
              </label>
              <button type="button" disabled={locked || !chosen || chosen === current} onClick={() => void apply(delivery.id, chosen)} className="min-h-11 self-end rounded-xl border border-sky-500/35 bg-sky-500/15 px-3 text-[11px] font-black text-sky-100 disabled:opacity-35"><RouteIcon size={13} className="mr-1 inline"/>{busy === delivery.id ? 'Salvando...' : 'Reservar'}</button>
            </div>}
            {current && <button type="button" disabled={locked} onClick={() => void apply(delivery.id, null)} className="flex min-h-10 w-full items-center justify-center gap-1 rounded-lg border border-zinc-700/70 text-[10px] font-bold text-zinc-300 disabled:opacity-40"><X size={13}/> Cancelar reserva sem alterar pedido</button>}
          </article>;
        })}
      </div>}
    </section>
  );
}
