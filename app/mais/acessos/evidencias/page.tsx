'use client';
/** R34: Centro de evidencias; todas as consultas sao manuais e owner-only. */
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Activity,AlertTriangle,ClipboardCheck,CloudCog,Copy,Eye,FileCheck2,KeyRound,LockKeyhole,RefreshCw,ScanSearch,ShieldAlert,ShieldCheck,UsersRound} from 'lucide-react';
import {useAppStore} from '@/store/useAppStore';
import {isSuperadminUid} from '@/lib/access/roles';
import {inspectStaffReadiness} from '@/lib/access/staffReadinessClient';
import {inspectStaffIntegrity} from '@/lib/access/staffIntegrityClient';
import {type ReadinessSummary} from '@/lib/access/staffReadinessPolicy';
import {type IntegritySummary} from '@/lib/access/staffIntegrityPolicy';
import {assessStaffRelease,RELEASE_LABELS} from '@/lib/access/staffReleasePolicy';
import {createSafeReleaseReport} from '@/lib/access/staffReleaseReport';
import {StaffEvidenceItem} from '@/components/access/StaffEvidenceItem';
import {StaffEmpty,StaffMetric,StaffPageHeader,StaffPanel,StaffNavRow} from '@/components/access/StaffPremium';
import {staffTouch} from '@/lib/access/staffTouch';
import {toast} from '@/lib/operational-toast';

