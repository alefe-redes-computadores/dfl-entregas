'use client';

import { AlertTriangle, CheckCircle2, ChevronRight, MapPin, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Delivery, Route } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { buildOperationalReadiness } from '@/lib/operational-readiness';

export function OperationalCommandCenter({routes,deliveries}:{routes:Route[];deliveries:Delivery[]}){
  const router=useRouter();
  const customers=useAppStore(s=>s.customers);
  const backlog=useAppStore(s=>s.ifoodPendingConfirmations);
  const openRoutes=routes.filter(r=>r.status==='aberta');
  const pending=deliveries.filter(d=>!d.completed);
  const readiness=buildOperationalReadiness({deliveries,routes,customers});
  const missingCode=pending.filter(d=>d.origin==='ifood'&&!d.confirmation_code?.replace(/\D/g,'').length);
  const externalPending=backlog.filter(i=>(i.status||'pending')==='pending');
  const hasProgress=openRoutes.some(r=>Boolean(r.started_at||r.departure_time));
  const waiting=openRoutes.some(r=>!r.started_at&&!r.departure_time);
  const firstRoutePending=externalPending.find(i=>i.route_id);
  const confirmationHref=firstRoutePending?.route_id?`/confirmacoes?route=${encodeURIComponent(firstRoutePending.route_id)}&routeName=${encodeURIComponent(firstRoutePending.route_name||'Rota finalizada')}`:'/confirmacoes';

  const rows=[
    {key:'address',label:'Entrega sem endereço',description:'Corrija antes de montar a rota',count:readiness.missingAddress.length,href:'/entregas',icon:AlertTriangle,tone:'text-red-400'},
    {key:'location',label:'Localização precisa ser validada',description:readiness.routesWithLocationReview.size===1?'1 rota pode perder qualidade na organização':`${readiness.routesWithLocationReview.size} rotas podem perder qualidade na organização`,count:readiness.unconfirmedLocation.length,href:'/rotas',icon:MapPin,tone:'text-amber-300'},
    {key:'code',label:'iFood sem código',description:'Pedido ainda não está pronto para confirmação',count:missingCode.length,href:'/confirmacoes',icon:ShieldAlert,tone:'text-amber-300'},
    {key:'external',label:'Confirmar pedidos no iFood',description:'Entrega concluída não significa confirmação no portal',count:externalPending.length,href:confirmationHref,icon:ShieldAlert,tone:'text-red-400'},
  ].filter(i=>i.count>0);

  const issues=rows.reduce((sum,i)=>sum+i.count,0);
  const title=externalPending.length>0&&openRoutes.length===0?'Pendências pós-rota':waiting&&!hasProgress?'Atenção antes da saída':'Atenção na operação';

  return <section className={`overflow-hidden rounded-[22px] border ${issues?'border-amber-500/20 bg-amber-500/[.035]':'border-emerald-500/15 bg-emerald-500/[.025]'}`}>
    <div className="flex items-center gap-3 p-3.5"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[14px] ${issues?'bg-amber-500/10 text-amber-300':'bg-emerald-500/10 text-emerald-400'}`}>{issues?<AlertTriangle size={17}/>:<CheckCircle2 size={17}/>}</span><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.17em] text-zinc-600">Agora</p><p className="mt-0.5 text-sm font-black text-zinc-100">{issues?title:'Operação dentro do padrão'}</p><p className="mt-1 text-[10px] text-zinc-600">{openRoutes.length} rota{openRoutes.length===1?'':'s'} aberta{openRoutes.length===1?'':'s'} · {pending.length} pendente{pending.length===1?'':'s'}</p></div>{issues>0&&<span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-black text-amber-300">{issues} ajuste{issues===1?'':'s'}</span>}</div>
    {rows.length>0&&<div className="border-t border-zinc-800/70 px-2.5 pb-2.5 pt-2">{rows.map(({key,label,description,count,href,icon:Icon,tone})=><button key={key} onClick={()=>router.push(href)} className="flex w-full items-center gap-3 rounded-[16px] px-2 py-2.5 text-left active:bg-zinc-900/60"><Icon size={15} className={`shrink-0 ${tone}`}/><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-black text-zinc-300">{label}</span><span className="mt-0.5 block truncate text-[9px] text-zinc-600">{description}</span></span><span className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-black text-zinc-400">{count}</span><ChevronRight size={14} className="text-zinc-700"/></button>)}</div>}
  </section>
}
