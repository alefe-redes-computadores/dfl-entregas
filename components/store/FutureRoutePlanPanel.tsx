'use client';
import { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ShieldCheck, Route as RouteIcon } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { futureRoutePlan } from '@/lib/operation/future-route-planning';
import { OPERATION_FIRST_BATCH, nextProgressiveCount } from '@/lib/operation/progressiveWindow';

export function FutureRoutePlanPanel(){
  const deliveries=useAppStore(s=>s.deliveries);
  const routes=useAppStore(s=>s.routes);
  const reserve=useAppStore(s=>s.reserveFutureSiteRoute);
  const [busy,setBusy]=useState<string|null>(null);
  const [choices,setChoices]=useState<Record<string,string>>({});
  const commit=async(id:string,routeId:string|null)=>{
    if(busy)return;
    setBusy(id);
    try { await reserve(id,routeId);toast.success(routeId?'Reserva de rota salva. Sem despacho.':'Reserva removida.'); }
    catch(e){toast.error('Planejamento nao salvo.',{description:e instanceof Error?e.message:'Revise a conexao e tente novamente.'});}
    finally {setBusy(null);}
  };
  const [expanded,setExpanded]=useState(false);
  const [limit,setLimit]=useState(OPERATION_FIRST_BATCH);
  const [clock,setClock]=useState(()=>Date.now());
  const entries=useMemo(()=>futureRoutePlan(deliveries,routes,clock),[deliveries,routes,clock]);
  return <section aria-label="Prévia de rotas futuras" className="rounded-[20px] border border-sky-500/20 bg-sky-500/[.045] p-3.5">
    <button type="button" aria-expanded={expanded} onClick={()=>{setExpanded(v=>!v);setClock(Date.now());}} className="flex min-h-11 w-full items-center gap-2 text-left">
      <CalendarClock size={18} className="shrink-0 text-sky-300"/>
      <span className="min-w-0 flex-1"><span className="block text-xs font-black text-zinc-100">Prévia de rotas futuras</span><span className="block text-[10px] text-zinc-400">{entries.length} pedido{entries.length===1?'':'s'} aprovado{entries.length===1?'':'s'} aguardando horário</span></span>
      <ChevronDown size={17} className={`text-zinc-400 ${expanded?'rotate-180':''}`}/>
    </button>
    {expanded&&<div className="mt-3 space-y-2">
      <p className="rounded-xl border border-sky-500/15 p-2.5 text-[11px] leading-relaxed text-zinc-300"><ShieldCheck size={14} className="mr-1 inline text-sky-300"/>Reserva operacional separada da alocação: não muda a rota real, não libera nem despacha o pedido e não envia notificação. O vínculo de entrega continua bloqueado até o horário.</p>
      {!entries.length&&<p className="p-3 text-xs text-zinc-400">Não há pedidos futuros aprovados para planejar.</p>}
      {entries.slice(0,limit).map(({delivery,date,candidates,issue})=><div key={delivery.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-bold text-zinc-100">{delivery.customer_name||'Cliente do Site'}</p><p className="font-mono text-[10px] text-zinc-500">#{delivery.external_order_id||delivery.order_id||delivery.id}</p></div><span className="shrink-0 text-[10px] font-bold text-sky-300">{date}</span></div>
        <p className="mt-1.5 text-[11px] text-zinc-400">{delivery.scheduled_label||new Date(delivery.scheduled_for!).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'})}</p>
        {issue?<p className="mt-2 text-[10px] font-bold text-amber-300">{issue}</p>:<p className="mt-2 flex items-center gap-1 text-[10px] text-zinc-400"><RouteIcon size={13}/>{candidates.length?`${candidates.length} rota${candidates.length===1?'':'s'} futura${candidates.length===1?'':'s'} aberta${candidates.length===1?'':'s'} para avaliar`:'Ainda sem rota aberta nessa data'}</p>}
        {candidates.length>0&&!issue&&<p className="mt-1 truncate text-[10px] text-zinc-500">{candidates.slice(0,3).map(r=>r.name).join(' · ')}{candidates.length>3?' · …':''}</p>}
        {!issue&&<div className="mt-3 space-y-2 rounded-xl border border-sky-500/15 bg-sky-500/[.035] p-2.5">
          {delivery.planned_route_id&&<p className="text-[10px] font-bold text-sky-200">Reserva atual: {candidates.find(r=>r.id===delivery.planned_route_id)?.name||'Rota indisponível — revisar'} · sem despacho</p>}
          {candidates.length>0&&<select aria-label="Escolher rota futura" value={choices[delivery.id]||''} onChange={e=>setChoices(v=>({...v,[delivery.id]:e.target.value}))} className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"><option value="">Selecione a rota futura</option>{candidates.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>}
          {candidates.length>0&&<button type="button" disabled={Boolean(busy)||!choices[delivery.id]} onClick={()=>void commit(delivery.id,choices[delivery.id])} className="min-h-11 w-full rounded-xl border border-sky-500/30 bg-sky-500/10 text-xs font-bold text-sky-200 disabled:opacity-40">{busy===delivery.id?'Salvando reserva…':'Reservar rota futura'}</button>}
          {delivery.planned_route_id&&<button type="button" disabled={Boolean(busy)} onClick={()=>void commit(delivery.id,null)} className="min-h-10 w-full rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 disabled:opacity-40">Desfazer reserva</button>}
        </div>}
      </div>)}
      {entries.length>limit&&<button type="button" onClick={()=>setLimit(v=>nextProgressiveCount(entries.length,v))} className="min-h-11 w-full rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300">Mostrar mais · {Math.min(limit,entries.length)} de {entries.length}</button>}
    </div>}
  </section>;
}
