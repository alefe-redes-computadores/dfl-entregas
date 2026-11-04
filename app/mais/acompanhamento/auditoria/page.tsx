'use client';
/** R252 — explicit owner-only batch review; no timers, background reads or writes. */
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, ClipboardCheck, Filter, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { isSuperadminUid } from '@/lib/access/roles';
import { useAppStore } from '@/store/useAppStore';
import { dateKey, shiftDateKey } from '@/lib/operational-time';
import { toast } from '@/lib/operational-toast';
import { TrackingBatchAudit } from '@/components/tracking/TrackingBatchAudit';
import { auditReportText, type AuditSummary } from '@/lib/tracking/gate3/batch-audit';

type Period='today'|'7d'|'30d'|'all';
type Origin='all'|'site'|'manual'|'ifood'|'food99';
const ORIGIN='https://dfl-entregas.vercel.app';
const baseUrl=()=>Capacitor.isNativePlatform()?(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim()||ORIGIN).replace(/\/+$/,''):'';
const perPage=20;
const periods:[Period,string][]= [['today','Hoje'],['7d','7 dias'],['30d','30 dias'],['all','Todo período']];
const origins:[Origin,string][]= [['all','Todos'],['site','Site'],['manual','Loja'],['ifood','iFood'],['food99','99Food']];
function kind(d:{source_system?:string;origin?:string}):Origin{
  if(d.source_system==='dfl_site')return 'site';
  return d.origin==='ifood'?'ifood':d.origin==='food99'?'food99':'manual';
}
export default function TrackingBatchAuditPage(){
  const router=useRouter();
  const user=useAppStore(s=>s.user);
  const deliveries=useAppStore(s=>s.deliveries);
  const [period,setPeriod]=useState<Period>('7d');
  const [origin,setOrigin]=useState<Origin>('all');
  const [page,setPage]=useState(0);
  const [busy,setBusy]=useState(false);
  const [summary,setSummary]=useState<AuditSummary|null>(null);
  const [error,setError]=useState('');
  const requestCounter=useRef(0);
  const allowed=isSuperadminUid(user?.uid);
  const list=useMemo(()=>{
    const today=dateKey(new Date());
    const start=period==='all'?'':shiftDateKey(today,period==='today'?0:period==='7d'?-6:-29);
    return deliveries.filter(d=>{
      if(origin!=='all'&&kind(d)!==origin)return false;
      const raw=d.created_at||d.createdAt||'';
      if(!Number.isFinite(Date.parse(raw)))return false;
      const day=dateKey(raw);
      return day<=today&&(!start||day>=start);
    }).sort((a,b)=>Date.parse(b.created_at||b.createdAt||'')-Date.parse(a.created_at||a.createdAt||'')||a.id.localeCompare(b.id));
  },[deliveries,period,origin]);
  const pageCount=Math.max(1,Math.ceil(list.length/perPage));
  const safePage=Math.min(page,pageCount-1);
  const ids=list.slice(safePage*perPage,(safePage+1)*perPage).map(d=>d.id);
  const choosePeriod=(p:Period)=>{requestCounter.current++;setPeriod(p);setPage(0);setSummary(null);setBusy(false);setError('');};
  const chooseOrigin=(o:Origin)=>{requestCounter.current++;setOrigin(o);setPage(0);setSummary(null);setBusy(false);setError('');};
  const choosePage=(p:number)=>{requestCounter.current++;setPage(p);setSummary(null);setBusy(false);setError('');};
  const run=async()=>{
    if(!allowed||busy||!ids.length)return;
    const a=auth.currentUser;
    if(!a||!isSuperadminUid(a.uid)){toast.error('Acesso administrativo indisponível.');return;}
    const myRequest=++requestCounter.current;
    setBusy(true);setSummary(null);setError('');
    try{
      const token=await a.getIdToken();
      const response=await fetch(`${baseUrl()}/api/integration/tracking/v1/admin/audit`,{
        method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
        body:JSON.stringify({contract:'dfl.tracking.gate3.audit_request',version:1,delivery_ids:ids}),
        cache:'no-store',credentials:'omit',
      });
      if(myRequest!==requestCounter.current||auth.currentUser?.uid!==a.uid)return;
      if(!response.ok)throw new Error(`Auditoria indisponível (HTTP ${response.status}). Confirme o tenant e a autenticação.`);
      const value:unknown=await response.json();
      const result=value as {ok?:boolean;summary?:AuditSummary};
      if(!result||result.ok!==true||result.summary?.contract!=='dfl.tracking.gate3.batch_audit'||result.summary.sample_size!==ids.length)throw new Error('Resposta de auditoria inválida.');
      setSummary(result.summary);
      toast.success('Lote auditado no servidor, sem alterar pedidos.');
    }catch(e){if(myRequest===requestCounter.current){const message=e instanceof Error?e.message:'Não foi possível consultar o lote.';setError(message);toast.error(message);}}
    finally{if(myRequest===requestCounter.current)setBusy(false);}
  };
  const copy=()=>{
    if(!summary)return;
    void navigator.clipboard.writeText(auditReportText(summary))
      .then(()=>toast.success('Relatório anônimo copiado.'))
      .catch(()=>toast.error('Não foi possível copiar neste aparelho.'));
  };
  if(!allowed)return <div className="dfl-page"><LockKeyhole className="text-zinc-500"/><h1 className="mt-3 text-lg font-black text-zinc-100">Área administrativa restrita</h1></div>;
  return <main className="dfl-page space-y-4 pb-28">
    <header className="flex items-start gap-3"><button type="button" onClick={()=>router.push('/mais/acompanhamento')} aria-label="Voltar para Central" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"><ArrowLeft size={18}/></button><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-400">Gate 3 · Operação segura</p><h1 className="font-heading text-xl font-black text-zinc-100">Auditoria por lote</h1><p className="mt-1 text-xs leading-relaxed text-zinc-500">Conferência sob demanda de até 20 pedidos confirmados por lote.</p></div></header>
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[.05] p-3"><div className="flex items-center gap-2 text-xs font-black text-amber-200"><ShieldCheck size={16}/> Sem ativação, sem gravação</div><p className="mt-1 text-[11px] text-zinc-400">Os filtros usam seu cache local apenas para selecionar IDs. O servidor verifica a empresa e as evidências de cada pedido. Nenhum envio, token ou link é criado.</p></div>
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3"><div className="flex items-center gap-2 text-xs font-black text-zinc-200"><Filter size={15}/> Selecionar amostra</div>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Período">{periods.map(([key,name])=><button key={key} type="button" onClick={()=>choosePeriod(key)} className={`min-h-10 shrink-0 rounded-xl border px-3 text-[11px] font-bold ${period===key?'border-cyan-500/40 bg-cyan-500/10 text-cyan-100':'border-zinc-800 text-zinc-400'}`}>{name}</button>)}</div>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Origem">{origins.map(([key,name])=><button key={key} type="button" onClick={()=>chooseOrigin(key)} className={`min-h-10 shrink-0 rounded-xl border px-3 text-[11px] font-bold ${origin===key?'border-cyan-500/40 bg-cyan-500/10 text-cyan-100':'border-zinc-800 text-zinc-400'}`}>{name}</button>)}</div>
      <p className="text-[11px] text-zinc-400">{list.length} pedido(s) elegíveis no cache atual. Os filtros não consultam o servidor.</p>
      {list.length>perPage&&<div className="flex items-center justify-between gap-2"><button type="button" disabled={safePage===0||busy} onClick={()=>choosePage(safePage-1)} className="min-h-10 rounded-xl border border-zinc-800 px-3 text-xs disabled:opacity-40">Anterior</button><span className="text-[11px] text-zinc-500">Lote {safePage+1} de {pageCount}</span><button type="button" disabled={safePage>=pageCount-1||busy} onClick={()=>choosePage(safePage+1)} className="min-h-10 rounded-xl border border-zinc-800 px-3 text-xs disabled:opacity-40">Próximo</button></div>}
      <button type="button" disabled={!ids.length||busy} onClick={()=>void run()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 text-xs font-black text-cyan-200 disabled:opacity-40"><RefreshCw size={15} className={busy?'animate-spin':''}/>{busy?'Conferindo servidor...':`Auditar ${ids.length} pedido(s) deste lote`}</button>
    </section>
    {error&&<div role="alert" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">{error}<p className="mt-1 text-zinc-400">Não houve gravação, e o funcionamento operacional continua normal.</p></div>}
    {summary&&<TrackingBatchAudit value={summary} onCopy={copy} onInspect={id=>router.push(`/mais/acompanhamento?id=${encodeURIComponent(id)}`)}/>}
    {!summary&&!busy&&<div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500"><ClipboardCheck size={20} className="mx-auto mb-2"/>Selecione os filtros e toque em auditar. Nenhuma consulta é automática.</div>}
  </main>;
}
