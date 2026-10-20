 'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronDown, ChevronRight, CreditCard, Package, Search, ShoppingBag, X } from 'lucide-react';
import type { Delivery } from '@/types';
import { operationalAttentionTasks, type AttentionKind } from '@/lib/operational-attention';

const labels: Record<AttentionKind, string> = {
  site_confirmation: 'Site · confirmar comercialmente',
  site_dispatch: 'Site · montar rota',
  pix_pending: 'Pix · verificar pagamento',
  collect: 'Cobrança na entrega',
};
const actionLabels: Record<AttentionKind,string> = {site_confirmation:'Abrir caixa de entrada',site_dispatch:'Abrir entregas',pix_pending:'Conferir financeiro',collect:'Conferir cobrança'};
const statusStyles: Record<AttentionKind, string> = {
  site_confirmation: 'text-amber-300 bg-amber-400/10',
  site_dispatch: 'text-sky-300 bg-sky-400/10',
  pix_pending: 'text-violet-300 bg-violet-400/10',
  collect: 'text-emerald-300 bg-emerald-400/10',
};
const money = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const kindPriority: Record<AttentionKind,number> = {site_confirmation:0,pix_pending:1,site_dispatch:2,collect:3};
export function OperationalAttentionQueue({orders,selectedDateKey,onFinance}:{orders:readonly Delivery[];selectedDateKey:string;onFinance:()=>void}) {
  const router=useRouter();
  const [expanded,setExpanded]=useState(false);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<AttentionKind|'all'>('all');const [showAll,setShowAll]=useState(false);
  const [additionalLimit,setAdditionalLimit]=useState(20);
  const tasks=useMemo(()=>operationalAttentionTasks(orders).sort((a,b)=>kindPriority[a.kind]-kindPriority[b.kind] || a.customer.localeCompare(b.customer,'pt-BR')),[orders]);
  const counts=useMemo(()=>tasks.reduce((acc,task)=>{acc[task.kind]++;return acc;},{site_confirmation:0,site_dispatch:0,pix_pending:0,collect:0} as Record<AttentionKind,number>),[tasks]);
  const effectiveFilter = filter !== 'all' && counts[filter] === 0 ? 'all' : filter;
  const visible=useMemo(()=>{
    const normalized=query.trim().replace(/^#(?=\d)/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
    return tasks.filter(task=>{
      if(effectiveFilter!=='all' && task.kind!==effectiveFilter)return false;
      if(!normalized)return true;
      const compactOrder=task.orderRef.replace(/[^\d]/g,'');
      if(/^\d+$/.test(normalized.replace(/\s/g,'')) && compactOrder.includes(normalized.replace(/\s/g,'')))return true;
      const haystack=[task.customer,task.orderRef,task.address,labels[task.kind]]
        .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
      return normalized.split(/\s+/).every(token=>haystack.includes(token));
    });
  },[tasks,effectiveFilter,query]);
  // Expansão em lotes: nunca montar dezenas/centenas de ações em um único toque.
  const shown=showAll?visible.slice(0,additionalLimit):visible.slice(0,8);
  const remaining=Math.max(0,visible.length-shown.length);
  const hasActiveSearch=Boolean(query.trim())||effectiveFilter!=='all';
  if(!tasks.length)return null;
  const entries: {kind:AttentionKind;icon:typeof ShoppingBag}[]=[{kind:'site_confirmation',icon:ShoppingBag},{kind:'site_dispatch',icon:Package},{kind:'pix_pending',icon:AlertCircle},{kind:'collect',icon:CreditCard}];
  const navigate=(kind:AttentionKind)=>{
    if(kind==='site_confirmation')router.push('/loja/caixa-de-entrada');
    else if(kind==='site_dispatch')router.push(`/entregas?date=${encodeURIComponent(selectedDateKey)}`);
    else onFinance();
  };
  return <section className="overflow-hidden rounded-[22px] border border-amber-500/20 bg-gradient-to-br from-amber-500/[.07] to-zinc-900/30" aria-label="Pendências operacionais">
    <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} aria-controls="dfl-operational-attention-details" className="flex w-full items-center gap-2.5 p-3.5 text-left">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-300"><AlertCircle size={18}/></span>
      <span className="min-w-0 flex-1"><strong className="block text-[13px] font-black text-zinc-100">Pontos para conferir</strong><span className="block text-[10px] text-zinc-500">{tasks.length} {tasks.length===1?'ação pendente':'ações pendentes'} · {new Set(tasks.map(task=>task.deliveryId)).size} pedidos · toque para conferir</span></span>
      <ChevronDown size={17} className={`text-zinc-400 transition-transform ${expanded?'rotate-180':''}`}/>
    </button>
    {expanded&&<div id="dfl-operational-attention-details" className="border-t border-zinc-800/80 px-3.5 pb-3.5 pt-3">
      <div className="flex gap-1.5 overflow-x-auto overscroll-contain pb-1" role="group" aria-label="Filtrar pendências">
        <button type="button" aria-pressed={effectiveFilter==='all'} onClick={()=>{setFilter('all');setShowAll(false)}} className={`min-h-10 shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] font-bold ${effectiveFilter==='all'?'border-zinc-500 bg-zinc-700/60 text-white':'border-zinc-800 text-zinc-400'}`}>Todas · {tasks.length}</button>
        {entries.map(({kind})=>{const count=counts[kind];return count>0?<button key={kind} type="button" aria-pressed={effectiveFilter===kind} onClick={()=>{setFilter(kind);setShowAll(false)}} className={`min-h-10 shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] font-bold ${effectiveFilter===kind?'border-amber-500/50 bg-amber-500/10 text-amber-200':'border-zinc-800 text-zinc-400'}`}>{labels[kind].split(' · ')[0]} · {count}</button>:null;})}
      </div>
      <div className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-zinc-700/80 bg-zinc-950/60 px-3 focus-within:border-amber-500/60">
        <Search size={16} className="shrink-0 text-zinc-400" aria-hidden="true" />
        <input aria-label="Buscar pendência por cliente, pedido ou endereço" value={query} onChange={event=>{setQuery(event.target.value);setShowAll(false)}} placeholder="Cliente, pedido ou endereço" className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500" />
        {query&&<button type="button" onClick={()=>{setQuery('');setShowAll(false)}} aria-label="Limpar busca de pendências" className="grid min-h-9 min-w-9 place-items-center text-zinc-400"><X size={16}/></button>}
      </div>
      {hasActiveSearch&&<div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-zinc-900/70 px-2 py-1.5"><span className="truncate text-[10px] text-zinc-400">Filtro ativo · {effectiveFilter==='all'?'Todas':labels[effectiveFilter]}</span><button type="button" onClick={()=>{setFilter('all');setQuery('');setShowAll(false)}} className="min-h-9 shrink-0 rounded-lg border border-zinc-700 px-3 text-[10px] font-bold text-zinc-200">Limpar filtros</button></div>}
      <p role="status" aria-live="polite" className="mt-2 text-[11px] text-zinc-400">{visible.length} {visible.length===1?'ação encontrada':'ações encontradas'} · {new Set(visible.map(item=>item.deliveryId)).size} pedidos</p>
      <div className="mt-2.5 max-h-[min(48dvh,440px)] space-y-2 overflow-y-auto overscroll-contain pr-0.5" aria-label="Lista de pendências filtradas">
      {shown.map(task=><button key={task.key} type="button" onClick={()=>navigate(task.kind)} aria-label={`${labels[task.kind]} · ${task.customer} · ${money(task.amount)} · ${actionLabels[task.kind]}`} className="flex min-h-16 w-full items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/35 px-3 py-2.5 text-left transition-colors hover:border-zinc-700 active:bg-zinc-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
        <span className="min-w-0 flex-1"><span className={`inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-black ${statusStyles[task.kind]}`}>{labels[task.kind]}</span><strong className="mt-1 block truncate text-xs font-bold text-zinc-100">{task.customer}{task.orderRef?` · #${task.orderRef.slice(-10)}`:''}</strong><span className="mt-0.5 block truncate text-[10px] text-zinc-500">{task.address||'Endereço não informado'}<span className="ml-1 font-semibold text-zinc-300">· {money(task.amount)}</span></span></span>
        <span className="flex max-w-[40%] shrink-0 flex-col items-end gap-1"><span className="text-right text-[10px] font-bold leading-tight text-zinc-300">{actionLabels[task.kind]}</span><ChevronRight size={16} className="text-zinc-500"/></span>
      </button>)}
      </div>
      {!visible.length&&<div role="status" className="mt-2 rounded-xl border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-400">Nenhuma pendência encontrada. Ajuste a busca ou selecione “Todas”.</div>}
      {visible.length>8&&<button type="button" aria-expanded={showAll} onClick={()=>{if(!showAll){setShowAll(true);setAdditionalLimit(20)}else if(remaining>0){setAdditionalLimit(limit=>limit+20)}else{setShowAll(false);setAdditionalLimit(20)}}} className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 text-xs font-bold text-zinc-200">{showAll?(remaining>0?`Ver mais ${Math.min(20,remaining)} ações · ${shown.length} de ${visible.length}`:'Mostrar menos'):`Ver mais ações · ${visible.length} no total`}</button>}
      <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">Confirmação comercial pertence ao DFL Site. Os atalhos abrem a tela responsável; nenhuma ação é executada automaticamente.</p>
    </div>}
  </section>;
}
