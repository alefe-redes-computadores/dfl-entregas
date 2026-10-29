'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { plannedSiteDeliveries } from '@/lib/operation/site-planning-preview';

export function SitePlanningPreview(){
  const deliveries=useAppStore(state=>state.deliveries);
  const [expanded,setExpanded]=useState(false);
  const days=useMemo(()=>plannedSiteDeliveries(deliveries),[deliveries]);
  const count=days.reduce((total,day)=>total+day.orders.length,0);
  if(!count)return null;
  return <section aria-label="Prévia de pedidos agendados" className="rounded-2xl border border-sky-500/20 bg-sky-500/[.045] p-3">
    <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)} className="flex min-h-11 w-full items-center gap-2 text-left">
      <CalendarClock size={17} className="shrink-0 text-sky-300"/>
      <span className="min-w-0 flex-1"><span className="block text-xs font-black text-zinc-100">Planejamento futuro · {count} pedido{count===1?'':'s'}</span><span className="block text-[10px] text-zinc-400">Prévia somente leitura; não reserva rota nem despacha</span></span>
      <ChevronDown size={17} className={`text-sky-300 transition ${expanded?'rotate-180':''}`}/>
    </button>
    {expanded&&<div className="mt-2 space-y-3">{days.slice(0,7).map(day=><div key={day.date} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-2.5"><p className="mb-2 text-[11px] font-black text-sky-200">{new Date(`${day.date}T12:00:00-03:00`).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'short',day:'2-digit',month:'2-digit'})} · {day.orders.length} pedido{day.orders.length===1?'':'s'}</p>{day.orders.slice(0,15).map(order=><div key={order.id} className="flex gap-2 border-t border-zinc-800/70 py-2 text-[11px]"><span className="shrink-0 font-mono text-sky-300">{new Date(order.scheduled_for!).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold text-zinc-200">{order.customer_name||'Cliente'} · #{order.external_order_id||order.order_id||order.id}</span><span className="block truncate text-zinc-500">{order.address_string||'Endereço pendente de revisão'}</span></span></div>)}{day.orders.length>15&&<p className="text-[10px] text-zinc-500">Mais {day.orders.length-15} pedidos neste dia; consulte a Caixa.</p>}</div>)}{days.length>7&&<p className="text-[10px] text-zinc-500">Mostrando os próximos sete dias com pedidos; demais agendamentos continuam na Caixa.</p>}<p className="flex gap-2 text-[10px] text-zinc-400"><ShieldCheck size={14} className="shrink-0 text-sky-300"/>O vínculo antecipado com uma rota ainda não é permitido. Esta prévia não libera pedidos comerciais e não envia notificações.</p></div>}
  </section>;
}
