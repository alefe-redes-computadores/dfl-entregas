'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ClipboardCopy, ChevronDown, MapPin, PackageCheck } from 'lucide-react';
import type { Delivery } from '@/types';
import { briefingText, routeStopBriefing } from '@/lib/operation/route-stop-briefing';
import { toast } from '@/lib/operational-toast';

/** Painel opcional de conferencia. Nenhum listener, escrita, geocodificacao ou mutacao. */
export function RouteStopBriefing({ deliveries, routeName }: { deliveries: Delivery[]; routeName: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const stops = useMemo(() => routeStopBriefing(deliveries), [deliveries]);
  const pending = stops.filter((stop) => stop.pending > 0);
  const warnings = pending.filter((stop) => stop.needsAddress || stop.missingIfoodCode);
  if (deliveries.length === 0) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(briefingText(stops, routeName));
      toast.success('Resumo das paradas copiado.');
    } catch { toast.error('Não foi possível copiar o resumo.'); }
  };
  return (
    <section className="rounded-2xl border border-sky-500/15 bg-sky-500/[.035] p-3" aria-label="Conferência das paradas">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300"><PackageCheck size={17}/></span>
        <div className="min-w-0 flex-1"><strong className="block text-xs text-zinc-100">Conferência das paradas</strong><p className="text-[10px] text-zinc-400">{pending.length} paradas pendentes · {pending.reduce((n,s)=>n+s.pending,0)} pedidos · {warnings.length} com atenção</p></div>
        <button type="button" onClick={()=>void copy()} aria-label="Copiar resumo das paradas" className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 text-zinc-300"><ClipboardCopy size={16}/></button>
        <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} aria-label={expanded?'Recolher paradas':'Mostrar paradas'} className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 text-zinc-300"><ChevronDown size={17} className={expanded?'rotate-180':''}/></button>
      </div>
      {expanded && <div className="mt-3 space-y-2">
        {pending.length===0 ? <p className="text-xs text-emerald-300"><CheckCircle2 size={14} className="mr-1 inline"/>Todas as paradas concluídas.</p> : pending.map((stop,i)=><article key={stop.key} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex items-start gap-2"><span className="rounded-lg bg-zinc-800 px-2 py-1 text-[10px] font-black">{i+1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-zinc-100">{stop.title} {stop.urgent?'· URGENTE':''}</p><p className="mt-1 text-[11px] text-zinc-400">{stop.address}</p><p className="mt-1 text-[10px] text-zinc-500">{stop.pending} pendente(s) · {stop.completed} concluído(s){stop.orderIds.length ? ` · ${stop.orderIds.map(id=>'#'+id).join(' / ')}`:''}</p></div></div>
          {(stop.needsAddress||stop.missingIfoodCode>0||stop.needsLocation)&&<div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">{stop.needsAddress&&<span className="rounded-lg bg-amber-500/10 px-2 py-1 text-amber-300"><AlertTriangle size={11} className="mr-1 inline"/>Conferir endereço</span>}{stop.missingIfoodCode>0&&<span className="rounded-lg bg-amber-500/10 px-2 py-1 text-amber-300">Código iFood pendente</span>}{stop.needsLocation&&<span className="rounded-lg bg-zinc-800 px-2 py-1 text-zinc-400"><MapPin size={11} className="mr-1 inline"/>Sem link de mapa</span>}</div>}
          {(stop.needsAddress||stop.missingIfoodCode>0)&&<button type="button" onClick={()=>router.push(`/entregas/editar?id=${encodeURIComponent(stop.deliveryIds[0])}`)} className="mt-2 min-h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 text-[11px] font-bold text-sky-200">Revisar entrega</button>}
        </article>)}
      </div>}
    </section>
  );
}
