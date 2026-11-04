'use client';
import { Bike, CheckCircle2, Clock3, ChevronRight, Package, ShieldAlert } from 'lucide-react';
import type { Delivery } from '@/types';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';

export function OwnerTrackingCard({delivery,active,onClick}:{delivery:Delivery;active:boolean;onClick:()=>void}) {
  const cancelled=isCancelledSiteDelivery(delivery);
  const source=delivery.source_system==='dfl_site'?'Site':delivery.origin==='ifood'?'iFood':delivery.origin==='food99'?'99Food':'Loja / Manual';
  const ended=delivery.completed===true;
  const StatusIcon=cancelled?ShieldAlert:ended?CheckCircle2:delivery.route_id?Bike:Clock3;
  const state=cancelled?'Cancelado':ended?'Concluído no aplicativo':delivery.route_id?'Alocado na rota':'Aguardando rota';
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors active:bg-zinc-800/70 ${active?'border-cyan-500/50 bg-cyan-500/10':'border-zinc-800 bg-zinc-900/45'}`}>
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-cyan-300"><Package size={19}/></div>
    <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-zinc-100">Pedido {delivery.order_id||delivery.external_order_id||delivery.id}</div><div className="mt-0.5 truncate text-[11px] text-zinc-400">{source} · {delivery.customer_name||'Cliente'}</div><div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500"><StatusIcon size={12}/>{state}</div></div>
    <ChevronRight size={17} className="shrink-0 text-zinc-500"/>
  </button>;
}
