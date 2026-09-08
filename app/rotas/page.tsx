// app/rotas/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bike, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, Search, User, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { firstValidTimestamp } from '@/lib/reports/time';

type Filter = 'todas' | 'montando' | 'na-rua' | 'finalizadas';
type DatedRoute = { created_at?: string; started_at?: string; departure_time?: string; updated_at?: string };
const routeDate = (route: DatedRoute) =>
  firstValidTimestamp(
    route.created_at,
    route.started_at,
    route.departure_time,
    route.updated_at,
  );

const routeStartedAt = (route: DatedRoute) =>
  firstValidTimestamp(route.started_at, route.departure_time);
const dateKey = (value: Date | string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const todayKey = () => dateKey(new Date());
const fromKey = (key: string) => new Date(`${key}T12:00:00-03:00`);
const shiftDay = (key: string, amount: number) => { const value = fromKey(key); value.setDate(value.getDate() + amount); return dateKey(value); };
const dayLabel = (key: string) => key === todayKey() ? 'Hoje' : fromKey(key).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replaceAll('.', '');

export default function RoutesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get('date');
  const initialDateKey = initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : todayKey();
  const routes = useAppStore(state => state.routes);
  const deliveries = useAppStore(state => state.deliveries);
  const [selectedDate, setSelectedDate] = useState(() => initialDateKey);
  const [calendarMonth, setCalendarMonth] = useState(() => fromKey(initialDateKey));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('todas');
  const [query, setQuery] = useState('');

  const dayRoutes = useMemo(() => routes.filter(route => {
    const value = routeDate(route);
    return value ? dateKey(value) === selectedDate : false;
  }), [routes, selectedDate]);

  const rows = useMemo(() => dayRoutes.map(route => {
    const linked = deliveries.filter(delivery => delivery.route_id === route.id);
    const completed = linked.filter(delivery => delivery.completed).length;
    const amount = linked.reduce((total, delivery) => total + (delivery.value || 0), 0);
    const startedAt = routeStartedAt(route);
    const state: Exclude<Filter, 'todas'> =
      route.status === 'fechada' ? 'finalizadas' : startedAt ? 'na-rua' : 'montando';
    return { route, linked, completed, amount, state };
  }).filter(({ route, state }) => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return (filter === 'todas' || state === filter) && (!term || `${route.name} ${route.motoboy_name}`.toLocaleLowerCase('pt-BR').includes(term));
  }).sort(
    (a, b) =>
      (routeDate(a.route)?.getTime() ?? Number.POSITIVE_INFINITY) -
      (routeDate(b.route)?.getTime() ?? Number.POSITIVE_INFINITY),
  ), [dayRoutes, deliveries, filter, query]);

  const counts = useMemo(() => ({
    montando: dayRoutes.filter(
      route => route.status === 'aberta' && !routeStartedAt(route),
    ).length,
    rua: dayRoutes.filter(
      route => route.status === 'aberta' && Boolean(routeStartedAt(route)),
    ).length,
    finalizadas: dayRoutes.filter(route => route.status === 'fechada').length,
  }), [dayRoutes]);

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
          .map(routeDate)
          .filter((value): value is Date => Boolean(value))
          .map(dateKey),
      ),
    [routes],
  );
  const selectDate = (key: string) => { setSelectedDate(key); setFilter('todas'); setCalendarOpen(false); };

  return <div className="flex flex-col gap-5 pb-28">
    <header className="flex items-center justify-between">
      <div className="flex min-w-0 items-center gap-3"><button onClick={() => router.replace('/loja')} aria-label="Voltar para Minha Loja" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 active:scale-95"><ChevronLeft size={20}/></button><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-emerald-500">Operação diária</p><h1 className="font-heading text-2xl font-bold text-zinc-50">Rotas</h1></div></div>
      <button onClick={() => router.push(`/rotas/nova?date=${encodeURIComponent(selectedDate)}`)} className="flex h-11 items-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-bold text-zinc-950 active:scale-95"><Plus size={18}/>Nova</button>
    </header>

    <div className="flex items-center gap-2 rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-2">
      <button onClick={() => setSelectedDate(value => shiftDay(value, -1))} className="flex h-11 w-11 items-center justify-center rounded-2xl text-zinc-500 active:bg-zinc-800"><ChevronLeft size={21}/></button>
      <button onClick={() => { setCalendarMonth(fromKey(selectedDate)); setCalendarOpen(true); }} className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-800/75 px-3"><CalendarDays size={17} className="text-emerald-400"/><span className="truncate text-sm font-black capitalize text-zinc-100">{dayLabel(selectedDate)}</span></button>
      <button onClick={() => setSelectedDate(value => shiftDay(value, 1))} className="flex h-11 w-11 items-center justify-center rounded-2xl text-zinc-500 active:bg-zinc-800"><ChevronRight size={21}/></button>
    </div>

    <div className="grid grid-cols-3 gap-2"><Metric icon={Clock3} value={counts.montando} label="Montando"/><Metric icon={Bike} value={counts.rua} label="Na rua" tone="sky"/><Metric icon={CheckCircle2} value={counts.finalizadas} label="Finalizadas" tone="green"/></div>
    <div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar neste dia" className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-11 pr-4 text-sm outline-none focus:border-emerald-500"/></div>
    <div className="flex gap-2 overflow-x-auto no-scrollbar">{([['todas','Todas'],['montando','Montando'],['na-rua','Na rua'],['finalizadas','Finalizadas']] as const).map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold ${filter === value ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>{label}</button>)}</div>

    <div className="flex flex-col gap-3">
      {rows.map(({ route, linked, completed, amount, state }) => <button key={route.id} onClick={() => router.push(`/rotas/details?id=${route.id}&date=${encodeURIComponent(selectedDate)}`)} className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-4 text-left active:scale-[0.99]">
        <div className="flex items-start gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${state === 'na-rua' ? 'bg-sky-500/15 text-sky-400' : state === 'finalizadas' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}><Bike size={20}/></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate font-heading text-base font-bold">{route.name}</p><ChevronRight size={17} className="text-zinc-600"/></div><p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400"><User size={12}/>{route.motoboy_name}</p></div></div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-800/70 pt-3 text-center"><SmallStat value={`${completed}/${linked.length}`} label="Entregas"/><SmallStat value={`R$ ${amount.toLocaleString('pt-BR',{minimumFractionDigits:2})}`} label="Valor bruto"/><SmallStat value={routeDate(route)?.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}) || 'Sem horário'} label="Criada"/></div>
      </button>)}
      {rows.length === 0 && <div className="rounded-3xl border border-dashed border-zinc-800 py-14 text-center"><MapPin className="mx-auto text-zinc-700"/><p className="mt-3 text-sm font-semibold text-zinc-400">Nenhuma rota em {dayLabel(selectedDate).toLowerCase()}.</p>{selectedDate !== todayKey() && <button onClick={() => selectDate(todayKey())} className="mt-3 text-xs font-bold text-emerald-400">Voltar para hoje</button>}</div>}
    </div>

    {calendarOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onClick={() => setCalendarOpen(false)}><div className="w-full max-w-sm rounded-[30px] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
      <div className="mb-5 flex items-center justify-between"><CalendarButton onClick={() => setCalendarMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1))} icon={ChevronLeft}/><div className="text-center"><p className="font-heading text-base font-black capitalize text-zinc-100">{calendarMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</p><button onClick={() => selectDate(todayKey())} className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Ir para hoje</button></div><CalendarButton onClick={() => setCalendarMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1))} icon={ChevronRight}/></div>
      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-zinc-600">{['D','S','T','Q','Q','S','S'].map((label,index) => <span key={`${label}-${index}`} className="pb-2">{label}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">{calendarDays.map(day => { const key=dateKey(day); const active=key===selectedDate; const current=day.getMonth()===calendarMonth.getMonth(); return <button key={key} onClick={() => selectDate(key)} className={`relative flex aspect-square items-center justify-center rounded-xl text-xs font-bold ${active?'bg-emerald-500 text-zinc-950':key===todayKey()?'bg-emerald-500/10 text-emerald-400':current?'text-zinc-300':'text-zinc-700'}`}>{day.getDate()}{datesWithRoutes.has(key)&&<span className={`absolute bottom-1 h-1 w-1 rounded-full ${active?'bg-zinc-950':'bg-emerald-400'}`}/>}</button>})}</div>
      <button onClick={() => setCalendarOpen(false)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-xs font-bold text-zinc-400"><X size={15}/>Fechar calendário</button>
    </div></div>}
  </div>;
}

function Metric({icon:Icon,value,label,tone='gray'}:{icon:typeof Bike;value:number;label:string;tone?:'gray'|'sky'|'green'}) { const style=tone==='sky'?'border-sky-500/20 bg-sky-500/5 text-sky-400':tone==='green'?'border-emerald-500/20 bg-emerald-500/5 text-emerald-400':'border-zinc-800 bg-zinc-900/50 text-zinc-400'; return <div className={`rounded-2xl border p-3 ${style}`}><Icon size={15}/><p className="mt-2 text-xl font-black text-zinc-100">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>; }
function SmallStat({value,label}:{value:string;label:string}) { return <div><p className="truncate text-sm font-bold">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>; }
function CalendarButton({onClick,icon:Icon}:{onClick:()=>void;icon:typeof ChevronLeft}) { return <button onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400"><Icon size={19}/></button>; }
