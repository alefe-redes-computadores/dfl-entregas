/** R33: verificacao pura de integridade das projecoes, sem leituras ou mutacoes. */
import { inspectStaffProjection, type ProjectionRisk } from './staffProjectionGuard';
import {projectRoute,projectDelivery,projectProduct,projectPurchase,type ProjectedStaffRow} from './staffProjection';
import {READINESS_SECTIONS,type ReadinessSection} from './staffReadinessPolicy';

export type IntegrityFinding = 'unauthorized_section' | 'unsafe_shape' | 'sensitive_pattern' |
  'source_missing' | 'snapshot_diverged' | 'wrong_motoboy' | 'route_missing';
export type IntegrityArea = ReadinessSection;
export type IntegrityAreaStats = {area:IntegrityArea;sampled:number;truncated:boolean; findings:Partial<Record<IntegrityFinding,number>>};
export type IntegritySummary = {
  ok:true;checkedAt:string;uid:string;displayName:string;role:string;status:string;
  staffLinked:boolean;sourceReadBudget:number;sampleLimit:number;
  areas:IntegrityAreaStats[];totals:{scanned:number;alerts:number;truncatedAreas:number};
  verification:'sample_only';eligibleForActivation:false;
  rulesProduction:'not_checked';
};
export type AccountView={uid:string;role:string;status:string;permissions:unknown;linkedMotoboyId?:unknown};
export const INTEGRITY_AREAS=READINESS_SECTIONS;
export const INTEGRITY_SAMPLE_LIMIT=12;
export const INTEGRITY_SOURCE_READ_BUDGET=75;
const perm:Record<ReadinessSection,string>={home:'home',routes:'routes_read',deliveries:'deliveries_read',stock:'stock_read',purchases:'purchases_read'};
export function mayHoldSection(account:AccountView,area:ReadinessSection):boolean{
  if (!Array.isArray(account.permissions) || !account.permissions.includes(perm[area]))return false;
  if(account.role==='motoboy'){
    if(area==='stock'||area==='purchases')return false;
    if((area==='routes'||area==='deliveries') && (typeof account.linkedMotoboyId!=='string'||!account.linkedMotoboyId.trim()))return false;
  }
  if(account.role==='compras'&&(area==='routes'||area==='deliveries'))return false;
  return ['motoboy','compras','operacao','personalizado'].includes(account.role);
}
const asData=(value:unknown):Record<string,unknown>|null=>value!==null && typeof value==='object' && !Array.isArray(value)?value as Record<string,unknown>:null;
const expected=(area:IntegrityArea,source:Record<string,unknown>,id:string):ProjectedStaffRow|null=>{
  if(area==='routes')return projectRoute(source,id);
  if(area==='deliveries')return projectDelivery(source,id);
  if(area==='stock')return projectProduct(source,id);
  if(area==='purchases')return projectPurchase(source,id);
  return null;
};
export function assessProjection(
  area:IntegrityArea,
  projected:unknown,
  account:AccountView,
  source:unknown,
  id:string,
  relatedRoute:unknown=null,
):IntegrityFinding[]{
  const found=new Set<IntegrityFinding>();
  if(!mayHoldSection(account,area))found.add('unauthorized_section');
  const integrity=inspectStaffProjection(projected);
  if(integrity.risks.some((x:ProjectionRisk)=>x==='unexpected_field'||x==='invalid_text'))found.add('unsafe_shape');
  if(integrity.risks.includes('sensitive_pattern'))found.add('sensitive_pattern');
  if(area==='home')return [...found]; // Resumo agregado nao admite comparacao 1:1 com documento-fonte.
  const original=asData(source);
  if(!original){found.add('source_missing');return [...found];}
  const visible=asData(projected);
  const canonical=expected(area,original,id);
  if(visible && canonical && (visible.title!==canonical.title||visible.subtitle!==canonical.subtitle||visible.status!==canonical.status)){
    found.add('snapshot_diverged');
  }
  if(account.role==='motoboy' && (area==='routes'||area==='deliveries')){
    const linked=typeof account.linkedMotoboyId==='string'?account.linkedMotoboyId:'';
    const route=area==='routes'?original:asData(relatedRoute);
    if(area==='deliveries'&&!route)found.add('route_missing');
    if(!linked||!route||route.motoboy_id!==linked)found.add('wrong_motoboy');
    if(area==='deliveries'&&typeof original.route_id!=='string')found.add('wrong_motoboy');
  }
  return [...found];
}
export function tallyFindings(items:readonly IntegrityFinding[]):Partial<Record<IntegrityFinding,number>>{
  const counts:Partial<Record<IntegrityFinding,number>>={};
  for(const code of items)counts[code]=(counts[code]||0)+1;
  return counts;
}
