'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { AlertTriangle, ArrowLeft, BookOpenCheck, ChevronDown, Copy, LockKeyhole, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';
import { toast } from '@/lib/operational-toast';
import { OwnerTrackingCard } from '@/components/tracking/OwnerTrackingCard';
import { OwnerTrackingInspection } from '@/components/tracking/OwnerTrackingInspection';
import type { TrackingInspection } from '@/lib/tracking/gate1/readiness';
import type { Gate2Certificate } from '@/lib/tracking/gate2/certification';
import { TrackingGate2Certificate } from '@/components/tracking/TrackingGate2Certificate';

const ORIGIN = 'https://dfl-entregas.vercel.app';
const baseUrl=()=>Capacitor.isNativePlatform()?(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim()||ORIGIN).replace(/\/+$/,''):'';
const BASE = '/api/integration/tracking/v1';
type Filter = 'todas'|'site'|'manual'|'ifood'|'food99';
const norm=(value:unknown)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function ControlPanel(){
  const router=useRouter();
  const params=useSearchParams();
  const user=useAppStore(s=>s.user);
  const deliveries=useAppStore(s=>s.deliveries);
  const [filter,setFilter]=useState<Filter>('todas');
  const [query,setQuery]=useState('');
  const initialId=params.get('id')||'';
  const [selectedId,setSelectedId]=useState(initialId);
  const [inspection,setInspection]=useState<TrackingInspection|null>(null);
  const [certificate,setCertificate]=useState<Gate2Certificate|null>(null);
  const [certifying,setCertifying]=useState(false);
  const [loading,setLoading]=useState(false);
  const [working,setWorking]=useState(false);
  const [failure,setFailure]=useState('');
  const [listOpen,setListOpen]=useState(!initialId);
  const lastRequest=useRef(0);
  const lastCertificateRequest=useRef(0);
  const allowed=Boolean(isSuperadminUid(user?.uid));
  const listed=useMemo(()=>{
    const needle=norm(query.trim());
    return deliveries.filter(d=>{
      if(filter!=='todas'){
        const o=d.source_system==='dfl_site'?'site':d.origin==='ifood'?'ifood':d.origin==='food99'?'food99':'manual';
        if(o!==filter)return false;
      }
      return !needle||norm([d.order_id,d.external_order_id,d.id,d.customer_name].join(' ')).includes(needle);
    }).sort((a,b)=>Date.parse(b.created_at||b.createdAt||'')-Date.parse(a.created_at||a.createdAt||'')).slice(0,80);
  },[deliveries,filter,query]);
  const selected=deliveries.find(d=>d.id===selectedId);
  const api=useCallback(async(path:string,body?:Record<string,unknown>)=>{
    const active=auth.currentUser;
    if(!active||!isSuperadminUid(active.uid))throw new Error('Acesso restrito ao proprietário.');
    const token=await active.getIdToken();
    const url=baseUrl()+BASE+path;
    const response=await fetch(url,{
      method:body?'POST':'GET',
      headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',credentials:'omit',
    });
    if(auth.currentUser?.uid!==active.uid)throw new Error('A conta mudou durante a consulta.');
    if(!response.ok){
      if(response.status===404)return {missing:true} as const;
      if(response.status===403)return {off:true} as const;
      throw new Error(`Consulta protegida indisponível (HTTP ${response.status}).`);
    }
    return response.json() as Promise<{ok?:boolean;inspection?:TrackingInspection;certificate?:Gate2Certificate;result?:string}>;
  },[]);
  const inspect=useCallback(async(id:string)=>{
    if(!allowed || !id)return;
    const request=++lastRequest.current;
    lastCertificateRequest.current++;setCertifying(false);setLoading(true);setFailure('');setInspection(null);setCertificate(null);
    try{
      const result=await api(`/admin/inspect?delivery_id=${encodeURIComponent(id)}`);
      if(request!==lastRequest.current)return;
      if('inspection' in result && result.inspection){setInspection(result.inspection);}
      else if('off' in result)setFailure('Acesso administrativo indisponível. Verifique autenticação e permissões.');
      else setFailure('Nenhum diagnóstico autorizado. O ambiente pode estar sem tenant de acompanhamento configurado.');
    }catch(e){if(request===lastRequest.current)setFailure(e instanceof Error?e.message:'Não foi possível conferir o pedido.');}
    finally{if(request===lastRequest.current)setLoading(false);}
  },[allowed,api]);
  useEffect(()=>{if(initialId&&allowed&&selectedId===initialId)void inspect(initialId);},[initialId,allowed,inspect,selectedId]);
  const choose=(id:string)=>{setSelectedId(id);setListOpen(false);setInspection(null);setCertificate(null);setFailure('');void inspect(id);};
  const certify=async()=>{
    if(!allowed||!selectedId||!inspection||certifying)return;
    const certificateRequest=++lastCertificateRequest.current;
    setCertifying(true);setCertificate(null);
    try{
      const result=await api(`/admin/certify?delivery_id=${encodeURIComponent(selectedId)}`);
      if(certificateRequest!==lastCertificateRequest.current)return;
      if('certificate' in result && result.certificate)setCertificate(result.certificate);
      else toast.error('Certificação indisponível. Revise a autenticação e a origem.');
    }catch(e){if(certificateRequest===lastCertificateRequest.current)toast.error(e instanceof Error?e.message:'Não foi possível certificar o pedido.');}
    finally{if(certificateRequest===lastCertificateRequest.current)setCertifying(false);}
  };
  const copy=(text:string)=>{void navigator.clipboard.writeText(text).then(()=>toast.success('Prévia copiada, sem dados privados.')).catch(()=>toast.error('Cópia não disponível neste aparelho.'));};
  const submit=async(action:'confirm'|'sync')=>{
    if(!allowed||!selectedId||working)return;
    const label=action==='confirm'?'confirmar o aceite operacional deste pedido':'reconciliar os eventos persistidos deste pedido';
    if(!window.confirm(`Deseja ${label}? Esta ação NÃO envia WhatsApp nem cria link.`))return;
    setWorking(true);
    try{
      const payload=action==='confirm'
        ?{contract:'dfl.tracking.confirm',version:1,delivery_id:selectedId,idempotency_key:crypto.randomUUID().replace(/-/g,'')}
        :{contract:'dfl.tracking.sync',version:1,delivery_id:selectedId};
      const outcome=await api(`/${action}`,payload);
      if(!('ok' in outcome)||outcome.ok!==true)throw new Error('Ação não habilitada no backend ou sem permissão.');
      toast.success(action==='confirm'?'Aceite registrado no servidor.':'Reconciliação concluída.');
      await inspect(selectedId);
    }catch(e){toast.error(e instanceof Error?e.message:'Ação indisponível.');}finally{setWorking(false);}
  };
  if(!allowed)return <div className="dfl-page"><LockKeyhole className="text-zinc-500"/><h1 className="mt-3 font-black text-zinc-100">Área administrativa restrita</h1><p className="mt-2 text-xs text-zinc-500">O acesso exige autenticação do proprietário.</p></div>;
  return <div className="dfl-page space-y-4 pb-28">
    <header className="flex items-start gap-3"><button type="button" onClick={()=>router.push('/mais')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"><ArrowLeft size={18}/></button><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.15em] text-cyan-400">Gate 1 · R250 · Operação interna</p><h1 className="font-heading text-xl font-black text-zinc-100">Central de Acompanhamento</h1><p className="mt-1 text-xs text-zinc-500">Inspeção e simulação. Sem acesso público nem mensagens reais.</p></div></header>
    <button type="button" onClick={()=>router.push('/mais/acompanhamento/auditoria')} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[.05] px-4 text-left text-xs font-bold text-emerald-100"><span className="flex items-center gap-2"><ShieldCheck size={18}/> Auditoria de acompanhamento · até 20 pedidos</span><span className="text-[10px] text-emerald-300">Abrir</span></button>
    <button type="button" onClick={()=>router.push('/mais/acompanhamento/laboratorio')} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-cyan-500/25 bg-cyan-500/[.06] px-4 text-left text-xs font-bold text-cyan-100"><span className="flex items-center gap-2"><BookOpenCheck size={18}/> Laboratório visual · 14 cenários fictícios</span><span className="text-[10px] text-cyan-300">Abrir</span></button>
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[.06] p-3"><div className="flex items-center gap-2 text-xs font-black text-amber-200"><ShieldCheck size={16}/> Modo de homologação protegido</div><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Esta central usa o cache para localizar pedidos, mas somente o servidor pode confirmar eventos. Sem tenant/configuração certificada, a inspeção será bloqueada. Links e WhatsApp permanecem OFF.</p></div>
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3"><button type="button" onClick={()=>setListOpen(v=>!v)} className="flex w-full items-center justify-between text-left"><span className="flex items-center gap-2 text-sm font-black text-zinc-100"><Search size={17}/> Selecionar pedido</span><ChevronDown className={`text-zinc-500 transition-transform ${listOpen?'rotate-180':''}`} size={17}/></button>
      {listOpen&&<><div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3"><Search size={16} className="text-zinc-500"/><input aria-label="Buscar pedido" value={query} onChange={e=>setQuery(e.target.value.slice(0,100))} placeholder="ID ou cliente" className="min-h-11 w-full min-w-0 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"/></div><div className="flex gap-2 overflow-x-auto pb-1">{([['todas','Todos'],['site','Site'],['manual','Loja'],['ifood','iFood'],['food99','99Food']] as const).map(([key,label])=><button key={key} type="button" onClick={()=>setFilter(key)} className={`min-h-9 shrink-0 rounded-xl border px-3 text-xs font-bold ${filter===key?'border-cyan-500/40 bg-cyan-500/10 text-cyan-200':'border-zinc-800 text-zinc-400'}`}>{label}</button>)}</div><div className="max-h-[360px] space-y-2 overflow-y-auto overscroll-contain">{listed.map(d=><OwnerTrackingCard key={d.id} delivery={d} active={selectedId===d.id} onClick={()=>choose(d.id)}/>)}{listed.length===0&&<p className="p-4 text-center text-xs text-zinc-500">Nenhum pedido no cache com esses filtros.</p>}</div><p className="text-[10px] text-zinc-600">Até 80 resultados locais; não gera consultas adicionais por card.</p></>}
    </section>
    {selected&&<div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-zinc-100">{selected.order_id||selected.external_order_id||selected.id}</p><p className="truncate text-xs text-zinc-500">{selected.customer_name||'Cliente'}</p></div><button type="button" disabled={loading} onClick={()=>void inspect(selectedId)} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-zinc-800 px-3 text-xs font-bold disabled:opacity-50"><RefreshCw size={15}/> Conferir</button></div>}
    {loading&&<div role="status" className="rounded-2xl border border-zinc-800 p-4 text-xs text-zinc-400">Consultando somente os fatos confirmados no servidor...</div>}
    {failure&&<div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200"><AlertTriangle size={17} className="mb-2"/>{failure}<p className="mt-2 text-zinc-400">O aplicativo operacional continua funcionando normalmente.</p></div>}
    {inspection&&<OwnerTrackingInspection value={inspection} busy={working} onCopy={copy} onConfirm={()=>void submit('confirm')} onSync={()=>void submit('sync')}/>}
    {inspection&&<button type="button" disabled={certifying||loading} onClick={()=>void certify()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/[.06] px-3 text-xs font-black text-cyan-100 disabled:opacity-40"><ShieldCheck size={16}/>{certifying?'Certificando evidências...':'Certificar contratos A–E neste pedido'}</button>}
    {certificate&&<TrackingGate2Certificate certificate={certificate}/>}
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4"><div className="flex items-center gap-2 text-xs font-black text-zinc-300"><BookOpenCheck size={16}/> Contrato do Site preservado</div><p className="mt-2 text-xs leading-relaxed text-zinc-500">A página pública será construída separadamente pelo Site. Copiar a prévia não emite credenciais, não registra vendas e não aciona a VPS.</p></section>
  </div>;
}
export default function AcompanhamentoAdminPage(){return <Suspense fallback={<div className="dfl-page p-4 text-xs text-zinc-400">Carregando controles...</div>}><ControlPanel/></Suspense>;}
