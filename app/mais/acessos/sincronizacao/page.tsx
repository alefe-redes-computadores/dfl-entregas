'use client';
/** R35: comparação e refresh EXPLÍCITOS; jamais faz atualização no mount. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {AlertTriangle,CheckCircle2,CloudCog,DatabaseZap,Eye,KeyRound,LockKeyhole,RefreshCw,ShieldCheck,UsersRound} from 'lucide-react';
import {useAppStore} from '@/store/useAppStore';
import {isSuperadminUid} from '@/lib/access/roles';
import {inspectStaffReadiness} from '@/lib/access/staffReadinessClient';
import {requestStaffRefresh,type RefreshPreview} from '@/lib/access/staffRefreshClient';
import {StaffConfirmDialog} from '@/components/access/StaffConfirmDialog';
import {StaffEmpty,StaffMetric,StaffPageHeader,StaffPanel} from '@/components/access/StaffPremium';
import {staffTouch} from '@/lib/access/staffTouch';
import {toast} from '@/lib/operational-toast';
type Choice={uid:string;name:string;role:string;status:string};
export default function StaffSynchronizationPage(){
 const router=useRouter();const owner=isSuperadminUid(useAppStore(s=>s.user?.uid));
 const [accounts,setAccounts]=useState<Choice[]>([]);const [uid,setUid]=useState('');
 const [preview,setPreview]=useState<RefreshPreview|null>(null);const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');const [confirm,setConfirm]=useState(false);const request=useRef(0);
 useEffect(()=>()=>{request.current++;},[]);
 const reset=useCallback((next='')=>{request.current++;setUid(next);setPreview(null);setConfirm(false);setError('');},[]);
 const load=async()=>{const id=++request.current;setBusy(true);setError('');setPreview(null);setConfirm(false);
  try{const result=await inspectStaffReadiness();if(id!==request.current)return;
   setAccounts(result.accounts.map(a=>({uid:a.uid,name:a.name,role:a.role,status:a.status})));
   toast.success('Contas consultadas.',{description:'Somente metadados de homologação.'});
  }catch(e){if(id!==request.current)return;setError(e instanceof Error?e.message:'Sem resposta do servidor.');toast.error('Consulta indisponível.');}
  finally{if(id===request.current)setBusy(false);}
 };
 const compare=async()=>{if(!uid||busy)return;const requested=uid,id=++request.current;setBusy(true);setPreview(null);setConfirm(false);setError('');
  try{const result=await requestStaffRefresh(requested,'preview');if(id!==request.current)return;
   if(result.operation!=='preview')throw new Error('Resposta inesperada.');setPreview(result);
   toast.success('Prévia calculada.',{description:'Nenhuma projeção foi alterada.'});
  }catch(e){if(id!==request.current)return;setError(e instanceof Error?e.message:'Prévia indisponível.');toast.error('Não foi possível comparar.');}
  finally{if(id===request.current)setBusy(false);}
 };
 const apply=async()=>{if(!preview||busy||!preview.refreshEnabled||preview.targetUid!==uid)return;
  const last=preview,id=++request.current;setBusy(true);setError('');
  try{const done=await requestStaffRefresh(uid,'refresh',last);if(id!==request.current)return;
   if(done.operation!=='refresh'||!done.suspended)throw new Error('Resposta não confirma conta suspensa.');
   setPreview(null);toast.success(done.applied===false?'Projeções já atualizadas.':'Projeções sincronizadas.',{description:done.applied===false?'Nenhuma gravação necessária. A conta continua suspensa.':'Conta permanece suspensa; confirme novamente a integridade.'});
  }catch(e){if(id!==request.current)return;setPreview(null);setError(e instanceof Error?e.message:'Não foi possível confirmar a gravação.');toast.error('Sincronização não confirmada.',{description:'Refaça a prévia e confira a conta antes de tentar novamente.'});}
  finally{if(id===request.current){setBusy(false);setConfirm(false);}}
 };
 if(!owner)return <div className="dfl-page p-5"><StaffEmpty icon={LockKeyhole} title="Acesso restrito" subtitle="Apenas o proprietário pode conferir projeções."/></div>;
 return <div className="dfl-page space-y-4 pb-28 text-zinc-100">
  <StaffPageHeader eyebrow="Equipe · Dados" title="Sincronização segura" icon={CloudCog} onBack={()=>router.push('/mais/acessos/evidencias')}/>
  <StaffPanel icon={LockKeyhole} tone="amber" title="Nenhum login será liberado" subtitle="Prévia manual, por UID. A aplicação exige conta suspensa, confirmação digitada e uma flag específica do servidor, desligada por padrão."/>
  <StaffPanel icon={UsersRound} title="1. Escolha uma conta" tone="sky" subtitle="A consulta não carrega dados gerais da loja nem fica atualizando automaticamente.">
   <button type="button" disabled={busy} onClick={()=>{staffTouch();void load();}} className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 text-xs font-black text-sky-200 disabled:opacity-40"><RefreshCw size={15} className={busy?'animate-spin':''}/>{busy?'Consultando...':'Consultar contas preparadas'}</button>
   <div className="mt-3 space-y-2">{accounts.map(a=><button type="button" key={a.uid} aria-pressed={uid===a.uid} disabled={busy} onClick={()=>{staffTouch();reset(a.uid);}} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-xs ${uid===a.uid?'border-emerald-500/30 bg-emerald-500/10 text-emerald-200':'border-zinc-800 bg-zinc-950/50 text-zinc-300'} disabled:opacity-40`}><span className="min-w-0 truncate font-bold">{a.name}<span className="ml-2 font-normal text-zinc-500">{a.role}</span></span><span className={`shrink-0 text-[10px] font-black uppercase ${a.status==='suspended'?'text-amber-300':'text-rose-300'}`}>{a.status==='suspended'?'Suspensa':'Bloqueada'}</span></button>)}</div>
  </StaffPanel>
  <StaffPanel icon={Eye} title="2. Comparar projeções" subtitle="Confere quantos documentos entrariam, sairiam ou mudariam. Nenhum dado pessoal é devolvido.">
   {!uid?<p className="mt-3 text-xs text-zinc-500">Escolha uma conta antes de comparar.</p>:<button type="button" disabled={busy} onClick={()=>{staffTouch();void compare();}} className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 text-xs font-black text-emerald-200 disabled:opacity-40"><DatabaseZap size={16}/> {busy?'Conferindo...':'Calcular prévia segura'}</button>}
   {preview&&<div className="mt-4 space-y-3"><div className="grid grid-cols-2 gap-2"><StaffMetric label="Documentos previstos" value={preview.totalNew} icon={DatabaseZap} tone="green"/><StaffMetric label="Mudanças na comparação" value={preview.totalChanges} icon={RefreshCw} tone="sky"/></div>
    {preview.areas.map(a=><div key={{home:'Início',routes:'Rotas',deliveries:'Entregas',stock:'Estoque',purchases:'Compras'}[a.area]||a.area} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5 text-[11px]"><span className="font-bold text-zinc-200">{{home:'Início',routes:'Rotas',deliveries:'Entregas',stock:'Estoque',purchases:'Compras'}[a.area]||a.area}</span><span className="tabular-nums text-zinc-400">{a.previous} → {a.next} · +{a.added} / −{a.removed} / ~{a.changed}</span></div>)}
    <div className={`rounded-xl border p-3 text-xs leading-relaxed ${preview.refreshEnabled?'border-amber-500/25 bg-amber-500/5 text-amber-200':'border-zinc-800 bg-zinc-900/60 text-zinc-400'}`}>{preview.refreshEnabled?'A atualização está habilitada no servidor, mas exige confirmação e revalidação do UID.':'A atualização está bloqueada no servidor. A prévia é somente leitura.'}</div>
    {preview.refreshEnabled&&preview.totalChanges===0&&<div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300"><CheckCircle2 size={16}/> Nenhuma mudança necessária. Evitamos gravações no Firebase.</div>}
    {preview.refreshEnabled&&preview.totalChanges>0&&<button type="button" disabled={busy} onClick={()=>{staffTouch();setConfirm(true);}} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 text-xs font-black text-amber-200"><ShieldCheck size={16}/> Sincronizar projeções desta conta</button>}
   </div>}
   {error&&<p role="alert" className="mt-3 flex gap-2 text-xs text-rose-300"><AlertTriangle size={15}/>{error}</p>}
  </StaffPanel>
  <StaffPanel icon={CheckCircle2} title="3. Revalidar segurança" tone="neutral" subtitle="Depois de qualquer atualização, execute novamente a auditoria profunda e confirme as Rules de produção. Esta tela não autoriza funcionários."/>
  {confirm&&preview&&<StaffConfirmDialog title="Sincronizar projeções da conta suspensa?" description="Os documentos projetados serão substituídos apenas para este UID, mantendo o acesso suspenso. A operação é registrada na auditoria." detail="A conta será revalidada no servidor; não habilita login ou permissões." requirePhrase="SINCRONIZAR" confirmLabel="Confirmar sincronização" tone="caution" busy={busy} onCancel={()=>setConfirm(false)} onConfirm={()=>void apply()}/>}
 </div>;
}
