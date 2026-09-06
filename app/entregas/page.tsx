// app/entregas/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, Filter, MapPin, Package, Plus, Search, Smartphone, Store, UserRound } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

type StatusFilter = 'todas' | 'pendentes' | 'concluidas' | 'incompletas';
type OriginFilter = 'todas' | 'ifood' | 'loja';

const getCreatedAt = (delivery: { created_at?: string; createdAt?: string; updated_at?: string }) => delivery.created_at || delivery.createdAt || delivery.updated_at;
const dayKey = (value?: string) => value ? new Date(value).toLocaleDateString('pt-BR') : 'Data desconhecida';
const normalize = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function DeliveriesPage() {
  const router = useRouter();
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);
  const customers = useAppStore((state) => state.customers);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('todas');
  const [origin, setOrigin] = useState<OriginFilter>('todas');

  const rows = useMemo(() => deliveries.map((delivery) => {
    const route = routes.find((item) => item.id === delivery.route_id);
    const customer = customers.find((item) => item.id === delivery.customer_id);
    const incomplete = !delivery.route_id || !route || !delivery.address_string || (delivery.origin === 'ifood' && !delivery.order_id);
    const haystack = normalize([customer?.name, delivery.customer_name, customer?.phone, delivery.phone, delivery.address_string, delivery.order_id, delivery.ifood_id, delivery.confirmation_code, route?.name, route?.motoboy_name].join(' '));
    return { delivery, route, customer, incomplete, haystack };
  }).filter(({ delivery, incomplete, haystack }) => {
    const matchesQuery = !query.trim() || haystack.includes(normalize(query));
    const matchesOrigin = origin === 'todas' || delivery.origin === origin;
    const matchesStatus = status === 'todas' || (status === 'pendentes' && !delivery.completed) || (status === 'concluidas' && delivery.completed) || (status === 'incompletas' && incomplete);
    return matchesQuery && matchesOrigin && matchesStatus;
  }).sort((a, b) => new Date(getCreatedAt(b.delivery) || 0).getTime() - new Date(getCreatedAt(a.delivery) || 0).getTime()), [customers, deliveries, origin, query, routes, status]);

  const groups = useMemo(() => rows.reduce<Record<string, typeof rows>>((acc, row) => {
    const key = dayKey(getCreatedAt(row.delivery));
    (acc[key] ||= []).push(row);
    return acc;
  }, {}), [rows]);

  const totals = useMemo(() => ({
    all: deliveries.length,
    pending: deliveries.filter((item) => !item.completed).length,
    completed: deliveries.filter((item) => item.completed).length,
  }), [deliveries]);

  return <div className="flex flex-col gap-5 pb-28">
    <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-500">Histórico operacional</p><h1 className="font-heading text-2xl font-bold text-zinc-50">Entregas</h1></div><button onClick={() => router.push('/entregas/nova')} className="flex h-11 items-center gap-2 rounded-2xl bg-amber-500 px-4 text-sm font-black text-zinc-950 active:scale-95"><Plus size={18}/>Nova</button></div>
    <div className="grid grid-cols-3 gap-2"><Metric icon={Package} label="Total" value={totals.all} color="text-sky-400"/><Metric icon={Clock3} label="Pendentes" value={totals.pending} color="text-amber-400"/><Metric icon={CheckCircle2} label="Concluídas" value={totals.completed} color="text-emerald-400"/></div>
    <div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Cliente, pedido, telefone ou endereço" className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900/55 pl-11 pr-4 text-sm outline-none focus:border-amber-500"/></div>
    <div className="flex gap-2 overflow-x-auto no-scrollbar"><Filter size={16} className="mt-2.5 shrink-0 text-zinc-600"/>{([['todas','Todas'],['pendentes','Pendentes'],['concluidas','Concluídas'],['incompletas','Com atenção']] as const).map(([value,label])=><button key={value} onClick={()=>setStatus(value)} className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold ${status===value?'bg-zinc-100 text-zinc-950':'border border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>{label}</button>)}</div>
    <div className="grid grid-cols-2 gap-2">{(['todas','ifood','loja'] as OriginFilter[]).map(value=><button key={value} onClick={()=>setOrigin(value)} className={`rounded-xl border py-2 text-xs font-bold ${origin===value?'border-amber-500/50 bg-amber-500/10 text-amber-400':'border-zinc-800 text-zinc-500'} ${value==='todas'?'col-span-2':''}`}>{value==='todas'?'Todas as origens':value==='ifood'?'iFood':'Loja própria'}</button>)}</div>
    {Object.entries(groups).map(([date, items])=><section key={date} className="space-y-2"><div className="flex items-center justify-between px-1"><h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">{date}</h2><span className="text-[11px] text-zinc-600">{items.length} entrega(s)</span></div>{items.map(({delivery,route,customer,incomplete})=><button key={delivery.id} onClick={()=>router.push(`/entregas/details?id=${delivery.id}`)} className="w-full rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-4 text-left active:scale-[0.99]"><div className="flex items-start gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${delivery.origin==='ifood'?'bg-red-500/10 text-red-400':'bg-emerald-500/10 text-emerald-400'}`}>{delivery.origin==='ifood'?<Smartphone size={19}/>:<Store size={19}/>}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-bold text-zinc-100">{customer?.name || delivery.customer_name || 'Cliente não informado'}</p>{incomplete&&<AlertTriangle size={14} className="shrink-0 text-amber-400"/>}</div><p className="mt-1 truncate text-xs text-zinc-500"><MapPin size={11} className="mr-1 inline"/>{delivery.address_string || 'Endereço ausente'}</p><div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400">{route?.name || 'Sem rota'}</span>{route?.motoboy_name&&<span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400"><UserRound size={10} className="mr-1 inline"/>{route.motoboy_name}</span>}<span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${delivery.completed?'bg-emerald-500/10 text-emerald-400':'bg-amber-500/10 text-amber-400'}`}>{delivery.completed?'Concluída':'Pendente'}</span></div></div><div className="shrink-0 text-right"><p className="text-sm font-black text-emerald-400">R$ {(delivery.value||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</p><ChevronRight size={16} className="ml-auto mt-3 text-zinc-600"/></div></div></button>)}</section>)}
    {rows.length===0&&<div className="rounded-3xl border border-dashed border-zinc-800 py-16 text-center"><Package className="mx-auto text-zinc-700"/><p className="mt-3 text-sm text-zinc-500">Nenhuma entrega encontrada.</p></div>}
  </div>;
}

function Metric({icon:Icon,label,value,color}:{icon:typeof Package;label:string;value:number;color:string}){return <div className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3"><Icon size={15} className={color}/><p className="mt-2 text-xl font-black">{value}</p><p className="truncate text-[10px] text-zinc-500">{label}</p></div>}
