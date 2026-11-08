'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Boxes, CheckCircle2, ChevronRight, ClipboardList, MapPin, Route, Search, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';
import { isOperationalCustomer } from '@/lib/customer-analytics';
import { auditNeighborhoods } from '@/lib/operation/neighborhood-intelligence';
import { customerPaymentGuidance } from '@/lib/operation/customer-payment-guidance';
import type { Delivery } from '@/types';

type Area='resumo'|'clientes'|'dados'|'operacao';
const tabs:readonly {id:Area;label:string}[]=[{id:'resumo',label:'Geral'},{id:'clientes',label:'Clientes'},{id:'dados',label:'Dados'},{id:'operacao',label:'Operação'}];

export default function IntelligenceHub(){
  const router=useRouter();
  const user=useAppStore(s=>s.user);
  const customers=useAppStore(s=>s.customers);
  const deliveries=useAppStore(s=>s.deliveries);
  const routes=useAppStore(s=>s.routes);
  const stock=useAppStore(s=>s.stockProducts);
  const [active,setActive]=useState<Area>('resumo');
  const [search,setSearch]=useState('');
  const [limit,setLimit]=useState(20);
  const insights=useMemo(()=>{
    const byCustomer=new Map<string,Delivery[]>();
    for(const d of deliveries){if(!d.customer_id)continue;const group=byCustomer.get(d.customer_id)||[];group.push(d);byCustomer.set(d.customer_id,group);}
    const eligible=customers.filter(c=>!isOperationalCustomer(c)&&c.exclude_from_analytics!==true);
    const reviews=eligible.filter(c=>c.operational_review?.state==='observacao')
      .map(c=>({customer:c,guidance:customerPaymentGuidance(c,byCustomer.get(c.id)||[])}))
      .sort((a,b)=>Number(b.guidance.level==='prepaid_recommended')-Number(a.guidance.level==='prepaid_recommended'));
    return {reviews,neighborhoods:auditNeighborhoods(eligible),
      queued:deliveries.filter(d=>!d.completed&&!d.route_id).length,
      routesOnStreet:routes.filter(r=>r.status==='aberta'&&Boolean(r.started_at||r.departure_time)).length,
      stockCount:stock.length};
  },[customers,deliveries,routes,stock]);
  if(!isSuperadminUid(user?.uid))return <main className="dfl-page p-5 text-zinc-300"><ShieldCheck className="mb-2 text-amber-300"/><p className="text-sm">A DFL Intelligence é restrita à administração.</p></main>;
  const visible=insights.reviews.filter(row=>row.customer.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(search.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));
  const prepaid=insights.reviews.filter(x=>x.guidance.level==='prepaid_recommended').length;
  return <main className="dfl-page mx-auto max-w-3xl space-y-4 pb-[calc(env(safe-area-inset-bottom)+100px)]">
    <header className="flex items-center gap-3"><button type="button" aria-label="Voltar" onClick={()=>router.push('/mais')} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300"><ArrowLeft size={18}/></button><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">Centro de decisões · assistido</p><h1 className="font-heading text-xl font-black text-zinc-50">DFL Intelligence</h1><p className="text-[11px] text-zinc-400">Recomendações explicáveis. Nenhuma ação automática.</p></div></header>
    <nav aria-label="Áreas de inteligência" className="grid grid-cols-4 gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-1.5">{tabs.map(tab=><button key={tab.id} type="button" aria-pressed={active===tab.id} onClick={()=>setActive(tab.id)} className={`min-h-11 rounded-xl px-1 text-[10px] font-bold ${active===tab.id?'bg-violet-500/15 text-violet-200':'text-zinc-400'}`}>{tab.label}</button>)}</nav>
    {active==='resumo'&&<div className="space-y-3"><div className="grid grid-cols-2 gap-2"><div className="rounded-2xl border border-amber-500/20 bg-amber-500/[.04] p-3"><AlertTriangle size={16} className="text-amber-300"/><b className="mt-2 block text-xl text-zinc-100">{insights.reviews.length}</b><p className="text-[11px] text-zinc-400">Clientes em observação</p></div><div className="rounded-2xl border border-sky-500/20 bg-sky-500/[.04] p-3"><MapPin size={16} className="text-sky-300"/><b className="mt-2 block text-xl text-zinc-100">{insights.neighborhoods.length}</b><p className="text-[11px] text-zinc-400">Grupos de bairros para conferir</p></div></div>
      {prepaid>0&&<button type="button" onClick={()=>setActive('clientes')} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 text-left"><ShieldCheck size={18} className="shrink-0 text-amber-300"/><span className="min-w-0 flex-1 text-xs text-amber-100"><strong>{prepaid} recomendação(ões) de pagamento antecipado</strong><small className="mt-1 block text-[10px] text-amber-100/70">Com ocorrência financeira documentada e registro ainda sem confirmação</small></span><ChevronRight size={16}/></button>}
      <button type="button" onClick={()=>router.push('/clientes/inteligencia')} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 text-left text-xs text-zinc-200"><span className="flex items-center gap-2"><UsersRound size={17} className="text-violet-300"/> Abrir inteligência de relacionamento</span><ChevronRight size={15}/></button>
      <button type="button" onClick={()=>router.push('/relatorios')} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 text-left text-xs text-zinc-200"><span className="flex items-center gap-2"><ClipboardList size={17} className="text-sky-300"/> Relatórios históricos e indicadores</span><ChevronRight size={15}/></button>
      <p className="text-[11px] text-zinc-500">Este painel não substitui Relatórios, Financeiro ou a confirmação real do pagamento.</p></div>}
    {active==='clientes'&&<section className="space-y-2"><p className="text-xs leading-relaxed text-zinc-400">Uma ocorrência isolada nunca bloqueia venda. A recomendação financeira exige revisão humana ativa, ocorrência vinculada a pedido e recebimento ainda não confirmado.</p>
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-zinc-500"><Search size={15}/><input value={search} onChange={e=>{setSearch(e.target.value);setLimit(20);}} placeholder="Buscar cliente observado" className="min-w-0 flex-1 bg-transparent text-xs text-zinc-100 outline-none"/></label>
      {visible.slice(0,limit).map(({customer,guidance})=><article key={customer.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3.5"><p className="text-xs font-black text-zinc-100">{customer.name}</p><p className={`mt-2 text-xs font-bold ${guidance.level==='prepaid_recommended'?'text-amber-300':'text-sky-300'}`}>{guidance.title}</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{guidance.explanation}</p><button type="button" onClick={()=>router.push(`/clientes/details?id=${encodeURIComponent(customer.id)}`)} className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl bg-zinc-800/60 px-3 text-xs font-bold text-sky-200">Conferir ficha, ocorrência e pagamento <ChevronRight size={15}/></button></article>)}
      {visible.length>limit&&<button type="button" onClick={()=>setLimit(x=>x+20)} className="min-h-11 w-full rounded-xl border border-zinc-800 text-xs text-zinc-300">Mostrar mais</button>}{!visible.length&&<p className="rounded-xl border border-dashed border-zinc-800 p-5 text-xs text-zinc-500">Nenhuma observação corresponde a esta busca.</p>}</section>}
    {active==='dados'&&<section className="space-y-3"><p className="text-xs text-zinc-400">As grafias reconhecidas são consolidadas apenas nas métricas. Outras ficam pendentes de conferência. Nenhum endereço é alterado aqui.</p><div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-zinc-800 p-3"><b className="text-lg text-zinc-100">{insights.neighborhoods.length}</b><p className="text-[10px] text-zinc-400">Grupos para conferir</p></div><div className="rounded-xl border border-zinc-800 p-3"><b className="text-lg text-zinc-100">{insights.neighborhoods.reduce((sum,x)=>sum+x.customers,0)}</b><p className="text-[10px] text-zinc-400">Cadastros envolvidos</p></div></div><button type="button" onClick={()=>router.push('/relatorios')} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 text-xs font-bold text-sky-200">Abrir Dados e auditoria de bairros <ChevronRight size={15}/></button></section>}
    {active==='operacao'&&<section className="space-y-3"><div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"><Route size={17} className="text-sky-300"/><b className="mt-2 block text-xl text-zinc-100">{insights.routesOnStreet}</b><p className="text-[10px] text-zinc-400">Rotas em andamento</p></div><div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"><Boxes size={17} className="text-emerald-300"/><b className="mt-2 block text-xl text-zinc-100">{insights.stockCount}</b><p className="text-[10px] text-zinc-400">Produtos cadastrados</p></div></div><p className="text-[11px] text-zinc-500">Pedidos ainda não vinculados: {insights.queued}. Contagem de referência; não representa alerta nem prova de atraso.</p><button type="button" onClick={()=>router.push('/')} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 text-xs text-zinc-200">Abrir operação e rotas <ChevronRight size={15}/></button><button type="button" onClick={()=>router.push('/relatorios')} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 text-xs text-zinc-200">Ver indicadores de operação <ChevronRight size={15}/></button></section>}
    <footer className="flex items-start gap-2 rounded-xl border border-zinc-800 p-3 text-[10px] leading-relaxed text-zinc-500"><CheckCircle2 size={15} className="shrink-0 text-violet-300"/>DFL Intelligence observa dados já carregados. Não abre novas consultas repetitivas, não envia mensagens e não classifica pessoas como fraudulentas.</footer>
  </main>;
}
