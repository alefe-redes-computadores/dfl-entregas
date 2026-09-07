// app/clientes/details/page.tsx
'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bike, ChevronLeft, ChevronRight, Clock3, Edit3, Hash, MapPin, MessageCircle, Navigation, PackageOpen, ShoppingBag, Smartphone, Store, UserRound } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getCustomerStats, getDeliveryCreatedAt } from '@/lib/customer-analytics';
import { CustomerOperationalMemory } from '@/components/intelligence/EntityOperationalMemory';
import { firstValidTimestamp } from '@/lib/reports/time';
import {
  fulfillmentLabel,
  fulfillmentOperationalLabel,
  getFulfillmentMode,
  isDeliveryFulfillment,
} from '@/lib/delivery-mode';

const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const phoneMask=(value:string)=>{const digits=value.replace(/\D/g,'');return digits.length===11?`(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`:value;};

function CustomerDetailsContent(){
  const router=useRouter();
  const id=useSearchParams().get('id');
  const customer=useAppStore(state=>state.customers.find(item=>item.id===id));
  const deliveries=useAppStore(state=>state.deliveries);
  const routes=useAppStore(state=>state.routes);
  if(!customer)return <div className="py-20 text-center"><p className="font-bold text-zinc-200">Cliente não encontrado</p><button onClick={()=>router.push('/clientes')} className="mt-4 text-sm font-bold text-emerald-400">Voltar aos clientes</button></div>;
  const stats=getCustomerStats(customer,deliveries);
  const mapsUrl=customer.maps_link||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address||customer.neighborhood||'Patos de Minas, MG')}`;
  return <div className="flex flex-col gap-5 pb-28">
    <header className="flex items-center gap-3"><button onClick={()=>router.push('/clientes')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400"><ChevronLeft size={21}/></button><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-500">Ficha do cliente</p><h1 className="truncate font-heading text-xl font-bold text-zinc-50">{customer.name}</h1></div><button onClick={()=>router.push(`/clientes/editar?id=${customer.id}`)} className="flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-3 text-xs font-black text-zinc-950"><Edit3 size={15}/>Editar</button></header>
    <section className="rounded-[26px] border border-zinc-800 bg-zinc-900/45 p-5"><div className="flex items-center gap-3"><div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${(customer.origin||'ifood')==='ifood'?'bg-red-500/10 text-red-400':'bg-emerald-500/10 text-emerald-400'}`}><UserRound size={25}/></div><div><p className="flex items-center gap-1.5 text-xs font-bold uppercase text-zinc-500">{(customer.origin||'ifood')==='ifood'?<Smartphone size={13}/>:<Store size={13}/>}Origem principal: {(customer.origin||'ifood')==='ifood'?'iFood':'Loja'}</p>{customer.phone&&<p className="mt-1 font-bold text-zinc-200">{phoneMask(customer.phone)}</p>}</div></div><div className="mt-5 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-4 text-center"><Stat value={String(stats.orderCount)} label="Pedidos"/><Stat value={money(stats.totalValue)} label="Valor"/><Stat value={money(stats.averageTicket)} label="Ticket"/></div></section>
    <div className="grid grid-cols-2 gap-3"><button disabled={!customer.phone} onClick={()=>window.open(`https://wa.me/55${customer.phone?.replace(/\D/g,'')}`,'_blank')} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-black text-zinc-950 disabled:opacity-40"><MessageCircle size={18}/>WhatsApp</button><button onClick={()=>window.open(mapsUrl,'_blank')} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 font-black text-white"><Navigation size={18}/>Maps</button></div>
    <section className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40">{customer.address&&<Info icon={MapPin} label="Endereço principal" value={customer.address}/>} {customer.neighborhood&&<Info icon={MapPin} label="Bairro" value={customer.neighborhood}/>} {customer.last_confirmation_code&&<Info icon={Hash} label="Último código iFood" value={customer.last_confirmation_code}/>} {customer.observation&&<Info icon={MessageCircle} label="Observações" value={customer.observation}/>}</section>
    <CustomerOperationalMemory customerId={customer.id}/>
    <section><div className="mb-3 flex items-end justify-between px-1"><div><h2 className="font-heading text-lg font-bold text-zinc-100">Histórico de pedidos</h2><p className="text-xs text-zinc-500">{stats.completedCount} concluídos • {stats.pendingCount} pendentes</p></div><PackageOpen size={19} className="text-indigo-400"/></div><div className="flex flex-col gap-2">{stats.deliveries.map(delivery=>{const route=routes.find(item=>item.id===delivery.route_id);const mode=getFulfillmentMode(delivery);const logistics=isDeliveryFulfillment(delivery);const ModeIcon=mode==='pickup'?ShoppingBag:mode==='counter'?Store:Bike;const operationalContext=logistics?(route?`${route.name} • ${route.motoboy_name}`:'Entrega sem rota vinculada'):fulfillmentOperationalLabel(delivery);return <button key={delivery.id} onClick={()=>router.push(`/entregas/details?id=${delivery.id}`)} className="rounded-[20px] border border-zinc-800 bg-zinc-900/45 p-4 text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><p className="truncate font-bold text-zinc-200">{delivery.order_id?`Pedido #${delivery.order_id}`:'Pedido da loja'}</p><span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/70 px-1.5 py-0.5 text-[9px] font-bold text-zinc-400"><ModeIcon size={9}/>{fulfillmentLabel(delivery)}</span></div><p className={`mt-1 truncate text-xs ${logistics&&!route?'font-bold text-amber-400':'text-zinc-500'}`}>{operationalContext}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-600"><Clock3 size={11}/>{(() => {
  const createdAt = firstValidTimestamp(getDeliveryCreatedAt(delivery));
  return createdAt
    ? createdAt.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      })
    : 'Data não registrada';
})()}</p></div><div className="text-right"><p className="text-sm font-black text-emerald-400">{money(delivery.value||0)}</p><span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-[9px] font-bold ${delivery.completed?'bg-emerald-500/10 text-emerald-400':'bg-amber-500/10 text-amber-400'}`}>{delivery.completed?'Concluído':'Pendente'}</span><ChevronRight size={15} className="ml-auto mt-2 text-zinc-600"/></div></div></button>})}{stats.deliveries.length===0&&<div className="rounded-3xl border border-dashed border-zinc-800 py-12 text-center"><PackageOpen className="mx-auto text-zinc-700"/><p className="mt-3 text-sm text-zinc-500">Nenhum pedido vinculado.</p></div>}</div></section>
  </div>;
}

function Stat({value,label}:{value:string;label:string}){return <div><p className="truncate text-sm font-black text-zinc-100">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>;}
function Info({icon:Icon,label,value}:{icon:typeof MapPin;label:string;value:string}){return <div className="flex gap-3 border-b border-zinc-800/80 p-4 last:border-0"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400"><Icon size={16}/></div><div><p className="text-[10px] font-bold uppercase text-zinc-500">{label}</p><p className="mt-1 text-sm font-semibold text-zinc-200">{value}</p></div></div>;}
export default function CustomerDetailsPage(){return <Suspense fallback={<p className="py-20 text-center text-zinc-500">Carregando cliente...</p>}><CustomerDetailsContent/></Suspense>;}
