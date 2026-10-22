/** R38 — estimativas de chamadas, NAO faturamento Firestore nem aprovacao de seguranca. */
export const STAFF_PROBE_CONCURRENCY=4;
export const STAFF_ACCOUNT_SCAN_LIMIT=30;
export const STAFF_REQUEST_SCAN_LIMIT=100;
export const STAFF_AREA_COUNT=5;
export const STAFF_MAX_QUERY_ATTEMPTS=2+STAFF_ACCOUNT_SCAN_LIMIT*STAFF_AREA_COUNT;
export type StaffReadBudget={
  accountQueries:number;requestQueries:number;projectionQueries:number;queryAttempts:number;
  accountDocuments:number;requestDocuments:number;projectionDocuments:number;documentsObserved:number;
  maxQueryAttempts:number;maxDocumentsObserved:number;maxProbeConcurrency:number;
  mode:'manual_sample';billedReads:'not_measured';
};
/** Custo agregado apenas dos snapshots efetivamente recebidos. Sem UID, nomes ou dados. */
export function summarizeStaffReadBudget(
  accountDocuments:number,requestDocuments:number,projectionQueries:number,projectionDocuments:number,
):StaffReadBudget {
  const clean=(x:number)=>Number.isSafeInteger(x)&&x>=0?x:0;
  const accounts=Math.min(clean(accountDocuments),STAFF_ACCOUNT_SCAN_LIMIT+1);
  const requests=Math.min(clean(requestDocuments),STAFF_REQUEST_SCAN_LIMIT+1);
  const queries=Math.min(clean(projectionQueries),STAFF_ACCOUNT_SCAN_LIMIT*STAFF_AREA_COUNT);
  const projected=Math.min(clean(projectionDocuments),queries);
  return {accountQueries:1,requestQueries:1,projectionQueries:queries,queryAttempts:2+queries,
    accountDocuments:accounts,requestDocuments:requests,projectionDocuments:projected,
    documentsObserved:accounts+requests+projected,
    maxQueryAttempts:STAFF_MAX_QUERY_ATTEMPTS,
    maxDocumentsObserved:STAFF_ACCOUNT_SCAN_LIMIT+1+STAFF_REQUEST_SCAN_LIMIT+1+STAFF_ACCOUNT_SCAN_LIMIT*STAFF_AREA_COUNT,
    maxProbeConcurrency:STAFF_PROBE_CONCURRENCY,mode:'manual_sample',billedReads:'not_measured'};
}
/** Limite global de simultaneidade, sem temporizadores e sem disparar consultas extras. */
export async function mapBounded<T,R>(items:readonly T[],maxInFlight:number,task:(item:T,index:number)=>Promise<R>):Promise<R[]> {
  if(!Number.isSafeInteger(maxInFlight)||maxInFlight<1||maxInFlight>16)throw new Error('CONCURRENCY_LIMIT_INVALID');
  const result:R[]=new Array(items.length);
  let cursor=0;
  async function worker(){
    while(cursor<items.length){const i=cursor++;result[i]=await task(items[i],i);}
  }
  await Promise.all(Array.from({length:Math.min(items.length,maxInFlight)},()=>worker()));
  return result;
}
export function safeReadBudgetReport(budget:StaffReadBudget|null,at:string):string{
 const checked=Number.isFinite(Date.parse(at))?new Date(at).toISOString():'indisponivel';
 if(!budget)return `DFL ENTREGAS R38 — ORCAMENTO DE CONSULTAS\nGerado: ${checked}\nStatus: NAO CONSULTADO\nNenhuma autorizacao concedida.\n`;
 return ['DFL ENTREGAS V111 R38 — AMOSTRA DE LEITURAS',`Gerado: ${checked}`,
  `Consultas tentadas pela API: ${budget.queryAttempts} de ate ${budget.maxQueryAttempts}`,
  `Documentos devolvidos nas consultas: ${budget.documentsObserved} de ate ${budget.maxDocumentsObserved}`,
  `Consultas de projecao: ${budget.projectionQueries}`,`Concorrencia maxima de sondagens: ${budget.maxProbeConcurrency}`,
  'FATURAMENTO FIRESTORE: NAO MEDIDO; tentativas de query nao equivalem a leituras cobradas.',
  'Escopo: consulta manual e parcial; nao demonstra integridade geral, Rules ativas ou permissao staff.',
  'PUBLICACAO E ATIVACAO: BLOQUEADAS SEM AUTORIZACAO EXPLICITA.',
 ].join('\n')+'\n';
}


/** R39 — guarda de admissão APENAS na instância Node atual, sem persistência.
 * Não é rate limit distribuído entre instâncias da Vercel; nunca concede acesso.
 * Uma auditoria por escopo e duas no total. Janela conservadora entre tentativas.
 */
export const STAFF_AUDIT_MIN_GAP_MS=6000;
export const STAFF_AUDIT_MAX_ACTIVE=2;
export type StaffAuditScope='readiness'|'integrity';
export type StaffAuditPermit={allowed:true;release:()=>void}|{allowed:false;retryAfterSeconds:number;reason:'busy'|'cooldown'};
export function createStaffAuditAdmission(minGapMs=STAFF_AUDIT_MIN_GAP_MS){
 if(!Number.isSafeInteger(minGapMs)||minGapMs<0||minGapMs>60_000)throw new Error('AUDIT_GAP_INVALID');
 const active=new Set<StaffAuditScope>();
 const lastStart=new Map<StaffAuditScope,number>();
 function acquire(scope:StaffAuditScope,now=Date.now()):StaffAuditPermit {
  if(scope!=='readiness'&&scope!=='integrity'||!Number.isFinite(now))throw new Error('AUDIT_SCOPE_INVALID');
  if(active.has(scope)||active.size>=STAFF_AUDIT_MAX_ACTIVE)return {allowed:false,retryAfterSeconds:6,reason:'busy'};
  const last=lastStart.get(scope);
  if(last!==undefined&&now>=last&&now-last<minGapMs)return {allowed:false,retryAfterSeconds:Math.max(1,Math.ceil((minGapMs-(now-last))/1000)),reason:'cooldown'};
  active.add(scope);lastStart.set(scope,now);
  let released=false;
  return {allowed:true,release:()=>{if(released)return;released=true;active.delete(scope);}};
 }
 return {acquire,activeCount:()=>active.size};
}
const runningStaffAudits=createStaffAuditAdmission();
export const acquireStaffAuditPermit=(scope:StaffAuditScope):StaffAuditPermit=>runningStaffAudits.acquire(scope);
