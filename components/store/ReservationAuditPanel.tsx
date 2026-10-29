'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/operational-toast';
import { isFutureScheduledDelivery } from '@/lib/scheduled-delivery';
import { dateKey, routeOperationalDateKey } from '@/lib/operational-time';
import { AlertTriangle, CalendarClock, ChevronDown, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { auditFutureReservations } from '@/lib/operation/reservation-audit';
import { OPERATION_FIRST_BATCH, nextProgressiveCount } from '@/lib/operation/progressiveWindow';

export function ReservationAuditPanel() {
  const router = useRouter();
  const allocate = useAppStore(state => state.allocateSiteDelivery);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const deliveries = useAppStore(state => state.deliveries);
  const routes = useAppStore(state => state.routes);
  const [expanded, setExpanded] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [limit, setLimit] = useState(OPERATION_FIRST_BATCH);
  const rows = useMemo(() => auditFutureReservations(deliveries, routes), [deliveries, routes]);
  const issues = rows.filter(row => !!row.issue).length;
  const canConvert = (delivery: typeof deliveries[number], route: typeof routes[number] | null, issue: string | null) =>
    !issue && !!route && !isFutureScheduledDelivery(delivery, clock) &&
    routeOperationalDateKey(route) === dateKey(new Date(clock)) &&
    route.status === 'aberta' && !route.started_at && !route.end_time &&
    delivery.planned_route_id?.trim() === route.id;
  const convert = async (deliveryId: string, plannedRouteId: string) => {
    if (busy) return;
    setBusy(deliveryId);
    try {
      const current = useAppStore.getState();
      const entry = auditFutureReservations(current.deliveries, current.routes).find(row => row.delivery.id === deliveryId);
      if (!entry || !canConvert(entry.delivery, entry.route, entry.issue) || entry.route?.id !== plannedRouteId) {
        throw new Error('A reserva deixou de estar elegível. Atualize e revise o pedido.');
      }
      const routeId = await allocate(deliveryId, { routeId: plannedRouteId, expectedPlannedRouteId: plannedRouteId });
      setConfirmId(null);
      toast.success('Reserva convertida em vínculo de rota.', {description:'A saída só acontece quando a rota for iniciada.'});
      router.push(`/rotas/details?id=${encodeURIComponent(routeId)}&date=${encodeURIComponent(dateKey(new Date()))}`);
    } catch (error) {
      toast.error('Não foi possível converter a reserva.', {description:error instanceof Error ? error.message : 'Sincronize e tente novamente.'});
    } finally { setBusy(null); }
  };
  const shown = onlyIssues ? rows.filter(row => !!row.issue) : rows;
  if (!rows.length) return null;
  return <section className="rounded-[20px] border border-sky-500/20 bg-sky-500/[.035] p-3.5" aria-label="Conferência de reservas futuras">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="flex min-h-11 w-full items-center gap-2 text-left">
      {issues ? <AlertTriangle size={18} className="shrink-0 text-amber-300"/> : <ShieldCheck size={18} className="shrink-0 text-emerald-300"/>}
      <span className="min-w-0 flex-1"><span className="block text-xs font-black text-zinc-100">Conferência de reservas</span><span className="block text-[10px] text-zinc-400">{rows.length} reserva{rows.length===1?'':'s'} · {issues} para revisar</span></span>
      <ChevronDown size={16} className={expanded?'rotate-180':''}/>
    </button>
    {expanded && <div className="mt-3 space-y-2">
      <p className="rounded-xl border border-zinc-800 p-2.5 text-[11px] leading-relaxed text-zinc-400">Reservas são planejamento, não despacho. Uma divergência não é corrigida automaticamente: confira primeiro o pedido e a rota. Nenhuma alteração comercial é feita aqui.</p>
      <div className="flex gap-2">
        <button type="button" aria-pressed={onlyIssues} onClick={() => {setOnlyIssues(true);setLimit(OPERATION_FIRST_BATCH);}} className={`min-h-10 flex-1 rounded-xl border text-[11px] font-bold ${onlyIssues?'border-amber-500/40 text-amber-200':'border-zinc-800 text-zinc-400'}`}>Revisar · {issues}</button>
        <button type="button" aria-pressed={!onlyIssues} onClick={() => {setOnlyIssues(false);setLimit(OPERATION_FIRST_BATCH);}} className={`min-h-10 flex-1 rounded-xl border text-[11px] font-bold ${!onlyIssues?'border-sky-500/40 text-sky-200':'border-zinc-800 text-zinc-400'}`}>Todas · {rows.length}</button>
      </div>
      {shown.length===0&&<p className="p-3 text-xs text-emerald-300">Nenhuma divergência detectada nas reservas carregadas.</p>}
      {shown.slice(0,limit).map(({delivery,route,issue}) => <article key={delivery.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
        <p className="truncate text-xs font-bold text-zinc-100">{delivery.customer_name||'Cliente do Site'} · #{delivery.external_order_id||delivery.id}</p>
        <p className="mt-1 flex items-center gap-1 text-[10px] text-zinc-400"><CalendarClock size={12}/>{delivery.scheduled_label||delivery.scheduled_for||'Sem agendamento'} · {route?.name||'Rota ausente'}</p>
        <p role={issue?'alert':undefined} className={`mt-2 text-[11px] ${issue?'text-amber-300':'text-emerald-300'}`}>{issue||'Reserva coerente com os dados carregados. A liberação real continua independente.'}</p>
        {!issue && <div className="mt-2 space-y-2">
          {canConvert(delivery,route,issue) ? <>
            <button type="button" disabled={Boolean(busy)} onClick={() => setConfirmId(current => current === delivery.id ? null : delivery.id)} className="min-h-11 w-full rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-200 disabled:opacity-40">{confirmId===delivery.id?'Cancelar confirmação':'Converter reserva em rota real'}</button>
            {confirmId===delivery.id && <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/[.06] p-3">
              <p className="text-[11px] text-amber-100">Confirmar vínculo à rota {route?.name}? O pedido já precisa estar liberado. Isto NÃO inicia a rota nem avisa saída ao cliente.</p>
              <button type="button" disabled={Boolean(busy)} onClick={() => route && void convert(delivery.id, route.id)} className="min-h-11 w-full rounded-xl bg-emerald-700 px-3 text-xs font-black text-white disabled:opacity-40">{busy===delivery.id?'Confirmando no Firestore…':'Confirmar vínculo operacional'}</button>
            </div>}
          </> : <button type="button" onClick={() => setClock(Date.now())} className="min-h-10 w-full rounded-xl border border-zinc-700 px-3 text-[11px] font-semibold text-zinc-300">Atualizar janela de liberação</button>}
        </div>}
      </article>)}
      {shown.length>limit&&<button type="button" onClick={() => setLimit(value => nextProgressiveCount(shown.length,value))} className="min-h-11 w-full rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300">Mostrar mais · {Math.min(limit,shown.length)} de {shown.length}</button>}
    </div>}
  </section>;
}
