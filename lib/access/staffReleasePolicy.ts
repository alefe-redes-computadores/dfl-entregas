/** R34: avaliacao PURA e conservadora da prontidao. Nunca autoriza login. */
import type { ReadinessSummary } from './staffReadinessPolicy';
import type { IntegritySummary } from './staffIntegrityPolicy';

export type ReleaseRisk =
  | 'no_readiness' | 'readiness_stale' | 'accounts_missing' | 'accounts_truncated'
  | 'account_risks' | 'unsafe_projections' | 'pending_operations'
  | 'flags_on' | 'isolated_origin_missing' | 'selected_not_in_sample'
  | 'selected_active' | 'no_integrity' | 'integrity_mismatch'
  | 'integrity_stale' | 'integrity_risks' | 'integrity_partial'
  | 'live_rules_unverified' | 'staff_identity_unverified' | 'real_device_unverified';
export interface ReleaseAssessment {
  status: 'blocked';
  /** A ordem e fixa para relatórios comparáveis. */
  findings: ReleaseRisk[];
  samples: {accounts:number;readinessDocuments:number;deepDocuments:number};
  deepVerified: boolean;
  /** FALSO sempre: politica de producao nao e avaliada por esta API. */
  eligibleForActivation:false;
}
export const RELEASE_LABELS:Record<ReleaseRisk,string>={
  no_readiness:'Prontidão geral ainda não consultada',
  readiness_stale:'Prontidão geral desatualizada ou com horário inválido',
  accounts_missing:'Nenhuma conta preparada encontrada na amostra',
  accounts_truncated:'Amostra de contas ou solicitações atingiu o limite',
  account_risks:'Contas apresentam alertas de identidade, vínculo ou permissão',
  unsafe_projections:'Projeções com campos inesperados, suspeitos ou não avaliados',
  pending_operations:'Solicitações operacionais pendentes ou em processamento',
  flags_on:'Alguma porta operacional de funcionário já está configurada',
  isolated_origin_missing:'Origens HTTPS independentes não foram confirmadas',
  selected_not_in_sample:'A conta selecionada não consta no diagnóstico geral',
  selected_active:'Conta selecionada não está suspensa',
  no_integrity:'Auditoria profunda da conta ainda não foi executada',
  integrity_mismatch:'Resultado profundo não pertence à conta ou formato esperado',
  integrity_stale:'Auditoria profunda desatualizada ou com horário inválido',
  integrity_risks:'Auditoria profunda encontrou divergências ou dados suspeitos',
  integrity_partial:'Auditoria profunda não cobre os documentos de todas as áreas',
  live_rules_unverified:'Regras efetivas de produção não verificadas neste painel',
  staff_identity_unverified:'Login da conta Google de teste não homologado ponta a ponta',
  real_device_unverified:'Isolamento, revogação e fluxo operacional não testados em dispositivo',
};
const ageOK=(value:unknown,now:number,maxMinutes:number)=>{
  if(typeof value!=='string')return false;
  const millis=Date.parse(value);
  return Number.isFinite(millis)&&millis<=now+60_000&&millis>=now-maxMinutes*60_000;
};
export function assessStaffRelease(
  readiness:ReadinessSummary|null,
  integrity:IntegritySummary|null,
  selectedUid:string,
  now:number,
):ReleaseAssessment {
  const findings:ReleaseRisk[]=[];
  const push=(risk:ReleaseRisk)=>{if(!findings.includes(risk))findings.push(risk);};
  let sampleAccounts=0,readinessDocuments=0,deepDocuments=0,deepVerified=false;
  if(!readiness||readiness.ok!==true||!Array.isArray(readiness.accounts))push('no_readiness');
  else{
    sampleAccounts=readiness.accounts.length;
    readinessDocuments=readiness.projectionHealth?.sampled||0;
    if(!ageOK(readiness.checkedAt,now,15))push('readiness_stale');
    if(!sampleAccounts)push('accounts_missing');
    if(readiness.accountsTruncated||readiness.requestsTruncated)push('accounts_truncated');
    if(readiness.accounts.some(a=>a.issues.length||Object.keys(a.projectionRisks||{}).length))push('account_risks');
    if(!readiness.projectionHealth||readiness.projectionHealth.unsafe>0||readiness.projectionHealth.unknown>0)push('unsafe_projections');
    if(readiness.requests.pending>0||readiness.requests.inFlight>0)push('pending_operations');
    if(readiness.flags.staffPortal||readiness.flags.staffRequests||readiness.flags.canonicalApply||readiness.flags.projectionRefresh)push('flags_on');
    if(!readiness.flags.originsSeparated)push('isolated_origin_missing');
    const match=readiness.accounts.find(a=>a.uid===selectedUid);
    if(selectedUid && !match)push('selected_not_in_sample');
    if(match&&match.status!=='suspended')push('selected_active');
  }
  if(!selectedUid||!integrity)push('no_integrity');
  else if(integrity.ok!==true||integrity.uid!==selectedUid||integrity.verification!=='sample_only'||integrity.eligibleForActivation!==false||!Array.isArray(integrity.areas))push('integrity_mismatch');
  else {
    deepDocuments=integrity.totals.scanned;
    deepVerified=true;
    if(!ageOK(integrity.checkedAt,now,15))push('integrity_stale');
    if(integrity.totals.alerts>0)push('integrity_risks');
    if(integrity.totals.truncatedAreas>0||integrity.areas.some(a=>a.truncated))push('integrity_partial');
  }
  push('live_rules_unverified');
  push('staff_identity_unverified');
  push('real_device_unverified');
  return {status:'blocked',findings,
    samples:{accounts:sampleAccounts,readinessDocuments,deepDocuments},deepVerified,
    eligibleForActivation:false};
}
