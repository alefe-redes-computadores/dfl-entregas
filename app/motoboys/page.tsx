// DFL V111 R51 — cards leves; histórico completo e autoridade de vínculo preservados.
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, ChevronRight, Search, UserCheck, UserRound, UsersRound } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { normalizeName } from '@/lib/motoboy-analytics';
import { buildMotoboyOverview } from '@/lib/motoboy-overview';

type Filter = 'ativos' | 'inativos' | 'todos';

export default function MotoboysPage() {
  const router = useRouter();
  const motoboys = useAppStore((state) => state.motoboys);
  const routes = useAppStore((state) => state.routes);
  const deliveries = useAppStore((state) => state.deliveries);
  const [filter, setFilter] = useState<Filter>('ativos');
  const [query, setQuery] = useState('');

  const items = useMemo(() => buildMotoboyOverview(motoboys, routes, deliveries), [motoboys, routes, deliveries]);
  const activeCount = useMemo(() => motoboys.reduce((n, item) => n + Number(item.active), 0), [motoboys]);
  const normalizedQuery = useMemo(() => normalizeName(query), [query]);
  const filtered = useMemo(() => items
    .filter(({motoboy}) => (filter === 'todos' || (filter === 'ativos' && motoboy.active) || (filter === 'inativos' && !motoboy.active))
      && (!normalizedQuery || normalizeName(motoboy.name).includes(normalizedQuery)))
    .sort((a, b) => a.motoboy.name.localeCompare(b.motoboy.name, 'pt-BR')),
  [filter, items, normalizedQuery]);

  return <div className="dfl-page">
    <PageHeader title="Equipe de motoboys" subtitle="Histórico, regras e acertos" to="/loja" />
    <div className="grid grid-cols-3 gap-2">
      <Metric icon={UsersRound} value={motoboys.length} label="Equipe" />
      <Metric icon={UserCheck} value={activeCount} label="Ativos" />
      <Metric icon={Bike} value={routes.length} label="Rotas" />
    </div>
    <div className="relative">
      <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar entregador" aria-label="Buscar entregador" className="dfl-search pl-11 pr-4 focus:border-emerald-500/50" />
    </div>
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Filtrar motoboys">
      {([['ativos', 'Ativos'], ['inativos', 'Inativos'], ['todos', 'Todos']] as const).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-xl py-2.5 text-xs font-bold ${filter === value ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>{label}</button>)}
    </div>
    <p className="px-1 text-[10px] font-medium text-zinc-500" aria-live="polite">{filtered.length} entregador{filtered.length === 1 ? '' : 'es'} encontrado{filtered.length === 1 ? '' : 's'}</p>
    <div className="flex flex-col gap-2.5">
      {filtered.map(({motoboy, routeCount, completed}) =>
        <button key={motoboy.id} type="button" onClick={() => router.push(`/motoboys/details?id=${encodeURIComponent(motoboy.id)}`)} className="rounded-[20px] border border-zinc-800/90 bg-zinc-900/50 p-3.5 text-left transition-transform active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${motoboy.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}><UserRound size={19} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className={`max-w-full truncate text-sm font-bold ${motoboy.active ? 'text-zinc-100' : 'text-zinc-400'}`}>{motoboy.name}</p>
                <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${motoboy.type === 'avulso' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>{motoboy.type || 'fixo'}</span>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-500">{motoboy.payment_rule ? 'Pagamento configurado' : 'Diária ainda não configurada'}</p>
            </div>
            <ChevronRight size={17} className="shrink-0 text-zinc-500" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-800/80 pt-2.5 text-center">
            <Small value={String(routeCount)} label="Rotas" />
            <Small value={String(completed)} label="Concluídas" />
            <Small value={motoboy.payment_rule ? 'Pronta' : 'Pendente'} label="Regra diária" />
          </div>
        </button>)}
      {filtered.length === 0 && <div className="dfl-empty"><Bike className="mx-auto text-zinc-700" /><p className="mt-3 text-sm text-zinc-500">Nenhum entregador encontrado.</p></div>}
    </div>
  </div>;
}

function Metric({icon: Icon, value, label}: {icon: typeof Bike; value: number; label: string}) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3"><Icon size={15} className="text-emerald-400" /><p className="mt-2 text-xl font-black">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>;
}
function Small({value, label}: {value: string; label: string}) {
  return <div><p className="truncate text-xs font-bold text-zinc-200">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>;
}
