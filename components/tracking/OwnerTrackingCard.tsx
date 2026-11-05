'use client';
import { Bike, CheckCircle2, ChevronRight, Clock3, Package, ShieldAlert } from 'lucide-react';
import type { Delivery } from '@/types';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';

type Origin = 'site'|'ifood'|'food99'|'manual';
const palette:Record<Origin,{label:string;accent:string;tag:string;active:string}>={
  site:{label:'Site',accent:'text-sky-300 bg-sky-500/10',tag:'text-sky-300 border-sky-500/30',active:'border-sky-500/50 bg-sky-500/[.06]'},
  ifood:{label:'iFood',accent:'text-red-300 bg-red-500/10',tag:'text-red-300 border-red-500/30',active:'border-red-500/50 bg-red-500/[.06]'},
  food99:{label:'99Food',accent:'text-amber-300 bg-amber-500/10',tag:'text-amber-300 border-amber-500/30',active:'border-amber-500/50 bg-amber-500/[.06]'},
  manual:{label:'Loja',accent:'text-emerald-300 bg-emerald-500/10',tag:'text-emerald-300 border-emerald-500/30',active:'border-emerald-500/50 bg-emerald-500/[.06]'},
};
export function OwnerTrackingCard({delivery,active,onClick}:{delivery:Delivery;active:boolean;onClick:()=>void}) {
  const cancelled=isCancelledSiteDelivery(delivery);
  const origin:Origin=delivery.source_system==='dfl_site'?'site':delivery.origin==='ifood'?'ifood':delivery.origin==='food99'?'food99':'manual';
  const theme=palette[origin];
  const ended=delivery.completed===true;
  const StatusIcon=cancelled?ShieldAlert:ended?CheckCircle2:delivery.route_id?Bike:Clock3;
  const state=cancelled?'Cancelado':ended?'Concluído':delivery.route_id?'Em rota':'Sem rota';
  const rawId=String(delivery.order_id||delivery.external_order_id||delivery.id);
  const displayId=rawId.length>28?rawId.slice(0,18)+'…'+rawId.slice(-5):rawId;
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors active:bg-zinc-800/70 ${active?theme.active:'border-zinc-800 bg-zinc-950/45'}`}>
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${theme.accent}`}><Package size={18}/></span>
    <span className="min-w-0 flex-1"><span className="flex min-w-0 flex-wrap items-center gap-1.5"><span className="min-w-0 max-w-full truncate text-xs font-black text-zinc-100">Pedido {displayId}</span><span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${theme.tag}`}>{theme.label}</span></span><span className="mt-0.5 block truncate text-[11px] text-zinc-400">{delivery.customer_name||'Cliente não informado'}</span><span className="mt-1 inline-flex items-center gap-1 text-[10px] text-zinc-500"><StatusIcon size={12}/>{state}</span></span>
    <ChevronRight size={16} className={`shrink-0 ${active?'text-zinc-200':'text-zinc-600'}`}/>
  </button>;
}
