'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ClipboardCheck, DatabaseZap, Fingerprint, LockKeyhole, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid, roleLabel, type StaffAccessDraft } from '@/lib/access/roles';
import { loadStaffDrafts } from '@/lib/access/staffRepository';
import { requestStaffStaging, type StaffStagingResponse } from '@/lib/access/staffStagingClient';

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
  const selected=drafts.find(x=>x.id===draftId);
  const reset=()=>{setVerified(null);setPreview(null);setConfirm(false);setDone(false);};
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
    setBusy(true);
    try {
      const result=await requestStaffStaging(action,draftId,uid.trim(),action==='stage'?preview?.digest:undefined);
      if(action==='verify'){setVerified(result);setPreview(null);setConfirm(false);toast.success('Conta Google verificada no Firebase Auth.');}
      if(action==='preview'){setPreview(result);setConfirm(false);toast.success('Prévia calculada sem alterar o banco.');}
      if(action==='stage'){setDone(true);setConfirm(false);toast.success('Dados preparados. Login segue BLOQUEADO.');}
    }catch(e){toast.error(e instanceof Error?e.message:'Serviço de homologação indisponível.');}
    finally{setBusy(false);}
  };
  return <div className="dfl-page space-y-4 pb-12 text-zinc-100">
    <button type="button" onClick={()=>router.push('/mais/acessos')} className="flex items-center gap-2 text-sm font-bold text-zinc-400"><ArrowLeft size={17}/> Equipe e permissões</button>
    <div className="rounded-[26px] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[.09] to-zinc-950 p-5">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400"><Fingerprint size={25}/></span><div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">R23 · Homologação</p><h1 className="font-heading text-xl font-black">Verificar vínculo de conta</h1></div></div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-400">Confira o UID pelo Firebase Authentication, compare com o e-mail Google verificado e prepare somente informações mínimas. Este fluxo NÃO libera o funcionário para entrar.</p>
    </div>
    <section className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between"><h2 className="text-sm font-black">1 · Identidade</h2><button type="button" onClick={()=>void refresh()} disabled={loading||busy} aria-label="Atualizar lista" className="text-zinc-400"><RefreshCw size={17}/></button></div>
      <label className="block space-y-1.5"><span className="text-xs text-zinc-400">Funcionário preparado</span><select className={input} value={draftId} onChange={e=>{setDraftId(e.target.value);reset();}}><option value="">Selecione um rascunho</option>{drafts.map(d=><option value={d.id} key={d.id}>{d.name} — {roleLabel(d.role)}</option>)}</select></label>
      {selected&&<div className="rounded-xl bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400"><strong className="text-zinc-200">{selected.email}</strong><span className="mt-1 block">Perfil: {roleLabel(selected.role)} · {selected.permissions.length} permissões preparadas</span></div>}
      <label className="block space-y-1.5"><span className="text-xs text-zinc-400">UID da conta no Firebase Authentication</span><input className={input} value={uid} onChange={e=>{setUid(e.target.value);reset();}} autoComplete="off" spellCheck={false} placeholder="Cole o UID exato da conta" maxLength={120}/></label>
      <button type="button" onClick={()=>void execute('verify')} disabled={busy||!selected||!uid.trim()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-black text-zinc-950 disabled:opacity-40"><ShieldCheck size={17}/>{busy?'Conferindo…':'Validar identidade no Firebase'}</button>
      {verified&&<div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs"><CheckCircle2 size={17} className="shrink-0 text-emerald-400"/><div><p className="font-bold text-emerald-300">UID e e-mail conferidos</p><p className="mt-1 text-zinc-400">{verified.verified?.emailMasked} · Conta verificada · Acesso ainda bloqueado</p></div></div>}
    </section>
    <section className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h2 className="text-sm font-black">2 · Prévia sem publicar</h2>
      <p className="text-xs leading-relaxed text-zinc-500">A prévia consulta o servidor de forma limitada e exclui preços, pagamentos, telefones, endereços, observações e dados de outras rotas.</p>
      <button type="button" disabled={busy||!verified||done} onClick={()=>void execute('preview')} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-black disabled:opacity-40"><DatabaseZap size={17}/> Calcular prévia</button>
      {preview&&<div className="grid grid-cols-2 gap-2">{sections.map(([key,label])=><div key={key} className="rounded-xl bg-zinc-950/70 p-3"><p className="text-xl font-black">{preview.counts?.[key]??0}</p><p className="text-[10px] text-zinc-500">{label}</p></div>)}</div>}
    </section>
    <section className="space-y-3 rounded-3xl border border-amber-500/20 bg-amber-500/[.035] p-4">
      <h2 className="flex items-center gap-2 text-sm font-black text-amber-300"><LockKeyhole size={17}/> 3 · Preparar — SEM ativar</h2>
      <p className="text-xs leading-relaxed text-zinc-400">Apenas após conferir a prévia: grava o cadastro com status <strong>suspended</strong> e documentos minimizados por UID. As regras atuais do Firebase continuam exclusivas do administrador. Não abre acesso nem modifica a flag do portal.</p>
      <label className="flex items-start gap-3 text-xs leading-relaxed text-zinc-300"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-500" checked={confirm} disabled={!preview||busy||done} onChange={e=>setConfirm(e.target.checked)}/> Entendo que esta ação grava projeções de teste no Firestore, mas não autoriza login, não publica regras e não habilita operações.</label>
      <button type="button" disabled={busy||!preview||!confirm||done} onClick={()=>void execute('stage')} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 text-sm font-black text-zinc-950 disabled:opacity-40"><ClipboardCheck size={18}/> Preparar dados com conta suspensa</button>
      {done&&<p className="flex items-center gap-2 text-sm font-bold text-emerald-400"><CheckCircle2 size={17}/> Preparado. Login continua bloqueado.</p>}
      {!done&&<p className="flex items-center gap-2 text-[11px] text-zinc-500"><XCircle size={15}/> Nenhuma permissão foi concedida automaticamente.</p>}
    </section>
  </div>;
}
