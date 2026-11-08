'use client';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Award, CalendarClock, ChevronRight, Info, Search, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';
import { isOperationalCustomer } from '@/lib/customer-analytics';
import { buildCustomerIntelligence } from '@/lib/customer-intelligence';
import { customerReviewLabel } from '@/lib/customer-review';
import type { Delivery } from '@/types';

const money = (x:number)=>x.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
type Filter = 'todos'|'observacao'|'vip'|'frequente'|'formacao';
function IntelligenceContent() {
  const router = useRouter();
  const requested = useSearchParams().get('cliente');
  const owner = useAppStore(s=>s.user);
  const customers = useAppStore(s=>s.customers);
  const deliveries = useAppStore(s=>s.deliveries);
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState<Filter>('todos');
  const [limit,setLimit] = useState(24);
  const [opened,setOpened] = useState<string|null>(requested);
  const byCustomer = useMemo(()=>{
    const grouped=new Map<string,Delivery[]>();
    for(const delivery of deliveries) {
      const key=delivery.customer_id;
      if(!key)continue;
      const group=grouped.get(key);
      if(group)group.push(delivery);else grouped.set(key,[delivery]);
    }
    return grouped;
  },[deliveries]);
  const rows = useMemo(()=>customers
    .filter(c=>!isOperationalCustomer(c) && c.exclude_from_analytics!==true)
    .map(customer=>({customer,insight:buildCustomerIntelligence(customer,byCustomer.get(customer.id)||[])}))
    .sort((a,b)=>b.insight.completed-a.insight.completed||a.customer.name.localeCompare(b.customer.name,'pt-BR')),
  [byCustomer,customers]);
  const shown = useMemo(()=>{
    const q=query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return rows.filter(({customer,insight})=>{
      if(q&&!customer.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q))return false;
      if(filter==='observacao')return customer.operational_review?.state==='observacao';
      if(filter==='vip')return insight.tier==='VIP por recorrência';
      if(filter==='frequente')return insight.tier==='Frequente';
      if(filter==='formacao')return insight.score===null;
      return true;
    });
  },[rows,query,filter]);
  if (!isSuperadminUid(owner?.uid)) return <div className="dfl-page p-5 text-sm text-zinc-400"><ShieldCheck className="mb-3 text-amber-400"/>A Inteligência de Clientes está disponível somente para o proprietário.</div>;
  const tabs: {id:Filter;label:string}[]=[{id:'todos',label:'Todos'},{id:'observacao',label:'Em observação'},{id:'vip',label:'VIP'},{id:'frequente',label:'Frequentes'},{id:'formacao',label:'Em formação'}];
  const reviewed=rows.filter(x=>x.customer.operational_review?.state==='observacao').length;
  const repeat=rows.filter(x=>x.insight.tier==='Frequente'||x.insight.tier==='VIP por recorrência').length;
  return <div className="dfl-page mx-auto max-w-3xl space-y-4 pb-28">
    <header className="flex items-start gap-3"><button onClick={()=>router.push('/clientes')} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300" aria-label="Voltar aos clientes"><ArrowLeft size={19}/></button><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-sky-300">DFL Intelligence · operação assistida</p><h1 className="mt-1 font-heading text-xl font-black text-zinc-100">Inteligência de Clientes</h1><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Histórico real, relacionamento e acompanhamento humano — sem decisões automáticas.</p></div></header>
    <section className="grid grid-cols-3 gap-2" aria-label="Resumo da carteira"><div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3"><UsersRound size={16} className="text-sky-300"/><b className="mt-1 block text-lg text-zinc-100 tabular-nums">{rows.length}</b><span className="text-[10px] text-zinc-500">Clientes elegíveis</span></div><div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[.04] p-3"><Award size={16} className="text-emerald-300"/><b className="mt-1 block text-lg text-zinc-100 tabular-nums">{repeat}</b><span className="text-[10px] text-zinc-500">Recorrentes</span></div><div className="rounded-2xl border border-amber-500/20 bg-amber-500/[.04] p-3"><ShieldCheck size={16} className="text-amber-300"/><b className="mt-1 block text-lg text-zinc-100 tabular-nums">{reviewed}</b><span className="text-[10px] text-zinc-500">Em observação</span></div></section>
    <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/><input type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(24);}} placeholder="Buscar cliente" aria-label="Buscar clientes por nome" className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-10 pr-3 text-xs text-zinc-100"/></div>
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label="Filtros de inteligência">{tabs.map(tab=><button type="button" key={tab.id} onClick={()=>{setFilter(tab.id);setLimit(24);}} aria-pressed={filter===tab.id} className={`min-h-10 shrink-0 rounded-xl border px-3 text-[11px] font-bold ${filter===tab.id?'border-sky-500/40 bg-sky-500/10 text-sky-200':'border-zinc-800 text-zinc-400'}`}>{tab.label}</button>)}</div>
    <section className="space-y-2" aria-label="Clientes analisados">{shown.slice(0,limit).map(({customer,insight})=>{
      const selected=opened===customer.id;
      const review=customer.operational_review;
      return <article key={customer.id} className={`rounded-[20px] border p-3.5 ${review?.state==='observacao'?'border-amber-500/25 bg-amber-500/[.03]':'border-zinc-800 bg-zinc-900/45'}`}>
        <button type="button" onClick={()=>setOpened(selected?null:customer.id)} aria-expanded={selected} className="flex w-full min-w-0 items-start gap-3 text-left"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300"><Sparkles size={18}/></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-zinc-100">{customer.name}</strong><span className="mt-1 block text-[11px] text-zinc-400">{insight.completed} pedido(s) concluído(s) · {insight.tier}</span>{review?.state==='observacao'&&<span className="mt-1 inline-flex rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-200">Em observação · revisão humana</span>}</span><span className="shrink-0 text-right"><strong className="block text-sm tabular-nums text-sky-200">{insight.score===null?'—':`${insight.score}/100`}</strong><span className="text-[9px] text-zinc-500">Comercial</span><ChevronRight size={14} className={`ml-auto mt-1 text-zinc-500 transition-transform ${selected?'rotate-90':''}`}/></span></button>
        {selected&&<div className="mt-3 space-y-3 border-t border-zinc-800 pt-3"><div className="grid grid-cols-2 gap-2 text-[11px]"><div className="rounded-xl bg-zinc-950/60 p-2.5 text-zinc-400">Cobrado em concluídos<strong className="mt-1 block text-zinc-100">{money(insight.totalCharged)}</strong></div><div className="rounded-xl bg-zinc-950/60 p-2.5 text-zinc-400">Ticket médio<strong className="mt-1 block text-zinc-100">{insight.completed?money(insight.averageTicket):'Sem histórico'}</strong></div><div className="rounded-xl bg-zinc-950/60 p-2.5 text-zinc-400">Pagamento mais comum<strong className="mt-1 block text-zinc-100">{insight.mostUsedPayment||'Não identificado'}</strong></div><div className="rounded-xl bg-zinc-950/60 p-2.5 text-zinc-400">Horário mais comum<strong className="mt-1 block text-zinc-100">{insight.mostCommonHour===null?'Sem dados':`${String(insight.mostCommonHour).padStart(2,'0')}:00`}</strong></div></div><p className="text-[10px] text-zinc-500">Último pedido concluído com data válida: {insight.lastCompletedAt?new Date(insight.lastCompletedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'desconhecido'}.</p><p className="text-[10px] text-zinc-500">Estado operacional: {customerReviewLabel(review?.state)}. {review?.reason?`Motivo registrado: ${review.reason}`:'Sem motivo de observação ativo.'}</p><button type="button" onClick={()=>router.push(`/clientes/details?id=${encodeURIComponent(customer.id)}`)} className="min-h-11 w-full rounded-xl border border-sky-500/25 bg-sky-500/10 text-xs font-bold text-sky-200">Abrir ficha, contatos e histórico</button></div>}
      </article>;
    })}{shown.length>limit&&<button type="button" onClick={()=>setLimit(v=>v+24)} className="min-h-11 w-full rounded-xl border border-zinc-700 text-xs text-zinc-300">Mostrar mais · {limit} de {shown.length}</button>}{!shown.length&&<p className="rounded-2xl border border-dashed border-zinc-800 p-5 text-center text-xs text-zinc-400">Nenhum cliente nesta seleção.</p>}</section>
    <details className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-3"><summary className="cursor-pointer text-xs font-bold text-sky-200"><Info size={14} className="mr-1 inline"/>Como interpretar estes indicadores</summary><p className="mt-2 text-[11px] leading-relaxed text-zinc-400">O score mede relacionamento a partir de compras concluídas, frequência, meses ativos e recência. Sem compras elegíveis aparece “Em formação”, não zero como julgamento. VIP por recorrência não substitui etiquetas comerciais manuais. Estado Em observação exige registro humano e não bloqueia entrega. Padrões de horário e pagamento só aparecem quando existem dados; não representam preferência declarada nem prova de risco.</p><p className="mt-2 text-[11px] text-zinc-500">Produtos habituais e endereços alternativos dependem de fontes estruturadas confiáveis; nenhuma inferência será exibida como fato sem essa validação.</p></details>
  </div>;
}
export default function CustomerIntelligencePage(){return <Suspense fallback={<div className="dfl-page p-4 text-xs text-zinc-400">Carregando inteligência…</div>}><IntelligenceContent/></Suspense>;}