const steps=[
  {id:'rules',label:'Conferir regras publicadas',detail:'Abrir Firebase Console e verificar explicitamente as Rules de produção. O emulador não prova o deploy.'},
  {id:'emulator',label:'Validar a Action do emulador',detail:'Conferir o resultado verde mais recente da suíte de segurança no GitHub Actions.'},
  {id:'origins',label:'Confirmar domínios HTTPS separados',detail:'Usar origens distintas e armazenamento isolado para proprietário e funcionário.'},
  {id:'identity',label:'Homologar uma conta Google diferente',detail:'Validar UID e e-mail verificado. A conta permanece suspensa nesta fase.'},
  {id:'device',label:'Testar bloqueio e revogação em dispositivo',detail:'Confirmar que sessão offline, cache e token revogado não exibem dados anteriores.'},
  {id:'operations',label:'Testar entrega e compra ponta a ponta',detail:'Validar idempotência, cliente, Site/iFood e ledger com ambiente e contas apropriados.'},
] as const;
type StepId=typeof steps[number]['id'];
export default function StaffEvidencePage(){
  const router=useRouter();
  const owner=isSuperadminUid(useAppStore(s=>s.user?.uid));
  const [readiness,setReadiness]=useState<ReadinessSummary|null>(null);
  const [integrity,setIntegrity]=useState<IntegritySummary|null>(null);
  const [uid,setUid]=useState('');
  const [busy,setBusy]=useState(false);
  const [deepBusy,setDeepBusy]=useState(false);
  const [error,setError]=useState('');
  const [deepError,setDeepError]=useState('');
  const [manual,setManual]=useState<Partial<Record<StepId,boolean>>>({});
  const requestId=useRef(0);
  const selectedId=useRef(0);
  const refresh=useCallback(async(showToast=false)=>{
    if(!owner)return;
    const run=++requestId.current;
    ++selectedId.current;
    setBusy(true);setDeepBusy(false);setError('');setReadiness(null);setIntegrity(null);setUid('');setManual({});setDeepError('');
    try{const result=await inspectStaffReadiness();
      if(requestId.current!==run)return;
      setReadiness(result);
      if(showToast)toast.success('Prontidão consultada.',{description:'Diagnóstico apenas de leitura.'});
    }catch(e){if(requestId.current!==run)return;const message=e instanceof Error?e.message:'Sem resposta do servidor.';setError(message);if(showToast)toast.error('Prontidão indisponível.',{description:message});}
    finally{if(requestId.current===run)setBusy(false);}
  },[owner]);
  useEffect(()=>{return ()=>{requestId.current++;selectedId.current++;};},[]);
  const select=useCallback((next:string)=>{selectedId.current++;setUid(next);setDeepBusy(false);setIntegrity(null);setDeepError('');setManual({});staffTouch();},[]);
  const deep=useCallback(async()=>{
    if(!owner||!uid||busy)return;
    const run=++selectedId.current;
    setIntegrity(null);setDeepError('');setDeepBusy(true);
    try{const result=await inspectStaffIntegrity(uid);
      if(selectedId.current!==run)return;
      setIntegrity(result);toast.success('Comparação realizada.',{description:'Nenhuma projeção foi alterada.'});
    }catch(e){if(selectedId.current!==run)return;const message=e instanceof Error?e.message:'Auditoria indisponível.';setDeepError(message);toast.error('Falha na comparação.',{description:message});}
    finally{if(selectedId.current===run)setDeepBusy(false);}
  },[owner,uid,busy]);
  const assessment=useMemo(()=>assessStaffRelease(readiness,integrity,uid,Date.now()),[readiness,integrity,uid]);
  const confirmed=steps.filter(x=>manual[x.id]).length;
  const copy=async()=>{
    staffTouch();
    try{await navigator.clipboard.writeText(createSafeReleaseReport(assessment,new Date().toISOString()));
      toast.success('Resumo seguro copiado.',{description:'Sem nomes, UIDs ou dados de clientes.'});
    }catch{toast.error('Não foi possível copiar.',{description:'Confirme a permissão da área de transferência neste dispositivo.'});}
  };
  if(!owner)return <div className="dfl-page p-5"><StaffEmpty icon={LockKeyhole} title="Área exclusiva do proprietário" subtitle="O Centro de Evidências não aceita contas de funcionários."/></div>;
  return <div className="dfl-page space-y-4 pb-28 text-zinc-100">
    <StaffPageHeader eyebrow="Equipe · Homologação" title="Centro de Evidências" icon={FileCheck2} loading={busy} onBack={()=>router.push('/mais/acessos/seguranca')} onRefresh={()=>void refresh(true)}/>
    <StaffPanel icon={LockKeyhole} tone="amber" title="Ativação indisponível" subtitle="Este painel é uma conferência limitada. Não publica Rules, não ativa login, não aceita provas automáticas de dispositivos nem movimenta estoque."/>
    <div className="grid grid-cols-3 gap-2"><StaffMetric icon={UsersRound} label="Contas na amostra" value={assessment.samples.accounts} tone="neutral"/><StaffMetric icon={Eye} label="Documentos consultados" value={assessment.samples.readinessDocuments+assessment.samples.deepDocuments} tone="sky"/><StaffMetric icon={AlertTriangle} label="Pendências e ressalvas" value={assessment.findings.length} tone="amber"/></div>
    <StaffPanel icon={Activity} title="1. Diagnóstico geral" tone="sky" subtitle="Consulte quando precisar. Sem timer, consultas automáticas recorrentes ou cópia de dados pessoais." >
      <button type="button" disabled={busy} onClick={()=>{staffTouch();void refresh(true);}} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 text-xs font-black text-sky-200 disabled:opacity-50"><RefreshCw size={15} className={busy?'animate-spin':''}/>{busy?'Consultando...':'Consultar prontidão'}</button>
      {readiness&&<p className="mt-3 text-[11px] text-zinc-400">Última consulta: {new Date(readiness.checkedAt).toLocaleString('pt-BR')} · Amostra de até {readiness.accountSampleLimit} contas</p>}
      {error&&<p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
    </StaffPanel>
    <StaffPanel icon={ScanSearch} title="2. Comparar uma conta" tone="neutral" subtitle="Escolha uma conta previamente preparada para conferir suas projeções de forma amostral.">
      {!readiness&&<p className="mt-3 text-xs text-zinc-500">Consulte primeiro a prontidão geral.</p>}
      {readiness&&!readiness.accounts.length&&<p className="mt-3 text-xs text-zinc-500">Nenhuma conta encontrada na amostra.</p>}
      {readiness&&!!readiness.accounts.length&&<div className="mt-3 space-y-2">
        <div className="grid grid-cols-1 gap-2">{readiness.accounts.map(account=><button key={account.uid} type="button" aria-pressed={uid===account.uid} disabled={busy||deepBusy}
          onClick={()=>select(account.uid)} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 text-left text-xs ${uid===account.uid?'border-emerald-500/30 bg-emerald-500/10 text-emerald-200':'border-zinc-800 bg-zinc-950/50 text-zinc-300'} disabled:opacity-40`}>
          <span className="min-w-0 truncate font-bold">{account.name} <span className="font-normal text-zinc-500">· {account.role}</span></span>
          <span className="shrink-0 text-[10px] uppercase">{account.status==='active'?'Ativa':'Suspensa'}</span>
        </button>)}</div>
        <button type="button" disabled={!uid||deepBusy||busy} onClick={()=>{staffTouch();void deep();}} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 text-xs font-black text-sky-200 disabled:opacity-40"><ScanSearch size={16}/>{deepBusy?'Comparando registros...':'Auditar conta selecionada'}</button>
        {integrity&&<p className="text-xs text-amber-200">Amostra profunda: {integrity.totals.scanned} documentos; {integrity.totals.alerts} divergência(s); {integrity.totals.truncatedAreas} área(s) parciais.</p>}
        {deepError&&<p role="alert" className="text-xs text-rose-300">{deepError}</p>}
      </div>}
    </StaffPanel>
    <StaffPanel icon={ShieldAlert} title="3. Pendências técnicas" tone="amber" subtitle="Mesmo sem divergências, há verificações que o aplicativo não consegue comprovar sozinho.">
      <div className="mt-3 space-y-2">{assessment.findings.map(risk=><p key={risk} className="flex items-start gap-2 text-xs leading-relaxed text-amber-100/90"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400"/>{RELEASE_LABELS[risk]}</p>)}</div>
    </StaffPanel>
    <section className="space-y-2"><div className="flex items-center justify-between"><h2 className="text-sm font-black">4. Conferência manual</h2><span className="text-[11px] text-zinc-500">{confirmed}/{steps.length} nesta sessão</span></div>
      <p className="text-[11px] leading-relaxed text-zinc-500">Marcar um item registra apenas sua conferência nesta tela. Não equivale a evidência de aprovação, não persiste e não desbloqueia o aplicativo.</p>
      {steps.map(step=><StaffEvidenceItem key={step.id} label={step.label} detail={step.detail} checked={manual[step.id]===true} onChange={checked=>setManual(current=>({...current,[step.id]:checked}))}/>)}
    </section>
    <button type="button" onClick={()=>void copy()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 text-xs font-black text-emerald-200"><Copy size={16}/> Copiar relatório sem dados pessoais</button>
    <StaffNavRow icon={FileCheck2} tone="amber" label="Gate de publicação R37" detail="Revisar CI, Emulator e limites sem liberar equipe" onClick={()=>router.push('/mais/acessos/liberacao')}/>
    <StaffNavRow icon={CloudCog} tone="sky" label="Sincronização de projeções" detail="Comparação segura por UID; atualizações bloqueadas por padrão" onClick={()=>router.push('/mais/acessos/sincronizacao')}/>
    <StaffNavRow icon={ClipboardCheck} tone="neutral" label="Voltar à Prontidão" detail="Consultar riscos individuais e auditoria profunda" onClick={()=>router.push('/mais/acessos/prontidao')}/>
    <StaffPanel icon={KeyRound} title="Proteção permanente" tone="rose" subtitle="Regras de produção e autorização dos funcionários dependem de uma operação separada, explícita e validada. Este Centro nunca fornece essa autorização."/>
  </div>;
}
