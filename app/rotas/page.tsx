// app/rotas/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bike, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, Search, User, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { matchesOperationSearch } from '@/lib/operation/searchR99';
import { firstValidTimestamp } from '@/lib/reports/time';
import { OPERATION_BATCH, OPERATION_FIRST_BATCH, nextProgressiveCount, progressiveCount } from '@/lib/operation/progressiveWindow';
import { groupDeliveriesByStop } from '@/lib/route-stops';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { deliveryCustomerCharge, deliveryEconomicValue } from '@/lib/delivery-finance';
import { routeOutstandingPayment } from '@/lib/operation/routeCollection';
import {
  dateKey,
  operationalDateFromKey,
  operationalDayLabel,
  routeDate as canonicalRouteDate,
  routeStartedAt as canonicalRouteStartedAt,
  shiftOperationalDateKey,
} from '@/lib/operational-time';

type Filter = 'todas' | 'montando' | 'na-rua' | 'prontas' | 'finalizadas';
export default function RoutesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get('date');
  const globalSelectedDate = useAppStore((state) => state.selectedDate);
  const setGlobalSelectedDate = useAppStore((state) => state.setSelectedDate);
  const today = dateKey(new Date());
  const initialDateKey =
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
      ? initialDate
      : dateKey(globalSelectedDate);
  const routes = useAppStore(state => state.routes);
  const deliveries = useAppStore(state => state.deliveries);
  const selectedDate = dateKey(globalSelectedDate);

  useEffect(() => {
    if (
      initialDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(initialDate) &&
      dateKey(useAppStore.getState().selectedDate) !== initialDate
    ) {
      setGlobalSelectedDate(
        operationalDateFromKey(initialDate),
      );
    }
  }, [initialDate, setGlobalSelectedDate]);
  const setSelectedDate = (key: string | ((value: string) => string)) => {
    const next =
      typeof key === 'function'
        ? key(dateKey(useAppStore.getState().selectedDate))
        : key;

    setGlobalSelectedDate(operationalDateFromKey(next));
  };
  const [calendarMonth, setCalendarMonth] = useState(() => operationalDateFromKey(initialDateKey));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('todas');
  const [query, setQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(OPERATION_FIRST_BATCH);
  useEffect(() => { setVisibleLimit(OPERATION_FIRST_BATCH); }, [selectedDate, filter, query]);

  const deliveriesByRoute = useMemo(() => {
    const map = new Map<string, typeof deliveries>();

    for (const delivery of deliveries) {
      if (!delivery.route_id || isCancelledSiteDelivery(delivery)) continue;

      const bucket = map.get(delivery.route_id) || [];
      bucket.push(delivery);
      map.set(delivery.route_id, bucket);
    }

    return map;
  }, [deliveries]);

  const dayRoutes = useMemo(() => routes.filter(route => {
    const value = canonicalRouteDate(route);
    return value ? dateKey(value) === selectedDate : false;
  }), [routes, selectedDate]);

  const searchTerm = useMemo(() => query.trim().toLocaleLowerCase('pt-BR'), [query]);

  const searchedDayRoutes = useMemo(() => dayRoutes.filter(route =>
    !searchTerm || `${route.name} ${route.motoboy_name}`.toLocaleLowerCase('pt-BR').includes(searchTerm) || matchesOperationSearch(`${route.name} ${route.motoboy_name || ''}`, searchTerm)
  ), [dayRoutes, searchTerm]);

  // R49: somente classificar/ordenar o universo completo aqui. A quantidade de
  // paradas e os valores financeiros são calculados APÓS a janela de 40 cards;
  // filtros, totais e a ordem continuam abrangendo todas as rotas.
  const rows = useMemo(() => searchedDayRoutes.map(route => {
    const linked = deliveriesByRoute.get(route.id) || [];
    let completed = 0;
    for (const delivery of linked) {
      if (delivery.completed) completed++;
    }
    const startedAt = canonicalRouteStartedAt(route);
    const ready =
      route.status === 'aberta' &&
      Boolean(startedAt) &&
      linked.length > 0 &&
      completed === linked.length;
    const state: Exclude<Filter, 'todas'> =
      route.status === 'fechada'
        ? 'finalizadas'
        : ready
          ? 'prontas'
          : startedAt
            ? 'na-rua'
            : 'montando';
    const sortedAt = new Date(canonicalRouteDate(route) || '').getTime();
    return { route, linked, completed, state, sortedAt };
  }).filter(({ route, state }) => {
    return filter === 'todas' || state === filter;
  }).sort((a, b) => {
    if (!Number.isFinite(a.sortedAt)) return Number.isFinite(b.sortedAt) ? 1 : 0;
    if (!Number.isFinite(b.sortedAt)) return -1;
    return a.sortedAt - b.sortedAt;
  }), [searchedDayRoutes, deliveriesByRoute, filter]);

  const renderedRows = useMemo(() => rows.slice(0, progressiveCount(rows.length, visibleLimit)).map(row => {
    const linked = row.linked;
    let amount = 0;
    let customerCharge = 0;
    let pendingCharge = 0;
    let pendingPayments = 0;
    for (const delivery of linked) {
      amount += deliveryEconomicValue(delivery);
      customerCharge += deliveryCustomerCharge(delivery);
      const outstanding = routeOutstandingPayment(delivery);
      if (outstanding.pending) { pendingCharge += outstanding.amount; pendingPayments++; }
    }
    const stops = groupDeliveriesByStop(linked).length;
    return { ...row, stops, amount, customerCharge, pendingCharge, pendingPayments };
  }), [rows, visibleLimit]);

  const counts = useMemo(() => {
    // O contador percorre rotas uma vez; as paradas são consultadas no índice da R40.
    const result = {montando: 0, rua: 0, prontas: 0, finalizadas: 0};
    for (const route of dayRoutes) {
      if (route.status === 'fechada') { result.finalizadas++; continue; }
      if (route.status !== 'aberta') continue;
      if (!canonicalRouteStartedAt(route)) { result.montando++; continue; }
      const linked = deliveriesByRoute.get(route.id) || [];
      if (linked.length > 0 && linked.every(delivery => delivery.completed)) result.prontas++;
      else result.rua++;
    }
    return result;
  }, [dayRoutes, deliveriesByRoute]);

  const calendarDays = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [calendarMonth]);

  const datesWithRoutes = useMemo(
    () =>
      new Set(
        routes
          .map(canonicalRouteDate)
          .filter((value): value is string => Boolean(value))
          .map(dateKey),
      ),
    [routes],
  );
  const selectDate = (key: string) => { setSelectedDate(key); setFilter('todas'); setCalendarOpen(false); };

  return <div className="dfl-page dfl-v27-routes">
    <header className="flex items-center justify-between">
      <div className="flex min-w-0 items-center gap-3"><button onClick={() => router.replace('/loja')} aria-label="Voltar para Minha Loja" className="dfl-icon-button"><ChevronLeft size={20}/></button><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-emerald-500">Operação diária</p><h1 className="font-heading text-2xl font-bold text-zinc-50">Rotas</h1></div></div>
    </header>

    <div className="flex items-center gap-2 rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-2">
      <button onClick={() => setSelectedDate(value => shiftOperationalDateKey(value, -1))} className="flex h-11 w-11 items-center justify-center rounded-2xl text-zinc-500 active:bg-zinc-800"><ChevronLeft size={21}/></button>
      <button onClick={() => { setCalendarMonth(operationalDateFromKey(selectedDate)); setCalendarOpen(true); }} className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-800/75 px-3"><CalendarDays size={17} className="text-emerald-400"/><span className="truncate text-sm font-black capitalize text-zinc-100">{operationalDayLabel(selectedDate)}</span></button>
      <button onClick={() => setSelectedDate(value => shiftOperationalDateKey(value, 1))} className="flex h-11 w-11 items-center justify-center rounded-2xl text-zinc-500 active:bg-zinc-800"><ChevronRight size={21}/></button>
    </div>

    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-3.5 py-3">
      <div className="flex items-center justify-between gap-3 text-center">
        <CompactMetric value={counts.montando} label="Montando" />
        <CompactMetric value={counts.rua} label="Na rua" tone="sky" />
        <CompactMetric value={counts.prontas} label="Prontas" tone="green" />
        <CompactMetric value={counts.finalizadas} label="Finalizadas" tone="green" />
      </div>
    </section>

    <div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar rota ou entregador" className="dfl-search pl-11 pr-16"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca de rotas" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-2 text-[10px] font-bold text-emerald-300">Limpar</button>}</div>
    <div className="dfl-filter-row">{([['todas','Todas'],['montando','Montando'],['na-rua','Na rua'],['prontas','Prontas'],['finalizadas','Finalizadas']] as const).map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold ${filter === value ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>{label}</button>)}</div>

    <p aria-live="polite" className="px-1 text-[10px] text-zinc-500">{rows.length} rota{rows.length === 1 ? '' : 's'} neste filtro · {renderedRows.length} exibida{renderedRows.length === 1 ? '' : 's'}</p>
    <div className="flex flex-col gap-3">
      {renderedRows.map(({ route, linked, completed, stops, amount, customerCharge, pendingCharge, pendingPayments, state }) => {
        const progress = linked.length ? Math.round((completed / linked.length) * 100) : 0;
        const pending = Math.max(0, linked.length - completed);
        const stateLabel =
          state === 'na-rua'
            ? 'Na rua'
            : state === 'prontas'
              ? 'Pronta'
              : state === 'finalizadas'
                ? 'Finalizada'
                : 'Montando';

        return (
          <button
            key={route.id}
            onClick={() => router.push(`/rotas/details?id=${route.id}&date=${encodeURIComponent(selectedDate)}`)}
            className={`w-full rounded-[20px] border text-left transition-colors hover:border-zinc-600 active:bg-zinc-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${state === 'finalizadas' ? 'p-3' : 'p-3.5'} ${
              state === 'na-rua'
                ? 'border-sky-500/20 bg-sky-500/[.035]'
                : state === 'prontas'
                  ? 'border-emerald-500/30 bg-emerald-500/[.055]'
                  : state === 'finalizadas'
                    ? 'border-emerald-500/20 bg-emerald-500/[.025]'
                    : 'border-zinc-800 bg-zinc-900/45'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                state === 'na-rua'
                  ? 'bg-sky-500/15 text-sky-400'
                  : state === 'finalizadas'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-400'
              }`}>
                <Bike size={20}/>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-heading text-base font-black text-zinc-100">
                    {route.name}
                  </p>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[9px] font-black uppercase ${
                    state === 'na-rua'
                      ? 'bg-sky-500/10 text-sky-400'
                      : state === 'finalizadas'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {stateLabel}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500">
                  <User size={12}/>
                  {route.motoboy_name || 'Sem motoboy'}
                  {state === 'finalizadas' && <span className="ml-1 text-zinc-600">· {completed}/{linked.length} pedidos · {stops} paradas</span>}
                </p>
              </div>

              <ChevronRight size={17} className="mt-1 shrink-0 text-zinc-700"/>
            </div>

            {state !== 'finalizadas' && <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-zinc-500">{stops} parada{stops === 1 ? "" : "s"} · {completed}/{linked.length} pedidos</span>
                <span className={pending ? 'text-amber-400' : 'text-emerald-400'}>
                  {pending
                    ? `${pending} pendente${pending === 1 ? '' : 's'}`
                    : linked.length > 0 ? 'Pronta para finalizar' : 'Sem pedidos'}
                </span>
              </div>
              <div role="progressbar" aria-label={`Entregas concluídas da rota ${route.name}`} aria-valuemin={0} aria-valuemax={linked.length || 1} aria-valuenow={completed} className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full ${pending ? 'bg-sky-500' : 'bg-emerald-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>}

            <div className={`${state === 'finalizadas' ? 'mt-2' : 'mt-3'} grid grid-cols-2 gap-2 border-t border-zinc-800/70 pt-2.5`}>
              <div>
                <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">Valor dos pedidos</p>
                <p className="mt-1 text-sm font-black text-emerald-400">
                  R$ {amount.toLocaleString('pt-BR',{minimumFractionDigits:2})}
                </p>
                {Math.abs(amount - customerCharge) > 0.009 && (
                  <p className="mt-1 text-[9px] font-bold text-zinc-600">
                    Cliente: R$ {customerCharge.toLocaleString('pt-BR',{minimumFractionDigits:2})}
                  </p>
                )}
                <p className={`mt-1 text-[10px] font-bold ${pendingPayments ? 'text-amber-300' : 'text-emerald-500/80'}`}>
                  {pendingPayments
                    ? `A receber: R$ ${pendingCharge.toLocaleString('pt-BR',{minimumFractionDigits:2})} · ${pendingPayments} pedido${pendingPayments === 1 ? '' : 's'}`
                    : linked.length > 0 ? 'Pagamentos registrados' : 'Sem pedidos'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">Criada</p>
                <p className="mt-1 text-sm font-bold text-zinc-300">
                  {(() => {
                    const createdAt = canonicalRouteDate(route);

                    return createdAt
                      ? new Date(createdAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'America/Sao_Paulo',
                        })
                      : 'Sem horário';
                  })()}
                </p>
              </div>
            </div>
          </button>
        );
      })}

      {rows.length > renderedRows.length && (
        <button type="button" onClick={() => setVisibleLimit(current => nextProgressiveCount(rows.length, current))} className="flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-black text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
          Mostrar mais {Math.min(OPERATION_BATCH, rows.length - renderedRows.length)} rotas · {renderedRows.length} de {rows.length}
        </button>
      )}
      {rows.length === 0 && (
        <div className="dfl-empty">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-700">
            <MapPin size={22}/>
          </div>
          <p className="mt-4 text-sm font-black text-zinc-300">Nenhuma rota encontrada</p>
          <p className="mx-auto mt-1 max-w-[250px] text-[11px] text-zinc-600">
            Não há rotas que correspondam à data e ao filtro selecionado.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {filter !== 'todas' && (
              <button onClick={() => setFilter('todas')} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-[10px] font-black text-zinc-400">
                Limpar filtro
              </button>
            )}
            {selectedDate !== today && (
              <button onClick={() => selectDate(today)} className="rounded-xl bg-emerald-500/10 px-3 py-2 text-[10px] font-black text-emerald-400">
                Ir para hoje
              </button>
            )}
          </div>
        </div>
      )}
    </div>

    {calendarOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onClick={() => setCalendarOpen(false)}><div className="w-full max-w-sm rounded-[30px] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
      <div className="mb-5 flex items-center justify-between"><CalendarButton onClick={() => setCalendarMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1))} icon={ChevronLeft}/><div className="text-center"><p className="font-heading text-base font-black capitalize text-zinc-100">{calendarMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</p><button onClick={() => selectDate(today)} className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Ir para hoje</button></div><CalendarButton onClick={() => setCalendarMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1))} icon={ChevronRight}/></div>
      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-zinc-600">{['D','S','T','Q','Q','S','S'].map((label,index) => <span key={`${label}-${index}`} className="pb-2">{label}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">{calendarDays.map(day => { const key=dateKey(day); const active=key===selectedDate; const current=day.getMonth()===calendarMonth.getMonth(); return <button key={key} onClick={() => selectDate(key)} className={`relative flex aspect-square items-center justify-center rounded-xl text-xs font-bold ${active?'bg-emerald-500 text-zinc-950':key===today?'bg-emerald-500/10 text-emerald-400':current?'text-zinc-300':'text-zinc-700'}`}>{day.getDate()}{datesWithRoutes.has(key)&&<span className={`absolute bottom-1 h-1 w-1 rounded-full ${active?'bg-zinc-950':'bg-emerald-400'}`}/>}</button>})}</div>
      <button onClick={() => setCalendarOpen(false)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-xs font-bold text-zinc-400"><X size={15}/>Fechar calendário</button>
    </div></div>}
  </div>;
}


