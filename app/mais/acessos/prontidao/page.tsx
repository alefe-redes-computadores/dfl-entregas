'use client';
/** R30: painel premium de auditoria estritamente read-only, sem ativacao nem polling. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Boxes, ClipboardList, Clock3, Database, Eye, Fingerprint, LockKeyhole, Package, SearchCheck, ShieldAlert, ShieldCheck, ShieldX, ShoppingBasket, UsersRound, FileCheck2, BarChart3 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/lib/operational-toast';
import { isSuperadminUid } from '@/lib/access/roles';
import { inspectStaffReadiness } from '@/lib/access/staffReadinessClient';
import { READINESS_SECTIONS, type ReadinessIssue, type ReadinessSummary } from '@/lib/access/staffReadinessPolicy';
import { staffTouch } from '@/lib/access/staffTouch';
import { StaffEmpty, StaffMetric, StaffNavRow, StaffPageHeader, StaffPanel } from '@/components/access/StaffPremium';

const names: Record<ReadinessIssue,string> = {
  uid_invalido:'Identidade divergente do cadastro',
  conta_ativa:'Conta ativa: confirmar homologação antes de uso',
  status_invalido:'Status inválido', perfil_invalido:'Perfil desconhecido',
  permissoes_invalidas:'Permissões fora do contrato',
  vinculo_motoboy_ausente:'Motoboy sem vínculo válido',
  permissao_administrativa:'Permissão administrativa indevida',
  permissao_cruzada:'Permissões incompatíveis com o perfil',
  projecao_antiga:'Projeção desatualizada ou sem data (24 h)',
};
const sectionName={home:'Início',routes:'Rotas',deliveries:'Entregas',stock:'Estoque',purchases:'Compras'};
const sectionIcon={home:ShieldCheck,routes:ClipboardList,deliveries:Package,stock:Boxes,purchases:ShoppingBasket};
const flagNames:[string,keyof ReadinessSummary['flags']][] = [
  ['Portal de funcionários','staffPortal'],['Solicitações da equipe','staffRequests'],
  ['Conciliação canônica','canonicalApply'],['Sincronização de projeções','projectionRefresh'],
  ['Origens HTTPS separadas','originsSeparated'],
];
export default function StaffReadinessPage(){
  const router=useRouter();
  const uid=useAppStore(s=>s.user?.uid);
  const owner=isSuperadminUid(uid);
  const [report,setReport]=useState<ReadinessSummary|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [onlyWarnings,setOnlyWarnings]=useState(false);
  const epoch=useRef(0);
  const refresh=useCallback(async(showFeedback=false)=>{
    if(!owner)return;
    const seq=++epoch.current;
    setLoading(true);setError('');
    try{
      const response=await inspectStaffReadiness();
      if(seq!==epoch.current)return;
      setReport(response);
      if(showFeedback)toast.success('Diagnóstico atualizado.',{description:'Nenhuma permissão foi modificada.'});
    }catch(e){
      const message=e instanceof Error?e.message:'Não foi possível consultar o servidor.';
      if(seq!==epoch.current)return;
      setReport(null);setError(message);
      if(showFeedback)toast.error('A auditoria não foi concluída.',{description:message});
    }finally{if(seq===epoch.current)setLoading(false);}
  },[owner]);
  useEffect(()=>{void refresh(false);},[refresh]);
  useEffect(()=>()=>{epoch.current+=1;},[]);
  const issues=useMemo(()=>report?.accounts.reduce((sum,a)=>sum+a.issues.length,0)||0,[report]);
  const visible=useMemo(()=>report?.accounts.filter(a=>!onlyWarnings||a.issues.length>0||Object.keys(a.projectionRisks||{}).length>0)||[],[report,onlyWarnings]);
  if(!owner)return <div className="dfl-page p-6"><StaffEmpty icon={LockKeyhole} title="Acesso exclusivo do proprietário" subtitle="A auditoria da equipe não está disponível nesta conta."/></div>;
  return <div className="dfl-page space-y-4 pb-28 text-zinc-100">
    <StaffPageHeader eyebrow="Equipe · Segurança" title="Prontidão da equipe" icon={Fingerprint} loading={loading}
      onBack={()=>router.push('/mais/acessos')} onRefresh={()=>void refresh(true)}/>
    <StaffPanel icon={ShieldCheck} tone="green" title="Conferência antes de liberar"
      subtitle="Auditoria sob demanda. Não ativa funcionários, não grava dados e não substitui a verificação das regras publicadas no Firebase."/>
    {loading&&!report&&<div aria-live="polite" className="space-y-2"><div className="h-20 animate-pulse rounded-2xl bg-zinc-900"/><div className="h-28 animate-pulse rounded-2xl bg-zinc-900"/><p className="text-center text-xs text-zinc-500">Consultando o servidor com sua autorização...</p></div>}
    {error&&<div role="alert" className="rounded-[19px] border border-rose-500/25 bg-rose-500/[.06] p-4"><p className="flex items-center gap-2 text-sm font-bold text-rose-300"><ShieldX size={17}/> Não foi possível consultar</p><p className="mt-2 text-xs leading-relaxed text-zinc-400">{error}</p><button type="button" onClick={()=>void refresh(true)} className="mt-3 min-h-11 rounded-xl bg-rose-500/15 px-4 text-xs font-black text-rose-200">Tentar novamente</button></div>}
    {report&&<>
      <div className="grid grid-cols-3 gap-2">
        <StaffMetric label="Contas na amostra" value={report.accounts.length} icon={UsersRound} tone="green"/>
        <StaffMetric label="Alertas de contas" value={issues} icon={AlertTriangle} tone={issues?'amber':'green'}/>
        <StaffMetric label="Projeções suspeitas" value={report.projectionHealth?.unsafe ?? '—'} icon={SearchCheck} tone={report.projectionHealth?.unsafe?'rose':'neutral'}/>
      </div>
      <StaffPanel title="Custo desta amostra" icon={BarChart3} tone="neutral"
        subtitle={report.readBudget?.mode==='manual_sample'
          ?`${report.readBudget.queryAttempts} consultas realizadas e ${report.readBudget.documentsObserved} documentos devolvidos. Até ${report.readBudget.maxProbeConcurrency} sondagens simultâneas.`
          :'Medição indisponível nesta resposta. Não estimar consumo a partir do número de contas.'}>
        <p className="mt-2 text-[11px] text-zinc-500">Não equivale a cobrança real do Firestore. A nova tela oferece detalhes sem consulta extra até você clicar.</p>
        <button type="button" onClick={()=>router.push('/mais/acessos/leituras')} className="mt-2 min-h-11 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 text-xs font-black text-emerald-200">Ver orçamento de leituras</button>
      </StaffPanel>
      <StaffPanel title="Inspeção de projeções" icon={Eye} tone={report.projectionHealth?.unsafe?'rose':'sky'}
        subtitle={`Verificadas ${report.projectionHealth?.sampled ?? 0} amostras de documentos autorizados. ${report.projectionHealth?.unsafe ?? 0} apresentaram campos ou padrões suspeitos.`}>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">A verificação procura campos extras, e-mail, telefone, documento e valores. Uma amostra limpa não garante que todos os registros estejam seguros.</p>
        {(report.projectionHealth?.unsafe ?? 0)>0&&<p className="mt-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200">Bloqueio recomendado: revise as projeções suspeitas antes de liberar qualquer funcionário.</p>}
      </StaffPanel>
      <StaffPanel title="Portões de segurança" icon={LockKeyhole} tone="neutral" subtitle="Flags indicam configuração técnica — não comprovam autorização efetiva.">
        <div className="mt-4 space-y-2">{flagNames.map(([label,key])=><div key={key} className="flex min-h-10 items-center justify-between gap-3 rounded-xl bg-zinc-950/45 px-3 py-2"><p className="text-xs text-zinc-300">{label}</p><span className={`shrink-0 text-[10px] font-black uppercase tracking-wide ${report.flags[key]?'text-amber-300':'text-zinc-500'}`}>{report.flags[key]?'Configurado':'Desligado'}</span></div>)}</div>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">As Rules de produção não são verificadas por esta API. Confirme-as separadamente no Firebase Console.</p>
      </StaffPanel>
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-1"><h2 className="flex items-center gap-2 text-sm font-black"><UsersRound size={17} className="text-emerald-400"/> Contas e projeções</h2><span className="text-[11px] text-zinc-500">{report.accounts.length} na amostra</span></div>
        <div className="flex gap-2" role="group" aria-label="Filtrar contas auditadas">
          <button type="button" aria-pressed={!onlyWarnings} onClick={()=>{staffTouch();setOnlyWarnings(false);}} className={`min-h-11 rounded-xl border px-4 text-xs font-bold ${!onlyWarnings?'border-emerald-500/30 bg-emerald-500/10 text-emerald-200':'border-zinc-800 bg-zinc-900 text-zinc-400'}`}>Todas</button>
          <button type="button" aria-pressed={onlyWarnings} onClick={()=>{staffTouch();setOnlyWarnings(true);}} className={`min-h-11 rounded-xl border px-4 text-xs font-bold ${onlyWarnings?'border-amber-500/30 bg-amber-500/10 text-amber-200':'border-zinc-800 bg-zinc-900 text-zinc-400'}`}>Com alertas</button>
        </div>
        {!report.accounts.length&&<StaffEmpty icon={UsersRound} title="Nenhuma conta preparada" subtitle="Ao preparar uma conta pelo vínculo Google, ela poderá aparecer nesta auditoria. Isso não libera o login."/>}
        {!visible.length&&report.accounts.length>0&&<StaffEmpty icon={ShieldCheck} title="Nenhuma conta neste filtro" subtitle="Você pode alternar para Todas. Os dados são uma amostra do servidor, não a auditoria integral da base."/>}
        {visible.map(account=><article key={account.uid} className="rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-4">
          <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[15px] ${(account.issues.length||Object.keys(account.projectionRisks||{}).length)?'bg-amber-500/10 text-amber-300':'bg-emerald-500/10 text-emerald-300'}`}><UsersRound size={19}/></span>
            <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black">{account.name}</h3><p className="mt-1 text-[11px] text-zinc-400">{account.role} · {account.status}</p><p className="mt-1 font-mono text-[10px] text-zinc-500">UID {account.uid.slice(0,6)}…</p></div>
            <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ${(account.issues.length||Object.keys(account.projectionRisks||{}).length)?'bg-amber-500/10 text-amber-300':'bg-emerald-500/10 text-emerald-300'}`}>{account.issues.length?`${account.issues.length} alerta(s)`:'Sem alertas locais'}</span></div>
          <div className="mt-3 flex flex-wrap gap-1.5">{READINESS_SECTIONS.filter(k=>account.sections.includes(k)).map(section=>{
            const Icon=sectionIcon[section];return <span key={section} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] ${account.samples[section]?'border-sky-500/20 bg-sky-500/[.05] text-sky-300':'border-zinc-700 text-zinc-500'}`}><Icon size={12}/>{sectionName[section]} · {account.samples[section]?'amostra':'vazia'}</span>;
          })}</div>
          {Object.entries(account.projectionRisks||{}).length>0&&<div role="alert" className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/[.055] p-3">
            <p className="text-xs font-black text-rose-200">Revisar projeções do funcionário</p>
            {Object.entries(account.projectionRisks||{}).map(([section,found])=><p key={section} className="mt-1 text-[11px] text-rose-200/90">{sectionName[section as keyof typeof sectionName]}: {(Array.isArray(found)?found:[]).map(x=>x==='unexpected_field'?'campo extra':x==='invalid_text'?'texto inválido':'possível dado sensível').join(' · ')}</p>)}
          </div>}
          {!!account.issues.length&&<div className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">{account.issues.map(issue=><p key={issue} className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-200"><AlertTriangle size={13} className="mt-0.5 shrink-0"/>{names[issue]}</p>)}</div>}
          <button type="button" onClick={()=>{staffTouch();router.push(`/mais/acessos/integridade?uid=${encodeURIComponent(account.uid)}`);}}
            className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-[14px] border border-sky-500/20 bg-sky-500/[.055] px-3 text-xs font-black text-sky-200 transition-colors active:bg-sky-500/15">
            <span className="flex items-center gap-2"><SearchCheck size={15}/> Auditar projeções</span><span className="text-[10px] font-medium text-zinc-500">Verificação profunda</span>
          </button>
        </article>)}
        {(report.accountsTruncated||report.requestsTruncated)&&<p className="rounded-xl border border-amber-500/25 bg-amber-500/[.055] p-3 text-xs text-amber-200">A amostra atingiu o limite. Os números não representam toda a base.</p>}
      </section>
      <StaffPanel icon={Database} title="Solicitações operacionais" tone="sky"
        subtitle={`${report.requests.sampled} registros consultados · ${report.requests.pending} pendentes · ${report.requests.inFlight} em análise · ${report.requests.closed} encerrados.`}>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">Amostra limitada a 100 registros, sem varredura contínua ou garantia de ordem.</p>
      </StaffPanel>
      <section className="space-y-2"><p className="px-1 text-xs font-black text-zinc-200">Próximas ações</p>
        <StaffNavRow tone="sky" icon={FileCheck2} label="Centro de Evidências" detail="Verificações manuais, riscos e relatório seguro" onClick={()=>router.push('/mais/acessos/evidencias')}/>
        <StaffNavRow tone="green" icon={Fingerprint} label="Revisar vínculo Google e reprojetar" detail="Conferência manual de identidade" onClick={()=>router.push('/mais/acessos/homologacao')}/>
        <StaffNavRow tone="sky" icon={ClipboardList} label="Solicitações da equipe" detail="Conferência e conciliação administrativa" onClick={()=>router.push('/mais/acessos/solicitacoes')}/>
        <StaffNavRow tone="rose" icon={LockKeyhole} label="Revogar acesso" detail="Suspender conta e limpar projeções" onClick={()=>router.push('/mais/acessos/revogacao')}/>
      </section>
      <p className="flex items-center gap-2 px-1 text-[11px] text-zinc-500"><Clock3 size={13}/> Conferido em {new Date(report.checkedAt).toLocaleString('pt-BR')} · Atualização manual</p>
    </>}
    <StaffPanel tone="amber" icon={ShieldAlert} title="Ativação continua bloqueada"
      subtitle="Mesmo sem alertas locais, ainda precisamos verificar as regras online, o domínio isolado, a autorização dos endpoints e o comportamento com outra conta Google."/>
  </div>;
}
