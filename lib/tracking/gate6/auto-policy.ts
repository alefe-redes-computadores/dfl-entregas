/** R299 P9 — DFL 360 automatic tracking bridge policy. Pure, fail-closed, no I/O. */
export const AUTO_TRACKING_CONTRACT = 'dfl.tracking.automatic' as const;
export const AUTO_TRACKING_VERSION = 1 as const;
export const AUTO_INITIAL_TTL_MINUTES = 45 as const;

type Dict = Record<string, unknown>;
const object = (x:unknown):x is Dict => Boolean(x && typeof x==='object' && !Array.isArray(x));
const only = (x:Dict, names:readonly string[]) =>
  Object.keys(x).every(k=>names.includes(k)) && names.every(k=>Object.prototype.hasOwnProperty.call(x,k));
const order = (x:unknown): x is string => typeof x==='string' && /^site:[A-Za-z0-9._-]{1,120}$/.test(x);
const event = (x:unknown): x is string => typeof x==='string' && /^[A-Za-z0-9._:-]{12,128}$/.test(x);
const providerEvent = (x:unknown): x is string => typeof x==='string' && /^[A-Za-z0-9._:/+=-]{8,220}$/.test(x);
const key = (x:unknown): x is string => typeof x==='string' && /^[A-Za-z0-9_-]{16,96}$/.test(x);
const hex = (x:unknown): x is string => typeof x==='string' && /^[a-f0-9]{64}$/.test(x);
const date = (x:unknown):x is string => typeof x==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(x) && Number.isFinite(Date.parse(x));

/** Phone matching is for a single, explicitly consented Brazilian recipient, not identity inference. */
export function canonicalE164(input:unknown):string|null {
  if (typeof input!=='string'||input.length>40) return null;
  const digits=input.replace(/[\s()+-]/g,'');
  if (!/^55[1-9][0-9][2-9][0-9]{7,8}$/.test(digits)) return null;
  return `+${digits}`;
}
export type AcceptanceRequest = {
  contract:'dfl.tracking.automatic';version:1;action:'commercial_accept';
  canonical_order_key:string;event_id:string;accepted_at:string;idempotency_key:string;
  recipient_e164:string;consent:{channel:'whatsapp';granted:true;granted_at:string;source:'dfl_site'};
};
export type IssueRequest = {
  contract:'dfl.tracking.automatic';version:1;action:'issue_initial';
  canonical_order_key:string;acceptance_event_id:string;recipient_e164:string;
  idempotency_key:string;requested_ttl_minutes:45;
};
export type ReceiptRequest = {
  contract:'dfl.tracking.automatic';version:1;action:'provider_receipt';
  canonical_order_key:string;grant_id:string;idempotency_key:string;
  provider_event_id:string;result:'accepted_by_provider'|'delivery_uncertain'|'rejected_by_provider';
};
const base=(x:Dict,action:string) => x.contract===AUTO_TRACKING_CONTRACT &&
  x.version===AUTO_TRACKING_VERSION && x.action===action;

export function parseSiteAcceptance(input:unknown,now=Date.now()):AcceptanceRequest|null {
  if(!object(input)||!base(input,'commercial_accept')||!only(input,[
    'contract','version','action','canonical_order_key','event_id','accepted_at','idempotency_key','recipient_e164','consent'
  ]) || !order(input.canonical_order_key)||!event(input.event_id)||!key(input.idempotency_key)||
     !date(input.accepted_at)||!canonicalE164(input.recipient_e164) || !object(input.consent) ||
     !only(input.consent,['channel','granted','granted_at','source']) ||
     input.consent.channel!=='whatsapp'||input.consent.granted!==true||input.consent.source!=='dfl_site'||
     !date(input.consent.granted_at))return null;
  const accepted=Date.parse(input.accepted_at),consent=Date.parse(input.consent.granted_at);
  // No bulk historical issuance: only a recently confirmed order. Future timestamps fail closed.
  if(accepted>now+120_000 || now-accepted>24*3600_000 || consent>now+120_000) return null;
  return input as AcceptanceRequest;
}
export function parseSiteIssue(input:unknown):IssueRequest|null {
  if(!object(input)||!base(input,'issue_initial')||!only(input,[
    'contract','version','action','canonical_order_key','acceptance_event_id','recipient_e164','idempotency_key','requested_ttl_minutes'
  ]) ||!order(input.canonical_order_key)||!event(input.acceptance_event_id)||
    !key(input.idempotency_key)|| !canonicalE164(input.recipient_e164) ||
    input.requested_ttl_minutes!==AUTO_INITIAL_TTL_MINUTES)return null;
  return input as IssueRequest;
}
export function parseSiteReceipt(input:unknown):ReceiptRequest|null {
  if(!object(input)||!base(input,'provider_receipt')||!only(input,[
    'contract','version','action','canonical_order_key','grant_id','provider_event_id','idempotency_key','result'
  ])||!order(input.canonical_order_key)||!hex(input.grant_id)||!providerEvent(input.provider_event_id)||
     !key(input.idempotency_key)|| !['accepted_by_provider','delivery_uncertain','rejected_by_provider'].includes(String(input.result)))return null;
  return input as ReceiptRequest;
}
export type AutoCapability = {mode:string;kill_switch:boolean;public_tracking:boolean;issue_tracking_link:boolean;eligible_origins:string[]}|null;
export function canAutoIssue(input:{configured:boolean;customerCertified:boolean;capability:AutoCapability}):boolean {
  const c=input.capability;
  return Boolean(input.configured && input.customerCertified && c && c.mode==='AUTOMATIC_CERTIFIED' &&
    !c.kill_switch && c.public_tracking && c.issue_tracking_link && c.eligible_origins.includes('dfl_site'));
}
/** A terminal event must suppress later delivery notifications, even when delivered out of order. */
export function mayNotifyAfter(input:{candidateAt:string;terminalAt?:string|null;cancelled?:boolean;completed?:boolean}):boolean {
  if(input.cancelled||input.completed) return false;
  if(!date(input.candidateAt))return false;
  if(input.terminalAt&&date(input.terminalAt)&&Date.parse(input.candidateAt)<=Date.parse(input.terminalAt))return false;
  return true;
}