function CompactMetric({
  value,
  label,
  tone = 'gray',
}: {
  value: number;
  label: string;
  tone?: 'gray' | 'sky' | 'green';
}) {
  const color =
    tone === 'sky'
      ? 'text-sky-400'
      : tone === 'green'
        ? 'text-emerald-400'
        : 'text-zinc-300';

  return (
    <div className="min-w-0 flex-1">
      <p className={`text-base font-black ${color}`}>
        {value}
      </p>
      <p className="truncate text-[8px] font-bold text-zinc-600">
        {label}
      </p>
    </div>
  );
}

function Metric({icon:Icon,value,label,tone='gray'}:{icon:typeof Bike;value:number;label:string;tone?:'gray'|'sky'|'green'}) { const style=tone==='sky'?'border-sky-500/20 bg-sky-500/5 text-sky-400':tone==='green'?'border-emerald-500/20 bg-emerald-500/5 text-emerald-400':'border-zinc-800 bg-zinc-900/50 text-zinc-400'; return <div className={`rounded-2xl border p-3 ${style}`}><Icon size={15}/><p className="mt-2 text-xl font-black text-zinc-100">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>; }
function SmallStat({value,label}:{value:string;label:string}) { return <div><p className="truncate text-sm font-bold">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>; }
function CalendarButton({onClick,icon:Icon}:{onClick:()=>void;icon:typeof ChevronLeft}) { return <button onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400"><Icon size={19}/></button>; }
