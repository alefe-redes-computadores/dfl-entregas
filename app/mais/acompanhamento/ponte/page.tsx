'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, ClipboardCopy, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';
import { toast } from '@/lib/operational-toast';
import { TrackingGate4Handoff } from '@/components/tracking/TrackingGate4Handoff';
import { formatGate4HandoffForSite, type Gate4Handoff } from '@/lib/tracking/gate4/handoff';

const NATIVE_ORIGIN='https://dfl-entregas.vercel.app';
const baseUrl=()=>Capacitor.isNativePlatform()?(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim()||NATIVE_ORIGIN).replace(/\/+$/,''):'';
function isHandoff(r:unknown):r is Gate4Handoff {
  if(!r||typeof r!=='object'||Array.isArray(r))return false;
  const v=r as Record<string,unknown>;
  return v.contract==='dfl.tracking.gate4.handoff' && v.version===1 && v.scope==='owner_only' &&
    typeof v.generated_at==='string' && typeof v.code_enabled==='boolean' &&
    typeof v.kill_switch==='boolean' && typeof v.tenant_configured==='boolean' &&
    typeof v.s2s_keyset_configured==='boolean' && Array.isArray(v.checks) && Array.isArray(v.next_actions);
}
export default function TrackingSiteBridgePage(){
  const router=useRouter();
  const user=useAppStore(s=>s.user);
  const allowed=isSuperadminUid(user?.uid);
  const [report,setReport]=useState<Gate4Handoff|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const requestRef=useRef(0);
  useEffect(()=>()=>{requestRef.current++;},[]);
  const inspect=useCallback(async()=>{
    const request=++requestRef.current;
    const current=auth.currentUser;
    if(!current||!isSuperadminUid(current.uid))return;
    setBusy(true);setMessage('');setReport(null);
    try{
      const token=await current.getIdToken();
      const response=await fetch(`${baseUrl()}/api/integration/tracking/v1/admin/handoff`,{
        method:'GET',headers:{authorization:`Bearer ${token}`},cache:'no-store',credentials:'omit',
      });
      if(!response.ok)throw Error('A verificação protegida está indisponível.');
      const packet:unknown=await response.json();
      const data=packet && typeof packet==='object' && 'report' in packet?(packet as {report:unknown}).report:null;
      if(!isHandoff(data))throw Error('Resposta de contrato inesperada.');
      if(request!==requestRef.current||auth.currentUser?.uid!==current.uid)return;
      setReport(data);
    }catch(error){if(request===requestRef.current)setMessage(error instanceof Error?error.message:'Não foi possível verificar a ponte.');}
    finally{if(request===requestRef.current)setBusy(false);}
  },[]);
  const copy=async()=>{
    if(!report)return;
    try{await navigator.clipboard.writeText(formatGate4HandoffForSite(report));toast.success('Relatório sem dados privados copiado.');}
    catch{toast.error('Não foi possível copiar neste aparelho.');}
  };
  if(!allowed)return <main className="dfl-page"><LockKeyhole size={22} className="text-zinc-400"/><h1 className="mt-3 text-xl font-black text-zinc-100">Acesso restrito</h1><p className="mt-2 text-xs text-zinc-400">Verificação administrativa disponível apenas ao proprietário.</p></main>;
  return <main className="dfl-page space-y-4 pb-28">
    <header className="flex items-start gap-3"><button type="button" onClick={()=>router.push('/mais/acompanhamento')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"><ArrowLeft size={18}/></button><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.14em] text-cyan-300">Gate 4 · Homologação técnica</p><h1 className="font-heading text-xl font-black text-zinc-100">Ponte com o Site</h1><p className="mt-1 text-xs text-zinc-500">Diagnóstico protegido, sem criar links ou mensagens.</p></div></header>
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4"><p className="flex items-center gap-2 text-sm font-black text-zinc-100"><ShieldCheck size={16}/> Preparação independente</p><p className="mt-2 text-xs leading-relaxed text-zinc-400">Os contratos A–E já existem no Entregas. O Site já possui a entrada /acompanhar, sessão HttpOnly e revogação. Esta tela não comprova, sozinha, a ativação de links na empresa. Esta tela mostra somente informações seguras para compartilhar entre os desenvolvimentos.</p></section>
    <button type="button" disabled={busy} onClick={()=>void inspect()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-3 text-xs font-black text-cyan-100 disabled:opacity-50"><RefreshCw size={16} className={busy?'animate-spin':''}/>{busy?'Verificando servidor...':'Verificar preparo do backend'}</button>
    {message&&<div role="alert" className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-200">{message}</div>}
    {report&&<><TrackingGate4Handoff report={report}/><button type="button" onClick={()=>void copy()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-bold text-zinc-200"><ClipboardCopy size={16}/> Copiar diagnóstico para o Site</button></>}
    <p className="text-[11px] leading-relaxed text-zinc-500">Não modifica Firestore, não aciona o relay, não emite credenciais e não faz conexão direta com o Site. Todos os dados reais permanecem privados.</p>
  </main>;
}
