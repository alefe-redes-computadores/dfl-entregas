'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ClipboardCheck, DatabaseZap, Fingerprint, LockKeyhole, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid, roleLabel, type StaffAccessDraft } from '@/lib/access/roles';
import { loadStaffDrafts } from '@/lib/access/staffRepository';
import { requestStaffStaging, type StaffStagingResponse } from '@/lib/access/staffStagingClient';
import { StaffPageHeader, StaffPanel, StaffMetric } from '@/components/access/StaffPremium';
import { StaffConfirmDialog } from '@/components/access/StaffConfirmDialog';
import { StaffChoicePicker } from '@/components/access/StaffChoicePicker';
import { staffTouch } from '@/lib/access/staffTouch';
import { fetchStaffLinkClaims } from '@/lib/access/staffClaimClient';
import { UserRoundCheck } from 'lucide-react';

const input = 'h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-sm text-zinc-100 outline-none focus:border-emerald-500';
const sections = [ ['home','Início'],['routes','Rotas'],['deliveries','Entregas'],['stock','Estoque'],['purchases','Compras'] ] as const;

export default function StaffStagingPage() {
  const router=useRouter();
  const user=useAppStore(s=>s.user);
  const owner=isSuperadminUid(user?.uid);
  const [drafts,setDrafts]=useState<StaffAccessDraft[]>([]);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [draftId,setDraftId]=useState('');
  const [uid,setUid]=useState('');
  const [verified,setVerified]=useState<StaffStagingResponse | null>(null);
  const [preview,setPreview]=useState<StaffStagingResponse | null>(null);
  const [confirm,setConfirm]=useState(false);
  const [done,setDone]=useState(false);
  const [stageDialog,setStageDialog]=useState(false);
  const [claims,setClaims]=useState<{uid:string;receivedAt:string}[]>([]);
  const [claimsLoading,setClaimsLoading]=useState(false);
  const selectionEpoch=useRef(0);
  const claimsEpoch=useRef(0);
  useEffect(()=>()=>{selectionEpoch.current++;claimsEpoch.current++;},[]);
  const selected=drafts.find(x=>x.id===draftId);
  const reset=()=>{selectionEpoch.current++;claimsEpoch.current++;setVerified(null);setPreview(null);setConfirm(false);setDone(false);setStageDialog(false);setClaimsLoading(false);};
  const readClaims=async()=>{
    if(!draftId || busy || claimsLoading)return;
    const epoch=++claimsEpoch.current;
    setClaimsLoading(true);setClaims([]);
    try {const results=await fetchStaffLinkClaims(draftId);if(epoch===claimsEpoch.current)setClaims(results);}
    catch(error){if(epoch===claimsEpoch.current)toast.error(error instanceof Error?error.message:'Não foi possível consultar pedidos.');}
    finally{if(epoch===claimsEpoch.current)setClaimsLoading(false);}
  };
  const refresh=useCallback(async()=>{
    if(!owner)return;
    setLoading(true);
    try{setDrafts((await loadStaffDrafts()).filter(item=>item.status==='rascunho'&&Boolean(item.email)))}
    catch(e){toast.error(e instanceof Error?e.message:'Não foi possível consultar os rascunhos.');}
    finally{setLoading(false)}
  },[owner]);
  useEffect(()=>{void refresh()},[refresh]);
  if(!owner)return <div className="dfl-page p-5"><LockKeyhole className="text-red-400"/><h1 className="mt-4 font-black">Acesso restrito</h1></div>;
  const execute=async(action:'verify'|'preview'|'stage')=>{
    if(!selected || !uid.trim()){toast.error('Selecione o rascunho e informe o UID do Firebase Auth.');return;}
    staffTouch();
    const epoch=selectionEpoch.current;
    setBusy(true);
    try {
      const result=await requestStaffStaging(action,draftId,uid.trim(),action==='stage'?preview?.digest:undefined);
      if(epoch!==selectionEpoch.current)return;
      if(action==='verify'){setVerified(result);setPreview(null);setConfirm(false);toast.success('Conta Google verificada no Firebase Auth.');}
      if(action==='preview'){setPreview(result);setConfirm(false);toast.success('Prévia calculada sem alterar o banco.');}
      if(action==='stage'){setDone(true);setConfirm(false);toast.success('Dados preparados. Login segue BLOQUEADO.');}
    }catch(e){if(epoch===selectionEpoch.current)toast.error(e instanceof Error?e.message:'Serviço de homologação indisponível.');}
    finally{setBusy(false);}
  };
  return <div className="dfl-page space-y-4 pb-28 text-zinc-100">
    <StaffPageHeader eyebrow="Identidade · Firebase Auth" title="Homologar vínculo Google" icon={Fingerprint} onBack={()=>router.push('/mais/acessos')} onRefresh={()=>void refresh()} loading={loading||busy}/>
    <StaffPanel title="Verificação em três etapas" subtitle="UID e e-mail verificados, prévia mínima e preparação com conta suspensa. Nenhuma etapa concede login." icon={ShieldCheck} tone="green"/>

    <section className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between"><h2 className="text-sm font-black">1 · Identidade</h2><button type="button" onClick={()=>void refresh()} disabled={loading||busy} aria-label="Atualizar lista" className="text-zinc-400"><RefreshCw size={17}/></button></div>
      <StaffChoicePicker label="Funcionário preparado" value={draftId} placeholder="Selecione um rascunho" options={[{value:'',label:'Selecione um rascunho'},...drafts.map(d=>({value:d.id,label:d.name,description:`${roleLabel(d.role)} · ${d.email}`}))]} onChange={value=>{setDraftId(value);setUid('');setClaims([]);reset();}} disabled={busy||claimsLoading}/>
      {selected&&<div className="rounded-xl bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400"><strong className="text-zinc-200">{selected.email}</strong><span className="mt-1 block">Perfil: {roleLabel(selected.role)} · {selected.permissions.length} permissões preparadas</span></div>}
      {selected&&<div className="space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.045] p-3">
        <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="flex items-center gap-2 text-xs font-black text-emerald-300"><UserRoundCheck size={15}/> Vínculo pelo login Google</p><p className="mt-1 text-[11px] text-zinc-400">Quando a pessoa solicitar o vínculo pelo portal da equipe, escolha o pedido aqui. Sem copiar UID do Firebase.</p></div></div>
        <button type="button" disabled={busy||claimsLoading} onClick={()=>void readClaims()} className="min-h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-bold text-zinc-200 disabled:opacity-40">{claimsLoading?'Consultando...':'Consultar solicitações de vínculo'}</button>
        {claims.map(claim=><button key={claim.uid} type="button" onClick={()=>{setUid(claim.uid);reset();staffTouch();}} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${uid===claim.uid?'border-emerald-400/50 bg-emerald-500/10 text-emerald-200':'border-zinc-800 bg-zinc-950/60 text-zinc-300'}`}><span className="min-w-0 truncate">Pedido Google · {claim.receivedAt ? new Date(claim.receivedAt).toLocaleString('pt-BR') : 'data não informada'}</span><span className="shrink-0 font-black">{uid===claim.uid?'Selecionado':'Usar'}</span></button>)}
        {!claimsLoading&&claims.length===0&&<p className="text-[11px] text-zinc-500">Sem pedidos carregados. A consulta é manual e limitada.</p>}
      </div>}
      <label className="block space-y-1.5"><span className="text-xs text-zinc-400">UID da conta no Firebase Authentication (alternativa manual)</span><input className={input} value={uid} onChange={e=>{setUid(e.target.value);reset();}} disabled={busy} autoComplete="off" spellCheck={false} placeholder="Cole o UID exato da conta" maxLength={120}/></label>
      <button type="button" onClick={()=>void execute('verify')} disabled={busy||!selected||!uid.trim()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 text-sm font-black active:scale-[.995] text-zinc-950 disabled:opacity-40"><ShieldCheck size={17}/>{busy?'Conferindo…':'Validar identidade no Firebase'}</button>
      {verified&&<div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs"><CheckCircle2 size={17} className="shrink-0 text-emerald-400"/><div><p className="font-bold text-emerald-300">UID e e-mail conferidos</p><p className="mt-1 text-zinc-400">{verified.verified?.emailMasked} · Conta verificada · Acesso ainda bloqueado</p></div></div>}
    </section>
    <section className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h2 className="text-sm font-black">2 · Prévia sem publicar</h2>
      <p className="text-xs leading-relaxed text-zinc-500">A prévia consulta o servidor de forma limitada e exclui preços, pagamentos, telefones, endereços, observações e dados de outras rotas.</p>
      <button type="button" disabled={busy||!verified||done} onClick={()=>void execute('preview')} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 active:scale-[.995] text-xs font-black disabled:opacity-40"><DatabaseZap size={17}/> Calcular prévia</button>
      {preview&&<div className="grid grid-cols-2 gap-2">{sections.map(([key,label])=><StaffMetric key={key} label={label} value={preview.counts?.[key]??0} tone={key==='routes'||key==='deliveries'?'sky':'green'}/>)}</div>}
    </section>
    <section className="space-y-3 rounded-3xl border border-amber-500/20 bg-amber-500/[.035] p-4">
      <h2 className="flex items-center gap-2 text-sm font-black text-amber-300"><LockKeyhole size={17}/> 3 · Preparar — SEM ativar</h2>
      <p className="text-xs leading-relaxed text-zinc-400">Apenas após conferir a prévia: grava o cadastro com status <strong>suspended</strong> e documentos minimizados por UID. As regras atuais do Firebase continuam exclusivas do administrador. Não abre acesso nem modifica a flag do portal.</p>
      <label className="flex items-start gap-3 text-xs leading-relaxed text-zinc-300"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-500" checked={confirm} disabled={!preview||busy||done} onChange={e=>setConfirm(e.target.checked)}/> Entendo que esta ação grava projeções de teste no Firestore, mas não autoriza login, não publica regras e não habilita operações.</label>
      <button type="button" disabled={busy||!preview||!confirm||done} onClick={()=>{staffTouch();setStageDialog(true);}} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 active:scale-[.995] text-sm font-black text-zinc-950 disabled:opacity-40"><ClipboardCheck size={18}/> Preparar dados com conta suspensa</button>
      {done&&<p className="flex items-center gap-2 text-sm font-bold text-emerald-400"><CheckCircle2 size={17}/> Preparado. Login continua bloqueado.</p>}
      {!done&&<p className="flex items-center gap-2 text-[11px] text-zinc-500"><XCircle size={15}/> Nenhuma permissão foi concedida automaticamente.</p>}
    </section>
    {stageDialog&&preview&&<StaffConfirmDialog title="Preparar dados sem liberar login?" description="Serão gravadas projeções mínimas por UID e a conta continuará suspensa. Não publica regras nem ativa o portal." detail={`${selected?.name||'Funcionário'} · ${uid}`} confirmLabel="Preparar suspenso" requirePhrase="PREPARAR" tone="caution" busy={busy} onCancel={()=>setStageDialog(false)} onConfirm={()=>{setStageDialog(false);void execute('stage');}}/>}
  </div>;
}
