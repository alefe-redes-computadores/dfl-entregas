'use client';
/** R38 — observabilidade manual de consultas; nao e uma tela de liberacao. */
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Activity,AlertTriangle,BarChart3,Copy,Database,LockKeyhole,RefreshCw,ShieldAlert,ShieldCheck,Zap,ServerCog} from 'lucide-react';
import {useAppStore} from '@/store/useAppStore';
import {isSuperadminUid} from '@/lib/access/roles';
import {inspectStaffReadiness} from '@/lib/access/staffReadinessClient';
import type {ReadinessSummary} from '@/lib/access/staffReadinessPolicy';
import {safeReadBudgetReport} from '@/lib/access/staffReadBudget';
import {StaffEmpty,StaffMetric,StaffNavRow,StaffPageHeader,StaffPanel} from '@/components/access/StaffPremium';
import {staffTouch} from '@/lib/access/staffTouch';
import {toast} from '@/lib/operational-toast';
export default function StaffReadsPage(){
 const router=useRouter();const owner=isSuperadminUid(useAppStore(s=>s.user?.uid));
 const [report,setReport]=useState<ReadinessSummary|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const request=useRef(0);
 useEffect(()=>()=>{request.current++;},[]);
 const run=useCallback(async()=>{
  if(!owner||busy)return;
  const id=++request.current;setBusy(true);setError('');setReport(null);
  try{const result=await inspectStaffReadiness();if(request.current!==id)return;
   setReport(result);toast.success('Amostra de leituras concluída.',{description:'Sem mutações ou ativação.'});
  }catch(e){if(request.current!==id)return;
   setError(e instanceof Error?e.message:'Consulta indisponível.');toast.error('Amostra não concluída.');
  }finally{if(request.current===id)setBusy(false);}
 },[owner,busy]);
 const budget=report?.readBudget;
 const valid=useMemo(()=>Boolean(budget&&budget.mode==='manual_sample'&&budget.billedReads==='not_measured'&&
  budget.queryAttempts<=budget.maxQueryAttempts&&budget.documentsObserved<=budget.maxDocumentsObserved&&
  budget.maxProbeConcurrency<=4),[budget]);
 const copy=async()=>{staffTouch();try{await navigator.clipboard.writeText(safeReadBudgetReport(valid&&budget?budget:null,report?.checkedAt||new Date().toISOString()));toast.success('Resumo sem dados pessoais copiado.');}catch{toast.error('Não foi possível copiar.');}};
 if(!owner)return <div className="dfl-page p-5"><StaffEmpty icon={LockKeyhole} title="Somente o proprietário" subtitle="Métricas administrativas não são acessíveis à equipe."/></div>;
 return <div className="dfl-page space-y-3 pb-28 text-zinc-100">
  <StaffPageHeader eyebrow="Equipe · Desempenho" title="Orçamento de leituras" icon={BarChart3} onBack={()=>router.push('/mais/acessos/seguranca')}/>
  <StaffPanel icon={ShieldCheck} title="Amostra controlada" tone="green" subtitle="Consulta manual à mesma API de Prontidão, agora com limite global de quatro sondagens simultâneas. Não cria uma segunda varredura."/>
  <StaffPanel icon={Zap} title="Evitar tempestade de leituras" tone="amber" subtitle="A API observa no máximo 30 contas, 100 solicitações e uma projeção por área autorizada. Cliques simultâneos da mesma sessão compartilham a consulta em andamento; não existe atualização periódica."/>
  <StaffPanel icon={ServerCog} title="R39 · Admissão de auditorias" tone="green" subtitle="Uma Prontidão e uma Integridade profunda por instância do servidor, com intervalo mínimo de 6 segundos por tipo. Requisições excedentes são rejeitadas antes de ler o Firestore. O controle não é distribuído entre instâncias da Vercel."/>
  <button type="button" disabled={busy} onClick={()=>{staffTouch();void run();}} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 text-xs font-black text-emerald-200 transition active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-50"><RefreshCw size={17} className={busy?'animate-spin':''}/>{busy?'Amostrando…':'Executar diagnóstico limitado'}</button>
  {error&&<p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200"><AlertTriangle className="mr-2 inline" size={15}/>{error}</p>}
  {!report&&!busy&&<StaffEmpty icon={Database} title="Nenhuma leitura nesta tela" subtitle="O custo só será observado quando você solicitar. Nenhuma consulta ocorre ao abrir esta página."/>}
  {report&&(report.accountsTruncated||report.requestsTruncated||!report.accounts.length)&&<StaffPanel icon={ShieldAlert} tone="amber" title="Amostra insuficiente para liberação" subtitle="Limite de registros atingido ou nenhuma conta observada. Não confunda a falta de alertas na amostra com aprovação de segurança."/>}
  {report&&!valid&&<StaffPanel tone="rose" icon={ShieldAlert} title="Telemetria ausente ou inconsistente" subtitle="A resposta não passou no contrato R38. Não trate números incompletos como consumo real ou prontidão."/>}
  {report&&valid&&budget&&<>
    <div className="grid grid-cols-3 gap-2"><StaffMetric icon={Activity} label="Consultas da API" value={budget.queryAttempts} tone="green"/><StaffMetric icon={Database} label="Docs observados" value={budget.documentsObserved} tone="neutral"/><StaffMetric icon={Zap} label="Sondagens paralelas" value={budget.maxProbeConcurrency} tone="amber"/></div>
    <StaffPanel icon={BarChart3} title="Distribuição da amostra" subtitle="Contagem do servidor para esta execução. Não representa a cobrança da Firebase.">
      <div className="mt-3 space-y-3">{([
        ['Contas',budget.accountDocuments,budget.maxDocumentsObserved,'bg-emerald-400'],
        ['Solicitações',budget.requestDocuments,101,'bg-amber-400'],
        ['Projeções',budget.projectionDocuments,150,'bg-sky-400'],
      ] as const).map(([label,count,max,tone])=><div key={label}>
        <div className="mb-1 flex justify-between gap-2 text-[11px]"><span className="text-zinc-300">{label}</span><span className="font-bold tabular-nums text-zinc-100">{count}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className={`h-full rounded-full ${tone}`} style={{width:`${Math.min(100,Math.max(0,count/max*100))}%`}}/></div>
      </div>)}</div>
      <p className="mt-3 text-[11px] text-zinc-500">Máximo teórico da consulta: {budget.maxQueryAttempts} consultas, {budget.maxDocumentsObserved} documentos devolvidos. Registros vazios, índices e transações podem mudar o custo cobrado.</p>
    </StaffPanel>
    <p className="px-1 text-[11px] text-zinc-500">R39 · {report.auditGuard?.mode==='instance_only'?'Proteção local do servidor observada nesta resposta':'Proteção de admissão não confirmada na resposta'} · Amostra gerada em {new Date(report.checkedAt).toLocaleString('pt-BR')} · {report.accountsTruncated||report.requestsTruncated?'Limite de amostragem atingido':'Sem truncamento detectado na amostra'}.</p>
   </>}
  <button type="button" onClick={()=>void copy()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-black focus-visible:outline focus-visible:outline-emerald-400"><Copy size={16}/> Copiar resumo anônimo</button>
  <StaffNavRow icon={ShieldCheck} tone="green" label="Gate de liberação" detail="Amostra técnica não aprova publicação ou acesso" onClick={()=>router.push('/mais/acessos/liberacao')}/>
  <StaffPanel icon={LockKeyhole} tone="rose" title="Nenhuma liberação" subtitle="Sem regras em produção, medição de cobrança real, homologação de outra conta e autorização explícita, o acesso de funcionários continua bloqueado."/>
 </div>;
}
