/** R32: auditoria pura, somente leitura. NUNCA autoriza ou suspende contas. */
import type { ProjectionRisk } from './staffProjectionGuard';
import type { StaffReadBudget } from './staffReadBudget';
export type ReadinessRole = 'motoboy'|'compras'|'operacao'|'personalizado';
export const READINESS_SECTIONS = ['home','routes','deliveries','stock','purchases'] as const;
export type ReadinessSection = typeof READINESS_SECTIONS[number];
export type ReadinessIssue = 'uid_invalido'|'conta_ativa'|'status_invalido'|'perfil_invalido'|
  'permissoes_invalidas'|'vinculo_motoboy_ausente'|'permissao_administrativa'|'permissao_cruzada'|'projecao_antiga';
export type ReadinessAccount = {
  uid:string; name:string;role:string;status:string;lastPreparedAt:string;
  issues:ReadinessIssue[];sections:ReadinessSection[];
  samples:Record<ReadinessSection, boolean>;
  projectionRisks:Partial<Record<ReadinessSection,ProjectionRisk[]>>;
  projectionsChecked:number;
};
const ROLES = new Set(['motoboy','compras','operacao','personalizado']);
const READ = new Set(['home','routes_read','deliveries_read','stock_read','purchases_read']);
const PRIVATE = new Set(['staff_admin','finance','diagnostics','settings','reports','routes_create','deliveries_create','deliveries_complete','stock_write','purchases_write']);
export const safeUid=(uid:unknown):uid is string=>typeof uid==='string' && /^[a-zA-Z0-9_-]{8,120}$/.test(uid);
const text=(value:unknown,n=90)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n):'';
export function auditStaffAccount(uid:string, data:Record<string,unknown>, now:number):Omit<ReadinessAccount,'samples'|'projectionRisks'|'projectionsChecked'> {
  const issues:ReadinessIssue[]=[];
  const status=text(data.status,30);
  const role=text(data.role,32);
  const permissions=data.permissions;
  if (!safeUid(uid)||data.uid!==uid)issues.push('uid_invalido');
  if (status==='active')issues.push('conta_ativa');
  if (status!=='active'&&status!=='suspended')issues.push('status_invalido');
  if (!ROLES.has(role))issues.push('perfil_invalido');
  if (!Array.isArray(permissions)||permissions.some(x=>typeof x!=='string'||(!READ.has(x)&&!PRIVATE.has(x))))issues.push('permissoes_invalidas');
  const access=Array.isArray(permissions)?permissions.filter((x):x is string=>typeof x==='string'):[];
  if (access.some(x=>['staff_admin','finance','diagnostics','settings','reports'].includes(x)))issues.push('permissao_administrativa');
  if (role==='motoboy' && (!text(data.linkedMotoboyId,120)||!/^[a-zA-Z0-9_-]{1,120}$/.test(text(data.linkedMotoboyId,120))))issues.push('vinculo_motoboy_ausente');
  if ((role==='motoboy'&&access.some(x=>['stock_read','stock_write','purchases_read','purchases_write'].includes(x))) ||
      (role==='compras'&&access.some(x=>['routes_read','routes_create','deliveries_read','deliveries_create','deliveries_complete'].includes(x)))) issues.push('permissao_cruzada');
  const lastPreparedAt=text(data.updatedAt,40);
  const timestamp=Date.parse(lastPreparedAt);
  if (!lastPreparedAt||!Number.isFinite(timestamp)||timestamp>now+60000||now-timestamp>24*60*60*1000)issues.push('projecao_antiga');
  const sections=READINESS_SECTIONS.filter(area=>access.includes(area==='home'?'home':area==='routes'?'routes_read':area==='deliveries'?'deliveries_read':area==='stock'?'stock_read':'purchases_read'));
  return {uid,name:text(data.displayName,90)||'Equipe',role,status,lastPreparedAt,issues,sections};
}
export const blankSamples=():Record<ReadinessSection,boolean>=>({home:false,routes:false,deliveries:false,stock:false,purchases:false});
export type ReadinessSummary={
  ok:boolean;checkedAt:string;accountSampleLimit:number;accountsTruncated:boolean;requestsTruncated:boolean;
  accounts:ReadinessAccount[];
  requests:{sampled:number;pending:number;inFlight:number;closed:number};
  projectionHealth:{sampled:number;unsafe:number;unknown:number};
  /** R38: telemetria derivada dos mesmos snapshots, sem consultar mais dados. */
  readBudget?:StaffReadBudget;
  /** R39: controle em memória por instancia, nao limitador global de Vercel. */
  auditGuard?:{mode:'instance_only';minGapSeconds:number;scopes:number};
  flags:{staffPortal:boolean;staffRequests:boolean;canonicalApply:boolean;projectionRefresh?:boolean;originsSeparated:boolean};
  productionRules:'nao_verificadas_pela_api';emulatorRules:'execucao_manual';
};
