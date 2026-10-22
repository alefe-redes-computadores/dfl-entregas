'use client';
/** R37 — gate owner-only, ZERO consultas automáticas, ZERO mutações ou timers. */
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Activity,AlertTriangle,CheckCircle2,ClipboardCheck,CloudOff,Copy,FileClock,BarChart3,GitBranch,LockKeyhole,RefreshCw,ShieldAlert,ShieldCheck,ShieldX} from 'lucide-react';
import {useAppStore} from '@/store/useAppStore';
import {isSuperadminUid} from '@/lib/access/roles';
import {inspectStaffReadiness} from '@/lib/access/staffReadinessClient';
import type {ReadinessSummary} from '@/lib/access/staffReadinessPolicy';
import {assessTechnicalGate,safeTechnicalGateReport} from '@/lib/access/staffTechnicalGate';
import {StaffEmpty,StaffMetric,StaffNavRow,StaffPageHeader,StaffPanel} from '@/components/access/StaffPremium';
import {staffTouch} from '@/lib/access/staffTouch';
import {toast} from '@/lib/operational-toast';
const packages=[
 ['R27–R29','Solicitações, execução canônica, prontidão'],
 ['R30.2–R32','Formulários premium, identidade, inspeção'],
 ['R33–R34','Auditoria profunda e evidências'],
 ['R35–R36','Prévia, sincronização e atomicidade'],
 ['R37','Gate técnico, CI demo e inventário de release'],
 ['R38–R39','Orçamento de leituras, concorrência e admissão'],
 ['R40.1–R42','Operação global, convites Google e perfis funcionais'],
 ['R43–R44','Segurança de convites, painéis e testes candidatos'],
 ['R45','Fluxos sem estado antigo e listas operacionais progressivas'],
 ['R46.1','Cards financeiros, Compras e Estoque'],
 ['R47–R48','Sync indexada e multipedidos por abas'],
 ['R49','Cards de rotas sob demanda e proteção contra toque duplo em compras'],
] as const;
export default function StaffTechnicalReleasePage(){
 const router=useRouter();const owner=isSuperadminUid(useAppStore(s=>s.user?.uid));
 const [report,setReport]=useState<ReadinessSummary|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const request=useRef(0);
 useEffect(()=>()=>{request.current++;},[]);
 const load=useCallback(async()=>{
  if(!owner||busy)return;
  const run=++request.current;setBusy(true);setError('');setReport(null);
  try{const data=await inspectStaffReadiness();if(run!==request.current)return;
   setReport(data);toast.success('Diagnóstico consultado.',{description:'Apenas leitura limitada, sem liberar equipe.'});
  }catch(e){if(run!==request.current)return;setError(e instanceof Error?e.message:'Consulta indisponível.');toast.error('Diagnóstico não concluído.');}
  finally{if(run===request.current)setBusy(false);}
 },[owner,busy]);
 const gate=useMemo(()=>assessTechnicalGate(report),[report]);
 const copy=async()=>{staffTouch();try{await navigator.clipboard.writeText(safeTechnicalGateReport(gate,new Date().toISOString()));toast.success('Relatório técnico copiado.',{description:'Sem dados pessoais.'});}catch{toast.error('Não foi possível copiar o relatório.');}};
 if(!owner)return <div className="dfl-page p-5"><StaffEmpty title="Gate exclusivo do proprietário" subtitle="Funcionários não acessam os dados técnicos de publicação." icon={LockKeyhole}/></div>;
 return <div className="dfl-page space-y-3 pb-28 text-zinc-100">
  <StaffPageHeader eyebrow="Equipe · Release" title="Portão de liberação" icon={GitBranch} onBack={()=>router.push('/mais/acessos/seguranca')}/>
  <StaffPanel icon={ShieldX} tone="rose" title="Publicação não autorizada" subtitle="A instalação local não equivale a publicação. Passar testes não publica Rules nem autoriza funcionários."/>
  <div className="grid grid-cols-3 gap-2"><StaffMetric icon={FileClock} label="Emulator pendente" value="—" tone="amber"/><StaffMetric icon={ClipboardCheck} label="Etapas técnicas" value={gate.checks.length} tone="neutral"/><StaffMetric icon={LockKeyhole} label="Acesso bloqueado" value="—" tone="rose"/></div>
  <StaffPanel icon={GitBranch} title="Inventário para revisão" subtitle="Lote local desde a base publicada R26.1. Nenhuma versão listada equivale a commit, push ou deploy.">
   <div className="mt-3 space-y-1.5">{packages.map(([label,detail])=><div key={label} className="flex items-center gap-3 rounded-xl bg-zinc-950/40 px-3 py-2.5"><span className="min-w-[80px] text-[11px] font-black text-emerald-300">{label}</span><span className="min-w-0 text-[11px] text-zinc-400">{detail}</span></div>)}</div>
  </StaffPanel>
  <StaffPanel icon={Activity} title="Conferência do servidor" tone="neutral" subtitle="Consulta limitada a 30 contas, 100 solicitações e até cinco amostras por conta. Sem listeners ou atualizações automáticas.">
   <button type="button" disabled={busy} onClick={()=>{staffTouch();void load();}} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-black text-emerald-200 disabled:opacity-40"><RefreshCw size={16} className={busy?'animate-spin':''}/>{busy?'Consultando…':'Consultar flags e amostra'}</button>
   {report&&<p className="mt-2 text-[11px] text-zinc-400">Leitura recebida às {new Date(report.checkedAt).toLocaleString('pt-BR')} · {report.accounts.length} conta(s) amostrada(s). Não é verificação das Rules.</p>}
   {error&&<p role="alert" className="mt-2 flex items-start gap-2 text-xs text-rose-300"><AlertTriangle size={16} className="shrink-0"/>{error}</p>}
  </StaffPanel>
  <section className="space-y-2" aria-label="Portões técnicos"><h2 className="px-1 text-sm font-black">Condições obrigatórias</h2>
   {gate.checks.map(c=>{const Icon=c.state==='observed'?CheckCircle2:c.state==='blocked'?ShieldAlert:CloudOff;
    return <div key={c.id} className="flex items-start gap-3 rounded-[18px] border border-zinc-800 bg-zinc-900/45 p-3.5"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${c.state==='observed'?'bg-emerald-500/10 text-emerald-300':c.state==='blocked'?'bg-rose-500/10 text-rose-300':'bg-amber-500/10 text-amber-300'}`}><Icon size={18}/></span>
     <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-1"><h3 className="text-xs font-black text-zinc-100">{c.label}</h3><span className="text-[10px] font-bold uppercase text-zinc-500">{c.state==='observed'?'Somente observado':c.state==='blocked'?'Bloqueado':'Pendente'}</span></div><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{c.detail}</p></div></div>;
   })}
  </section>
  <button type="button" onClick={()=>void copy()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-black text-zinc-100"><Copy size={16}/> Copiar relatório sem dados privados</button>
  <StaffNavRow icon={BarChart3} tone="green" label="Orçamento de leituras R38" detail="Sondagens limitadas e estimativas, sem leituras automáticas" onClick={()=>router.push('/mais/acessos/leituras')}/>
  <StaffNavRow icon={ShieldCheck} tone="green" label="Centro de Evidências" detail="Auditorias de contas e projeções; sem autorizar acesso" onClick={()=>router.push('/mais/acessos/evidencias')}/>
  <StaffPanel icon={ShieldCheck} tone="neutral" title="R39–R49 · Auditoria controlada" subtitle="A admissão por instância evita duas varreduras iguais ao mesmo tempo e aplica intervalo manual. Não é rate limit distribuído, nem prova de Rules em produção."/>
  <StaffPanel icon={ShieldAlert} tone="amber" title="Separação inegociável" subtitle="Validação técnica ≠ aprovação de publicação ≠ autorização de funcionários. Cada decisão depende de comprovação externa e autorização explícita."/>
 </div>;
}
