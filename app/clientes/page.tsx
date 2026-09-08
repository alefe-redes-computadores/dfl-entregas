// app/clientes/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Crown, MapPin, MessageCircle, PackageOpen, Plus, Search, Smartphone, Store, Trophy, UserRound } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getCustomerStats, isOperationalCustomer, normalizeCustomerName } from '@/lib/customer-analytics';

type Filter = 'todos'|'ifood'|'loja'|'com-pedidos'|'sem-pedidos';
const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const phoneMask=(value?:string)=>{const digits=(value||'').replace(/\D/g,'');return digits.length===11?`(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`:value||'';};

export default function CustomersPage(){
  const router=useRouter();
  const customers=useAppStore(state=>state.customers);
  const deliveries=useAppStore(state=>state.deliveries);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<Filter>('todos');

  const items=useMemo(()=>customers.map(customer=>({customer,stats:getCustomerStats(customer,deliveries)})),[customers,deliveries]);
  const ranked=useMemo(()=>[...items].filter(item=>item.stats.orderCount>0&&!isOperationalCustomer(item.customer)).sort((a,b)=>b.stats.orderCount-a.stats.orderCount||b.stats.totalValue-a.stats.totalValue),[items]);
  const filtered=useMemo(()=>items.filter(({customer,stats})=>{
    const term=normalizeCustomerName(query);
    const haystack=normalizeCustomerName(`${customer.name} ${customer.phone||''} ${customer.address||''} ${customer.neighborhood||''}`);
    const origin=customer.origin||'ifood';
    return (!term||haystack.includes(term))&&(filter==='todos'||filter===origin||(filter==='com-pedidos'&&stats.orderCount>0)||(filter==='sem-pedidos'&&stats.orderCount===0));
  }).sort((a,b)=>a.customer.name.localeCompare(b.customer.name,'pt-BR')),[filter,items,query]);
  const maxOrders=ranked[0]?.stats.orderCount||1;

  return <div className="flex flex-col gap-5 pb-28">
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => router.replace('/loja')}
          aria-label="Voltar para Minha Loja"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-300 active:scale-95"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-500">
            Relacionamento
          </p>
          <h1 className="truncate font-heading text-2xl font-bold text-zinc-50">
            Clientes
          </h1>
        </div>
      </div>
      <button
        type="button"
        onClick={() => router.push('/clientes/novo')}
        className="flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-zinc-950 active:scale-95"
      >
        <Plus size={18} />
        Novo
      </button>
    </header>
    <div className="grid grid-cols-3 gap-2"><Metric value={customers.length} label="Clientes"/><Metric value={items.filter(item=>item.stats.orderCount>0).length} label="Com pedidos"/><Metric value={deliveries.length} label="Pedidos ligados"/></div>

    {ranked.length>0&&<section className="rounded-[26px] border border-amber-500/20 bg-gradient-to-b from-amber-500/[.07] to-zinc-900/35 p-4"><div className="mb-4 flex items-center justify-between"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400"><Trophy size={15}/>Quem mais pede</p><p className="mt-1 text-[11px] text-zinc-500">Calculado pelas entregas reais</p></div><span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-400">Top 5</span></div><div className="space-y-3">{ranked.slice(0,5).map(({customer,stats},index)=><button key={customer.id} onClick={()=>router.push(`/clientes/details?id=${customer.id}`)} className="block w-full text-left"><div className="flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-black ${index===0?'bg-amber-500 text-zinc-950':'bg-zinc-800 text-zinc-400'}`}>{index===0?<Crown size={12}/>:index+1}</span><span className="min-w-0 flex-1 truncate text-xs font-bold text-zinc-200">{customer.name}</span><span className="text-xs font-black text-amber-400">{stats.orderCount}</span></div><div className="ml-8 mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400" style={{width:`${Math.max(8,(stats.orderCount/maxOrders)*100)}%`}}/></div></button>)}</div></section>}

    <div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nome, telefone, endereço ou bairro" className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900/55 pl-11 pr-4 text-sm outline-none focus:border-emerald-500"/></div>
    <div className="flex gap-2 overflow-x-auto no-scrollbar">{([['todos','Todos'],['com-pedidos','Com pedidos'],['sem-pedidos','Sem pedidos'],['ifood','iFood'],['loja','Loja']] as const).map(([value,label])=><button key={value} onClick={()=>setFilter(value)} className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold ${filter===value?'bg-zinc-100 text-zinc-950':'border border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>{label}</button>)}</div>

    <div className="flex flex-col gap-3">{filtered.map(({customer,stats})=><button key={customer.id} onClick={()=>router.push(`/clientes/details?id=${customer.id}`)} className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-4 text-left active:scale-[.99]"><div className="flex items-start gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${(customer.origin||'ifood')==='ifood'?'bg-red-500/10 text-red-400':'bg-emerald-500/10 text-emerald-400'}`}><UserRound size={19}/></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-bold text-zinc-100">{customer.name}</p>{(customer.origin||'ifood')==='ifood'?<Smartphone size={13} className="text-red-400"/>:<Store size={13} className="text-emerald-400"/>}</div>{customer.phone&&<p className="mt-1 flex items-center gap-1 text-xs text-emerald-400"><MessageCircle size={11}/>{phoneMask(customer.phone)}</p>}{(customer.address||customer.neighborhood)&&<p className="mt-1 truncate text-xs text-zinc-500"><MapPin size={11} className="mr-1 inline"/>{customer.address||customer.neighborhood}</p>}</div><ChevronRight size={17} className="mt-1 text-zinc-600"/></div><div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-800/70 pt-3 text-center"><Small value={String(stats.orderCount)} label="Pedidos"/><Small value={money(stats.totalValue)} label="Valor"/><Small value={money(stats.averageTicket)} label="Ticket médio"/></div></button>)}{filtered.length===0&&<div className="rounded-3xl border border-dashed border-zinc-800 py-14 text-center"><PackageOpen className="mx-auto text-zinc-700"/><p className="mt-3 text-sm text-zinc-500">Nenhum cliente encontrado.</p></div>}</div>
  </div>;
}

function Metric({value,label}:{value:number;label:string}){return <div className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3"><p className="text-xl font-black text-zinc-100">{value}</p><p className="truncate text-[10px] text-zinc-500">{label}</p></div>;}
function Small({value,label}:{value:string;label:string}){return <div><p className="truncate text-xs font-bold text-zinc-200">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>;}
