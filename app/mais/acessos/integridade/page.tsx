'use client';
/** R33: painel de integridade por UID, owner-only, manual e exclusivamente informativo. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {AlertTriangle,Bike,Boxes,ClipboardCheck,Clock3,Eye,FileSearch,LockKeyhole,Package,RefreshCw,ShieldAlert,ShieldCheck,ShoppingBasket,UsersRound} from 'lucide-react';
import {useAppStore} from '@/store/useAppStore';
import {isSuperadminUid} from '@/lib/access/roles';
import {safeUid} from '@/lib/access/staffReadinessPolicy';
import {type IntegrityFinding,type IntegrityArea,type IntegritySummary} from '@/lib/access/staffIntegrityPolicy';
import {inspectStaffIntegrity} from '@/lib/access/staffIntegrityClient';
import {StaffEmpty,StaffMetric,StaffPageHeader,StaffPanel} from '@/components/access/StaffPremium';
import {toast} from '@/lib/operational-toast';
import {staffTouch} from '@/lib/access/staffTouch';
const areaMeta:{area:IntegrityArea;label:string;icon:typeof Eye;tone:string}[]=[
  {area:'home',label:'Início',icon:UsersRound,tone:'text-emerald-300'},
  {area:'routes',label:'Rotas',icon:Bike,tone:'text-sky-300'},
  {area:'deliveries',label:'Entregas',icon:Package,tone:'text-sky-300'},
  {area:'stock',label:'Estoque',icon:Boxes,tone:'text-amber-300'},
  {area:'purchases',label:'Compras',icon:ShoppingBasket,tone:'text-amber-300'},
];
const findingName:Record<IntegrityFinding,string>={
  unauthorized_section:'Dados em área não autorizada',
  unsafe_shape:'Campos extras ou conteúdo inválido',
  sensitive_pattern:'Possível informação confidencial',
  source_missing:'Registro original não encontrado',
  snapshot_diverged:'Projeção diferente do registro original',
  wrong_motoboy:'Rota atribuída a outro motoboy',
  route_missing:'Rota associada à entrega não encontrada',
};
export default function StaffIntegrityPage(){
  const router=useRouter();const params=useSearchParams();
  const uid=params.get('uid')||'';
  const owner=isSuperadminUid(useAppStore(s=>s.user?.uid));
  const [report,setReport]=useState<IntegritySummary|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const seq=useRef(0);
  const refresh=useCallback(async(showToast=false)=>{
    if(!owner||!safeUid(uid)||isSuperadminUid(uid))return;
    const current=++seq.current;
    setBusy(true);setError('');setReport(null);
    try{
      const data=await inspectStaffIntegrity(uid);
      if(current!==seq.current)return;
      setReport(data);
      if(showToast)toast.success('Auditoria concluída.',{description:'Nenhuma alteração foi feita no Firebase.'});
    }catch(e){
      if(current!==seq.current)return;
      const reason=e instanceof Error?e.message:'O servidor não respondeu.';
      setError(reason);
      if(showToast)toast.error('Não foi possível auditar a conta.',{description:reason});
    }finally{if(current===seq.current)setBusy(false);}
  },[owner,uid]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>()=>{seq.current+=1;},[]);
  if(!owner)return <div className="dfl-page p-5"><StaffEmpty icon={LockKeyhole} title="Acesso restrito" subtitle="Somente o administrador pode conferir projeções da equipe."/></div>;
  if(!safeUid(uid)||isSuperadminUid(uid))return <div className="dfl-page space-y-3 p-5"><StaffEmpty icon={ShieldAlert} title="Selecione uma conta válida" subtitle="Abra a auditoria pela tela de Prontidão da equipe."/><button type="button" onClick={()=>router.push('/mais/acessos/prontidao')} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-bold">Voltar à Prontidão</button></div>;
  return <div className="dfl-page space-y-4 pb-28 text-zinc-100">
    <StaffPageHeader eyebrow="Equipe · Segurança" title="Auditoria profunda" icon={FileSearch} loading={busy} onBack={()=>router.push('/mais/acessos/prontidao')} onRefresh={()=>{staffTouch();void refresh(true);}}/>
    <StaffPanel icon={ShieldCheck} tone="green" title="Conferência de origem e permissões" subtitle="Compara pequenas amostras com os registros oficiais do servidor. Não modifica rotas, estoque, conta ou permissões."/>
    {busy&&<div className="space-y-2" role="status" aria-live="polite"><div className="h-20 animate-pulse rounded-2xl bg-zinc-900"/><div className="h-28 animate-pulse rounded-2xl bg-zinc-900"/><p className="text-center text-xs text-zinc-500">Conferindo documentos autorizados e suas origens...</p></div>}
    {error&&<div role="alert" className="rounded-[20px] border border-rose-500/25 bg-rose-500/[.06] p-4"><p className="flex items-center gap-2 text-sm font-black text-rose-200"><ShieldAlert size={17}/> Auditoria indisponível</p><p className="mt-2 text-xs leading-relaxed text-zinc-400">{error}</p><button type="button" onClick={()=>{staffTouch();void refresh(true);}} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-500/10 px-4 text-xs font-bold text-rose-200"><RefreshCw size={14}/> Tentar novamente</button></div>}
    {report&&<>
      <StaffPanel icon={UsersRound} tone={report.status==='active'?'amber':'neutral'} title={report.displayName||'Funcionário'} subtitle={`${report.role} · ${report.status} · UID ${report.uid.slice(0,6)}…`}>
        <p className="mt-2 text-[11px] text-zinc-500">{report.staffLinked?'Vínculo de motoboy cadastrado':'Nenhum vínculo de motoboy informado — necessário apenas para esse perfil.'}</p>
      </StaffPanel>
      <div className="grid grid-cols-3 gap-2">
        <StaffMetric label="Registros" value={report.totals.scanned} icon={Eye} tone="green"/>
        <StaffMetric label="Divergências" value={report.totals.alerts} icon={AlertTriangle} tone={report.totals.alerts?'rose':'green'}/>
        <StaffMetric label="Áreas parciais" value={report.totals.truncatedAreas} icon={ClipboardCheck} tone={report.totals.truncatedAreas?'amber':'neutral'}/>
      </div>
      <StaffPanel icon={FileSearch} tone="sky" title="Comparação por área" subtitle={`Até ${report.sampleLimit} registros por área, leitura apenas sob demanda. O limite evita excesso de consultas.`}/>
      <section className="space-y-2" aria-label="Resultado das áreas">
        {report.areas.map(area=>{
          const meta=areaMeta.find(x=>x.area===area.area)!;
          const Icon=meta.icon;
          const findings=Object.entries(area.findings).filter(([,count])=>Boolean(count)) as [IntegrityFinding,number][];
          return <article key={area.area} className={`rounded-[21px] border p-4 ${findings.length?'border-amber-500/20 bg-amber-500/[.035]':'border-zinc-800 bg-zinc-900/45'}`}>
            <div className="flex items-center gap-3"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-zinc-950/70 ${meta.tone}`}><Icon size={19}/></div><div className="min-w-0 flex-1"><h3 className="text-sm font-black">{meta.label}</h3><p className="mt-1 text-[11px] text-zinc-400">{area.sampled} documentos comparados {area.truncated?'· amostra parcial':''}</p></div><span className={`rounded-lg px-2 py-1 text-[10px] font-black ${findings.length?'bg-amber-500/10 text-amber-200':'bg-emerald-500/10 text-emerald-300'}`}>{findings.length?`${findings.reduce((n,[,v])=>n+v,0)} alerta(s)`:'Sem alerta local'}</span></div>
            {findings.length>0&&<div className="mt-3 space-y-1 border-t border-zinc-800/80 pt-3">{findings.map(([code,count])=><p key={code} className="flex items-start gap-2 text-xs leading-relaxed text-amber-200"><AlertTriangle size={14} className="mt-0.5 shrink-0"/>{findingName[code]} · {count}</p>)}</div>}
          </article>;
        })}
      </section>
      <StaffPanel icon={ShieldAlert} tone="amber" title="Não libera funcionários" subtitle="A auditoria é limitada e não verifica as regras efetivamente publicadas no Firebase. Uma amostra sem alertas não é autorização para ativar contas."/>
      <p className="flex items-center gap-2 px-1 text-[11px] text-zinc-500"><Clock3 size={13}/> Conferido em {new Date(report.checkedAt).toLocaleString('pt-BR')} · {report.verification==='sample_only'?'Amostra, não varredura integral':''}</p>
    </>}
  </div>;
}
