'use client';

import { useMemo, useState } from 'react';
import { BrainCircuit, ChevronDown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { Customer, Delivery, Route } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useDeliveryIntelligence } from '@/hooks/useDeliveryIntelligence';

const normalize=(v?:string|null)=>(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');

export function RouteSequenceAdvisor({route,deliveries,customers}:{route:Route;deliveries:Delivery[];customers:Customer[]}){
  const [open,setOpen]=useState(false);
  const [applying,setApplying]=useState(false);
  const setDeliveryOrder=useAppStore(s=>s.setDeliveryOrder);
  const intelligence=useDeliveryIntelligence({lookbackDays:90,minimumSample:3,highlightLimit:3});

  const suggestion=useMemo(()=>{
    if(route.status!=='aberta'||route.started_at||route.departure_time)return null;
    const customerMap=new Map(customers.map(c=>[c.id,c]));
    const ordered=deliveries.filter(d=>!d.completed).sort((a,b)=>(a.order_index??Number.MAX_SAFE_INTEGER)-(b.order_index??Number.MAX_SAFE_INTEGER));
    if(ordered.length<3)return null;
    const patterns=intelligence.memory.routeSequences.patterns.filter(p=>p.occurrences>=3);
    if(!patterns.length)return null;
    const score=(from?:string,to?:string)=>{const a=normalize(from),b=normalize(to);if(!a||!b)return 0;return patterns.find(p=>normalize(p.fromNeighborhood)===a&&normalize(p.toNeighborhood)===b)?.occurrences||0};

    for(let index=0;index<ordered.length-2;index+=1){
      const current=ordered[index],next=ordered[index+1];
      if(current.is_urgent||next.is_urgent||current.order_locked||next.order_locked)continue;
      const from=customerMap.get(current.customer_id)?.neighborhood?.trim();
      const nextNeighborhood=customerMap.get(next.customer_id)?.neighborhood?.trim();
      if(!from)continue;
      const currentScore=score(from,nextNeighborhood);
      let best:{candidateIndex:number;candidate:Delivery;neighborhood:string;score:number}|undefined;
      for(let candidateIndex=index+2;candidateIndex<ordered.length;candidateIndex+=1){
        const candidate=ordered[candidateIndex];
        if(candidate.is_urgent||candidate.order_locked)continue;
        const neighborhood=customerMap.get(candidate.customer_id)?.neighborhood?.trim();
        if(!neighborhood)continue;
        const candidateScore=score(from,neighborhood);
        if(candidateScore>=3&&candidateScore>=currentScore+2&&(!best||candidateScore>best.score))best={candidateIndex,candidate,neighborhood,score:candidateScore};
      }
      if(!best)continue;
      const proposed=[...ordered];const [moved]=proposed.splice(best.candidateIndex,1);proposed.splice(index+1,0,moved);
      return{fromNeighborhood:from,currentNextNeighborhood:nextNeighborhood||'bairro não estruturado',candidateNeighborhood:best.neighborhood,occurrences:best.score,currentOccurrences:currentScore,proposedIds:proposed.map(i=>i.id)};
    }
    return null;
  },[customers,deliveries,intelligence.memory.routeSequences.patterns,route.departure_time,route.started_at,route.status]);

  if(!suggestion)return null;
  const apply=async()=>{if(applying)return;setApplying(true);try{await setDeliveryOrder(route.id,suggestion.proposedIds);toast.success('Sugestão aplicada.',{description:'A inteligência alterou somente a sequência. Urgências e travas foram preservadas.'})}catch(error){toast.error('Não foi possível aplicar a sugestão.',{description:error instanceof Error?error.message:undefined})}finally{setApplying(false)}};

  return <section className="mt-2 overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/[.035]">
    <button onClick={()=>setOpen(v=>!v)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-violet-500/[.04]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><BrainCircuit size={15}/></span><div className="min-w-0 flex-1"><p className="text-[8px] font-black uppercase tracking-[.16em] text-violet-400/80">Assistente de sequência</p><p className="mt-0.5 truncate text-xs font-black text-zinc-200">Há uma ordem historicamente mais coerente</p></div><ChevronDown size={15} className={`text-zinc-600 transition ${open?'rotate-180':''}`}/></button>
    {open&&<div className="border-t border-violet-500/10 px-3.5 pb-3.5 pt-3"><p className="text-[11px] leading-relaxed text-zinc-400">Depois de <strong className="text-zinc-200">{suggestion.fromNeighborhood}</strong>, o histórico aponta <strong className="text-violet-300">{suggestion.candidateNeighborhood}</strong> como sequência recorrente.</p><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-zinc-950/45 p-2.5"><p className="text-[8px] font-black uppercase text-zinc-700">Ordem atual</p><p className="mt-1 text-[10px] font-bold text-zinc-400">{suggestion.fromNeighborhood} → {suggestion.currentNextNeighborhood}</p><p className="mt-1 text-[9px] text-zinc-700">{suggestion.currentOccurrences?`${suggestion.currentOccurrences} ocorrências`:'sem padrão forte'}</p></div><div className="rounded-xl bg-violet-500/[.06] p-2.5"><p className="text-[8px] font-black uppercase text-violet-400/70">Sugestão</p><p className="mt-1 text-[10px] font-bold text-violet-200">{suggestion.fromNeighborhood} → {suggestion.candidateNeighborhood}</p><p className="mt-1 text-[9px] text-violet-400/70">{suggestion.occurrences} ocorrências</p></div></div><p className="mt-3 text-[9px] leading-relaxed text-zinc-600">O aplicativo não altera sua rota sozinho. Urgências continuam prioritárias e entregas travadas não entram na sugestão.</p><button disabled={applying} onClick={apply} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-500/15 text-[10px] font-black text-violet-300 disabled:opacity-50"><Sparkles size={14}/>{applying?'Aplicando...':'Aplicar somente esta sugestão'}</button></div>}
  </section>
}
