'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint, LockKeyhole, Search, ShieldAlert, ShieldCheck, Trash2, LoaderCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';
import { staffRevocationRequest, type RevocationResponse } from '@/lib/access/staffRevocationClient';
import { StaffPageHeader, StaffPanel } from '@/components/access/StaffPremium';
import { StaffConfirmDialog } from '@/components/access/StaffConfirmDialog';
import { staffTouch } from '@/lib/access/staffTouch';
import { toast } from '@/lib/operational-toast';

/** R31: reforca UX e verificacao manual. NENHUMA acao de ativacao. */
export default function RevogacaoPage() {
  const router=useRouter();
  const owner=useAppStore(s=>isSuperadminUid(s.user?.uid));
  const [uid,setUid]=useState('');
  const lookupRef=useRef('');
  const [info,setInfo]=useState<NonNullable<RevocationResponse['account']>|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [dialogOpen,setDialogOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState('');
  const inspect=async()=>{
    const target=uid.trim();
    if(busy||!target)return;
    lookupRef.current=target;
    staffTouch();setBusy(true);setError('');setInfo(null);setConfirmed(false);setDialogOpen(false);setResult('');
    try {
      const response=await staffRevocationRequest('inspect',target);
      if(lookupRef.current!==target)return;
      setInfo(response.account||null);
      if(response.account)toast.info('Identidade consultada. Confira o UID antes de suspender.');
    }catch(e){if(lookupRef.current!==target)return;const message=e instanceof Error?e.message:'Falha na consulta.';setError(message);toast.error('Não foi possível conferir o acesso.',{description:message});}
    finally{setBusy(false);}
  };
  const revoke=async()=>{
    if(!info||!confirmed||busy)return;
    const target=info;
    setBusy(true);setError('');setResult('');
    try {
      const response=await staffRevocationRequest('revoke',target.uid,target.updatedAt);
      setInfo(null);setConfirmed(false);setDialogOpen(false);
      const message=response.warnings?.length
        ?`Conta suspensa. Pendências: ${response.warnings.join(' ')}`
        :`Acesso suspenso, tokens invalidados e ${response.removed||0} projeções removidas.`;
      setResult(message);
      if(response.warnings?.length)toast.warning('Conta suspensa com pendências.',{description:'Confira as etapas de limpeza antes de encerrar.'});
      else toast.success('Acesso revogado e projeções limpas.');
    }catch(e){setInfo(null);setConfirmed(false);setDialogOpen(false);const message=e instanceof Error?e.message:'Falha na revogação. Consulte novamente.';setError(message);toast.error('Revogação não confirmada.',{description:message});}
    finally{setBusy(false);}
  };
  if(!owner)return <div className="dfl-page p-6 text-center text-sm text-rose-300">Acesso restrito ao administrador.</div>;
  return <div className="dfl-page space-y-4 pb-28">
    <StaffPageHeader eyebrow="Segurança individual" title="Revogar acesso" icon={LockKeyhole} onBack={()=>router.push('/mais/acessos/seguranca')}/>
    <StaffPanel title="Suspensão em primeiro lugar" subtitle="O servidor suspende a conta e remove permissões antes da limpeza. Entregas, rotas e estoque originais não são excluídos." icon={ShieldAlert} tone="amber"/>
    <section className="space-y-3 rounded-[23px] border border-zinc-800 bg-zinc-900/45 p-4">
      <div className="flex items-center gap-2 text-sm font-black"><Fingerprint size={17} className="text-emerald-300"/> 1 · Conferir conta Google</div>
      <label htmlFor="uid-revocation" className="block text-xs font-bold text-zinc-300">UID da conta vinculada</label>
      <input id="uid-revocation" autoComplete="off" spellCheck={false} value={uid} maxLength={120}
        onChange={e=>{lookupRef.current=e.target.value.trim();setUid(e.target.value);setInfo(null);setConfirmed(false);setDialogOpen(false);setResult('');}}
        placeholder="Cole o UID completo" className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-sm text-zinc-100 outline-none focus-visible:border-amber-400"/>
      <button type="button" disabled={busy||uid.trim().length<8} onClick={()=>void inspect()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-100 text-sm font-black text-zinc-950 disabled:opacity-40 active:scale-[.995]">
        {busy?<LoaderCircle size={17} className="animate-spin"/>:<Search size={17}/>} {busy?'Consultando...':'Conferir identidade e estado'}
      </button>
    </section>
    {info&&<section className="space-y-3 rounded-[23px] border border-rose-500/25 bg-rose-500/[.045] p-4">
      <div className="flex items-center gap-2 text-rose-300"><LockKeyhole size={17}/><h2 className="text-sm font-black">2 · Confirme o alvo</h2></div>
      <div className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm"><p className="font-bold text-zinc-100">{info.displayName||'Conta sem nome'}</p><p className="text-xs text-zinc-400">Perfil: {info.role} · Estado: {info.status==='active'?'Ativo':'Suspenso'}</p><p className="break-all font-mono text-[11px] text-zinc-500">UID: {info.uid}</p></div>
      <label className="flex min-h-11 items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs leading-relaxed text-zinc-300"><input type="checkbox" className="mt-1 h-4 w-4 accent-rose-400" checked={confirmed} onChange={e=>{staffTouch();setConfirmed(e.target.checked);}}/><span>Conferi o UID e entendo que esta conta será suspensa. Os dados operacionais originais não serão apagados.</span></label>
      <button type="button" disabled={busy||!confirmed} onClick={()=>{staffTouch();setDialogOpen(true)}} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500 text-sm font-black text-zinc-950 disabled:opacity-40 active:scale-[.995]"><Trash2 size={17}/> Revogar e limpar acesso</button>
    </section>}
    {error&&<p role="alert" className="rounded-2xl border border-rose-500/20 bg-rose-500/[.06] p-3 text-xs leading-relaxed text-rose-300">{error}</p>}
    {result&&<p role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.06] p-3 text-xs leading-relaxed text-emerald-300"><ShieldCheck size={18} className="shrink-0"/>{result}</p>}
    {dialogOpen&&info&&<StaffConfirmDialog title="Revogar acesso desta conta?" description="A conta será suspensa, as permissões removidas e a limpeza de projeções será tentada. Confira o alvo antes de continuar." detail={`${info.displayName||'Conta sem nome'} · UID: ${info.uid}`} requirePhrase="REVOGAR" confirmLabel="Revogar acesso" tone="danger" busy={busy} onCancel={()=>setDialogOpen(false)} onConfirm={()=>{setDialogOpen(false);void revoke();}}/>}
  </div>;
}
