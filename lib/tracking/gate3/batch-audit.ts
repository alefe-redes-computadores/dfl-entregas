/** R252 — owner-only operational sample audit. No personal or financial data. */
import type { TrackingInspection } from '../gate1/readiness';
import type { Gate2Certificate } from '../gate2/certification';

export type AuditOrigin = 'site' | 'manual' | 'ifood' | 'food99' | 'unknown';
export type AuditLevel = 'ready_for_internal_review' | 'needs_attention' | 'blocked' | 'not_found' | 'inspection_failed';
export type AuditRow = {
  delivery_id: string;
  origin: AuditOrigin;
  state: string;
  level: AuditLevel;
  event_count: number;
  public_projection_valid: boolean;
  last_confirmed_at: string | null;
  signals: Array<{ code: string; severity: 'info' | 'warning' | 'blocker' }>;
};
export type AuditSummary = {
  contract: 'dfl.tracking.gate3.batch_audit';
  version: 1;
  source: 'confirmed_server_snapshot';
  scope: 'owner_only';
  reviewed_at: string;
  sample_size: number;
  recognized: number;
  internal_reviewable: number;
  needs_attention: number;
  blocked: number;
  unavailable: number;
  valid_public_projections: number;
  by_origin: Record<AuditOrigin, number>;
  top_signals: Array<{ code: string; count: number }>;
  rows: AuditRow[];
  customer_access_activated_by_audit: false;
  messages_sent_by_audit: false;
};
const origins: readonly AuditOrigin[] = ['site','manual','ifood','food99','unknown'];
const idPattern = /^[A-Za-z0-9_-]{1,120}$/;
const codePattern = /^[A-Z][A-Z0-9_]{1,63}$/;
export function validAuditIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 &&
    value.every(x => typeof x === 'string' && idPattern.test(x)) &&
    new Set(value).size === value.length;
}
export function auditRow(id: string, inspection: TrackingInspection | null, certificate?: Gate2Certificate): AuditRow {
  if (!idPattern.test(id)) throw new Error('invalid-id');
  if (!inspection) return {delivery_id:id,origin:'unknown',state:'unavailable',level:'not_found',
    event_count:0,public_projection_valid:false,last_confirmed_at:null,signals:[]};
  const origin: AuditOrigin = origins.includes(inspection.delivery.origin) ? inspection.delivery.origin : 'unknown';
  const signals = inspection.readiness.signals.slice(0,24)
    .filter(s => codePattern.test(s.code) && ['info','warning','blocker'].includes(s.severity))
    .map(s => ({code:s.code,severity:s.severity}));
  const level = inspection.readiness.level;
  const isValid = certificate?.public_projection_valid === true && certificate?.source === 'confirmed_server_snapshot';
  const at = inspection.readiness.last_confirmed_at;
  return {delivery_id:id,origin,state:String(inspection.delivery.state).slice(0,48),
    level: ['ready_for_internal_review','needs_attention','blocked'].includes(level) ? level : 'inspection_failed',
    event_count: Math.max(0,Math.min(5000,inspection.events.length)),
    public_projection_valid:isValid,
    last_confirmed_at:typeof at === 'string' && Number.isFinite(Date.parse(at))?new Date(at).toISOString():null,
    signals};
}
export function failedAuditRow(id: string): AuditRow {
  if (!idPattern.test(id)) throw new Error('invalid-id');
  return {delivery_id:id,origin:'unknown',state:'unavailable',level:'inspection_failed',
    event_count:0,public_projection_valid:false,last_confirmed_at:null,signals:[]};
}
export function summarizeAudit(rows: readonly AuditRow[], reviewedAt = new Date().toISOString()): AuditSummary {
  if (rows.length > 20 || !Number.isFinite(Date.parse(reviewedAt))) throw new Error('audit-limit');
  const by_origin = {site:0,manual:0,ifood:0,food99:0,unknown:0};
  const codes = new Map<string,number>();
  let recognized=0, internal_reviewable=0, needs_attention=0, blocked=0, unavailable=0, valid=0;
  for(const r of rows){
    if(!idPattern.test(r.delivery_id) || !origins.includes(r.origin))throw new Error('audit-row-invalid');
    by_origin[r.origin]++;
    if(r.level==='not_found'||r.level==='inspection_failed'){unavailable++;continue;}
    recognized++;
    if(r.level==='ready_for_internal_review')internal_reviewable++;
    else if(r.level==='needs_attention')needs_attention++;
    else blocked++;
    if(r.public_projection_valid)valid++;
    for(const signal of new Set(r.signals.map(x=>x.code).filter(x=>codePattern.test(x)))){
      codes.set(signal,(codes.get(signal)||0)+1);
    }
  }
  return {contract:'dfl.tracking.gate3.batch_audit',version:1,source:'confirmed_server_snapshot',
    scope:'owner_only',reviewed_at:new Date(reviewedAt).toISOString(),sample_size:rows.length,
    recognized,internal_reviewable,needs_attention,blocked,unavailable,valid_public_projections:valid,
    by_origin,top_signals:[...codes].map(([code,count])=>({code,count})).sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code)).slice(0,12),
    rows:[...rows],customer_access_activated_by_audit:false,messages_sent_by_audit:false};
}
/** Safe to paste into another project chat: no ids, client names, addresses, or values. */
export function auditReportText(s: AuditSummary): string {
  const counts=`${s.sample_size} examinados; ${s.recognized} reconhecidos; ${s.unavailable} indisponíveis.`;
  const origins=`Site ${s.by_origin.site}, Loja ${s.by_origin.manual}, iFood ${s.by_origin.ifood}, 99Food ${s.by_origin.food99}, não identificados ${s.by_origin.unknown}.`;
  const signals=s.top_signals.length?s.top_signals.map(x=>`${x.code}: ${x.count}`).join('; '):'nenhum';
  return [
    'DFL ENTREGAS → DFL SITE | R252 — Amostra administrativa de acompanhamento',
    `Verificação confirmada em: ${s.reviewed_at}`,
    counts,
    `Prontos para revisão interna: ${s.internal_reviewable}; atenção: ${s.needs_attention}; bloqueados: ${s.blocked}.`,
    `Projeções públicas estruturalmente válidas: ${s.valid_public_projections}.`,
    `Origem: ${origins}`,
    `Sinais técnicos: ${signals}.`,
    'Amostra limitada à seleção local do operador, sem certificação de acesso público.',
    'Sem IDs, nomes, telefone, endereço, valores, links, tokens ou mensagens reais.',
    'Links/WhatsApp permanecem OFF; integração com Site exige homologação conjunta.',
  ].join('\n');
}
