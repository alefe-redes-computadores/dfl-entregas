// app/motoboys/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, ChevronRight, CircleDollarSign, Search, UserCheck, UserRound, UsersRound } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { getMotoboyRoutes, normalizeName } from '@/lib/motoboy-analytics';

type Filter='ativos'|'inativos'|'todos';
export default function MotoboysPage(){
  const router=useRouter();const motoboys=useAppStore(state=>state.motoboys);const routes=useAppStore(state=>state.routes);const deliveries=useAppStore(state=>state.deliveries);const [filter,setFilter]=useState<Filter>('ativos');const [query,setQuery]=useState('');
  const items=useMemo(()=>motoboys.map(motoboy=>{const linkedRoutes=getMotoboyRoutes(motoboy,routes);const routeIds=new Set(linkedRoutes.map(route=>route.id));const linkedDeliveries=deliveries.filter(delivery=>routeIds.has(delivery.route_id));return {motoboy,routes:linkedRoutes,deliveries:linkedDeliveries,completed:linkedDeliveries.filter(delivery=>delivery.completed).length};}),[deliveries,motoboys,routes]);
  const filtered=useMemo(()=>items.filter(({motoboy})=>(filter==='todos'||(filter==='ativos'&&motoboy.active)||(filter==='inativos'&&!motoboy.active))&&(!query.trim()||normalizeName(motoboy.name).includes(normalizeName(query)))).sort((a,b)=>a.motoboy.name.localeCompare(b.motoboy.name,'pt-BR')),[filter,items,query]);
  return <div className="flex flex-col gap-5 pb-28"><PageHeader title="Equipe de motoboys" subtitle="Histórico, regras e acertos" to="/loja"/>
    <div className="grid grid-cols-3 gap-2"><Metric icon={UsersRound} value={motoboys.length} label="Equipe"/><Metric icon={UserCheck} value={motoboys.filter(item=>item.active).length} label="Ativos"/><Metric icon={Bike} value={routes.length} label="Rotas"/></div>
    <div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar entregador" className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900/55 pl-11 pr-4 text-sm outline-none focus:border-sky-500"/></div>
    <div className="grid grid-cols-3 gap-2">{([['ativos','Ativos'],['inativos','Inativos'],['todos','Todos']] as const).map(([value,label])=><button key={value} onClick={()=>setFilter(value)} className={`rounded-xl py-2.5 text-xs font-bold ${filter===value?'bg-zinc-100 text-zinc-950':'border border-zinc-800 bg-zinc-900/50 text-zinc-500'}`}>{label}</button>)}</div>
    <div className="flex flex-col gap-3">{filtered.map(({motoboy,routes:linkedRoutes,completed})=><button key={motoboy.id} onClick={()=>router.push(`/motoboys/details?id=${motoboy.id}`)} className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-4 text-left active:scale-[.99]"><div className="flex items-center gap-3"><div className={`flex h-12 w-12 items-center justify-center rounded-full ${motoboy.active?'bg-sky-500/10 text-sky-400':'bg-zinc-800 text-zinc-600'}`}><UserRound size={21}/></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className={`truncate font-bold ${motoboy.active?'text-zinc-100':'text-zinc-500'}`}>{motoboy.name}</p><span className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase ${motoboy.type==='avulso'?'bg-amber-500/10 text-amber-400':'bg-sky-500/10 text-sky-400'}`}>{motoboy.type||'fixo'}</span></div><p className="mt-1 text-xs text-zinc-500">{motoboy.payment_rule?'Regra de pagamento configurada':'Pagamento ainda não configurado'}</p></div><ChevronRight size={17} className="text-zinc-600"/></div><div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-800/70 pt-3 text-center"><Small value={String(linkedRoutes.length)} label="Rotas"/><Small value={String(completed)} label="Concluídas"/><Small value={motoboy.payment_rule?'Configurada':'Pendente'} label="Diária"/></div></button>)}{filtered.length===0&&<div className="rounded-3xl border border-dashed border-zinc-800 py-14 text-center"><Bike className="mx-auto text-zinc-700"/><p className="mt-3 text-sm text-zinc-500">Nenhum entregador encontrado.</p></div>}</div>
  </div>;
}
function Metric({icon:Icon,value,label}:{icon:typeof Bike;value:number;label:string}){return <div className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3"><Icon size={15} className="text-sky-400"/><p className="mt-2 text-xl font-black">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>;}
function Small({value,label}:{value:string;label:string}){return <div><p className="truncate text-xs font-bold text-zinc-200">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>;}
