'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, CheckCircle2, ChevronRight, Clock3, MapPin, Package, Plus, Search, Timer, User } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

type Filter = 'todas' | 'montando' | 'na-rua' | 'finalizadas';

const getRouteDate = (route: { created_at?: string; started_at?: string; departure_time?: string; updated_at?: string }) =>
  route.created_at || route.started_at || route.departure_time || route.updated_at || '';

const formatDateTime = (value?: string) => value
  ? new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : 'Horário não registrado';

export default function RoutesPage() {
  const router = useRouter();
  const routes = useAppStore((state) => state.routes);
  const deliveries = useAppStore((state) => state.deliveries);
  const [filter, setFilter] = useState<Filter>('todas');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => routes.map((route) => {
    const linked = deliveries.filter((delivery) => delivery.route_id === route.id);
    const completed = linked.filter((delivery) => delivery.completed).length;
    const amount = linked.reduce((sum, delivery) => sum + (delivery.value || 0), 0);
    const state: Exclude<Filter, 'todas'> = route.status === 'fechada' ? 'finalizadas' : route.started_at ? 'na-rua' : 'montando';
    return { route, linked, completed, amount, state };
  }).filter(({ route, state }) => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    const matchesFilter = filter === 'todas' || state === filter;
    const matchesQuery = !normalized || `${route.name} ${route.motoboy_name}`.toLocaleLowerCase('pt-BR').includes(normalized);
    return matchesFilter && matchesQuery;
  }).sort((a, b) => new Date(getRouteDate(b.route) || 0).getTime() - new Date(getRouteDate(a.route) || 0).getTime()), [deliveries, filter, query, routes]);

  const counts = useMemo(() => ({
    montando: routes.filter((route) => route.status === 'aberta' && !route.started_at).length,
    rua: routes.filter((route) => route.status === 'aberta' && route.started_at).length,
    finalizadas: routes.filter((route) => route.status === 'fechada').length,
  }), [routes]);

  return (
    <div className="flex flex-col gap-5 pb-28">
      <div className="flex items-center justify-between">
        <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-500">Operação</p><h1 className="font-heading text-2xl font-bold text-zinc-50">Rotas</h1></div>
        <button onClick={() => router.push('/rotas/nova')} className="flex h-11 items-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-bold text-zinc-950 active:scale-95"><Plus size={18}/> Nova</button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3"><Clock3 size={15} className="text-zinc-400"/><p className="mt-2 text-xl font-black">{counts.montando}</p><p className="text-[10px] text-zinc-500">Montando</p></div>
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3"><Bike size={15} className="text-sky-400"/><p className="mt-2 text-xl font-black">{counts.rua}</p><p className="text-[10px] text-zinc-500">Na rua</p></div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3"><CheckCircle2 size={15} className="text-emerald-400"/><p className="mt-2 text-xl font-black">{counts.finalizadas}</p><p className="text-[10px] text-zinc-500">Finalizadas</p></div>
      </div>

      <div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar rota ou motoboy" className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-11 pr-4 text-sm outline-none focus:border-emerald-500"/></div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">{([['todas','Todas'],['montando','Montando'],['na-rua','Na rua'],['finalizadas','Finalizadas']] as const).map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold ${filter === value ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>{label}</button>)}</div>

      <div className="flex flex-col gap-3">
        {rows.map(({ route, linked, completed, amount, state }) => (
          <button key={route.id} onClick={() => router.push(`/rotas/details?id=${route.id}`)} className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-4 text-left active:scale-[0.99]">
            <div className="flex items-start gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${state === 'na-rua' ? 'bg-sky-500/15 text-sky-400' : state === 'finalizadas' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}><Bike size={20}/></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate font-heading text-base font-bold">{route.name}</p><ChevronRight size={17} className="shrink-0 text-zinc-600"/></div><p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400"><User size={12}/>{route.motoboy_name}</p></div></div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-800/70 pt-3 text-center"><div><p className="text-sm font-bold">{completed}/{linked.length}</p><p className="text-[10px] text-zinc-500">Entregas</p></div><div><p className="text-sm font-bold">R$ {amount.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p><p className="text-[10px] text-zinc-500">Valor bruto</p></div><div><p className="truncate text-xs font-bold">{formatDateTime(getRouteDate(route))}</p><p className="text-[10px] text-zinc-500">Criada</p></div></div>
          </button>
        ))}
        {rows.length === 0 && <div className="rounded-3xl border border-dashed border-zinc-800 py-16 text-center"><MapPin className="mx-auto text-zinc-700"/><p className="mt-3 text-sm text-zinc-500">Nenhuma rota encontrada.</p></div>}
      </div>
    </div>
  );
}
