/** R70 — owner-triggered automatic initial tracking handoff for newly created
 * manual DFL deliveries. A durable one-shot reservation precedes grant issuance
 * and the transient provider call; uncertainty is never retried automatically.
 * No raw phone, URL, opaque token or provider request is persisted or logged.
 */
import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import { adminDb } from '@/lib/integration/server/admin';
import { planManualMessage, type ManualDeliveryRecord } from '@/lib/integration/manualMessagingPolicy';
import { canonicalOrderKey, mayIssueNewTrackingGrant } from '@/lib/tracking/gate1/core';
import { capabilities, belongsToTenant, canAccessCustomer, confirmedDelivery,
  confirmInternalDelivery, issueGrant } from '@/lib/tracking/gate1/storage';

export type ManualTrackingResult = {status:'off'|'skipped'|'duplicate'|'provider_accepted'|'review_required';reason?:string};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const validId=(id:string)=>/^dfl-[A-Za-z0-9-]{12,75}$/.test(id);
const allowedStatus = new Set(['accepted_by_provider','delivery_uncertain','rejected_by_provider']);

const authorized = () => {
  // Existing, already-authorized customer consent and tracking switches. No new
  // secret or silent change to rollout settings.
  return process.env.DFL_MANUAL_MESSAGING_ENABLED==='true' &&
    process.env.DFL_MANUAL_MESSAGING_KILL_SWITCH!=='true' &&
    process.env.DFL_MANUAL_MESSAGING_SCOPE==='consented_customers' &&
    process.env.DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED==='true' &&
    process.env.DFL_TRACKING_GATE1_ACTIVE==='1' &&
    process.env.DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED==='1';
};

const siteTarget=()=>{
  const raw=(process.env.DFL_SITE_INTEGRATION_URL||'').trim();
  const secret=(process.env.DFL_INTEGRATION_SIGNING_SECRET||'').trim();
  if(secret.length<24)return null;
  try {
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||
      !['dafamilialanches.com.br','www.dafamilialanches.com.br','dafamilialanches.vercel.app'].includes(url.hostname))return null;
    return {url:`${url.origin}/api/integration/manual-tracking`,secret};
  }catch{return null;}
};

export async function sendManualTrackingInitial(deliveryId:string,ownerUid:string):Promise<ManualTrackingResult> {
  if(!authorized())return {status:'off',reason:'rollout_or_tracking_off'};
  if(!validId(deliveryId)||!ownerUid)return {status:'skipped',reason:'invalid_request'};
  const target=siteTarget();
  if(!target)return {status:'off',reason:'site_bridge_not_configured'};
  const c=await capabilities();
  if(!c||!canAccessCustomer(c)||c.mode!=='AUTOMATIC_CERTIFIED'||!c.eligible_origins.includes('manual'))
    return {status:'off',reason:'manual_capability_not_certified'};
  const snap=await confirmedDelivery(deliveryId);
  if(!snap||!belongsToTenant(snap.data,c.tenant)||canonicalOrderKey(snap.data)!==`entregas:${deliveryId}`||
    !mayIssueNewTrackingGrant(snap.data))return {status:'skipped',reason:'delivery_not_eligible'};
  const delivery={...snap.data,id:deliveryId} as ManualDeliveryRecord;
  const plan=planManualMessage({delivery,reason:'created'});
  if(!plan.eligible)return {status:'skipped',reason:plan.reason};
  const createdAt=Date.parse(String(delivery.created_at||delivery.createdAt||''));
  const activatedAt=Date.parse(process.env.DFL_MANUAL_MESSAGING_ACTIVATED_AT||'');
  if(!Number.isFinite(activatedAt)||!Number.isFinite(createdAt)||createdAt<activatedAt)
    return {status:'skipped',reason:'predates_rollout'};

  const recordId=hash(`${c.tenant}|entregas:${deliveryId}|manual-tracking-v1`);
  const ref=adminDb.collection('tracking_manual_auto_handoffs_v1').doc(recordId);
  // CREATE (never set): cross-instance concurrency and client retries cannot
  // create a second token or a second WhatsApp send.
  try {
    await ref.create({tenant_id:c.tenant,delivery_id:deliveryId,origin:'manual',
      state:'reserved',reserved_at:new Date().toISOString(),schema_version:1});
  } catch (error) {
    // Never assume a transient database error means a duplicate. Both cases
    // fail closed; only an actual ALREADY_EXISTS is classified as such.
    const code=String((error as {code?:unknown})?.code||'');
    return /(?:^6$|already.exists|ALREADY_EXISTS)/i.test(code)||/already.exists/i.test(String(error))
      ? {status:'duplicate',reason:'already_reserved'}
      : {status:'review_required',reason:'reservation_unconfirmed'};
  }
  const settle=async(state:'review_required'|'issued_pending_provider'|'provider_accepted',reason?:string,patch?:Record<string,unknown>)=>{
    await ref.update({state,updated_at:new Date().toISOString(),...(reason?{reason}:{}),...patch});
  };
  try {
    const key=hash(`manual-tracking-v1|${c.tenant}|${deliveryId}`);
    const accepted=await confirmInternalDelivery({tenant:c.tenant,deliveryId,actorUid:ownerUid,idempotencyKey:key});
    if(accepted.state==='invalid'){
      await settle('review_required','acceptance_not_confirmed');return {status:'review_required',reason:'acceptance_not_confirmed'};
    }
    const issued=await issueGrant({tenant:c.tenant,deliveryId,actorUid:ownerUid,idempotencyKey:key,ttlMinutes:90,c});
    if(issued.state!=='issued'){
      await settle('review_required','grant_already_active_or_unavailable');
      return {status:'review_required',reason:'grant_already_active_or_unavailable'};
    }
    // MUST persist the evidence before attempting provider transport.
    await settle('issued_pending_provider',undefined,{grant_id:issued.grant_id,expires_at:issued.expires_at});
    const envelope={contract:'dfl.tracking.manual.handoff.v1',version:1,action:'send_initial',
      event_id:`manual-tracking-initial__${deliveryId}`,delivery_id:deliveryId,
      recipient_e164:`+${plan.phone}`,
      tracking_link:`https://dafamilialanches.com.br/acompanhar#t=${issued.token}`,
      expires_at:issued.expires_at,consent_granted:true};
    const body=JSON.stringify(envelope),timestamp=String(Date.now());
    const signature=createHmac('sha256',target.secret).update(`${timestamp}.${body}`,'utf8').digest('hex');
    let outcome:Response;
    try {
      outcome=await fetch(target.url,{method:'POST',cache:'no-store',redirect:'error',credentials:'omit',
        signal:AbortSignal.timeout(8500),headers:{'content-type':'application/json',
          'x-dfl-event-id':envelope.event_id,'x-dfl-timestamp':timestamp,'x-dfl-signature':signature},body});
    }catch {
      await settle('review_required','provider_transport_uncertain');
      return {status:'review_required',reason:'provider_transport_uncertain'};
    }
    if(!outcome.ok){
      await settle('review_required',`site_http_${outcome.status}`);
      return {status:'review_required',reason:'site_handoff_not_confirmed'};
    }
    const reply=await outcome.text();
    const data=reply.length>10&&reply.length<1024?JSON.parse(reply) as Record<string,unknown>:null;
    if(!data||data.contract!=='dfl.tracking.manual.handoff.v1'||data.version!==1||data.ok!==true||
      !allowedStatus.has(String(data.result))||data.customer_delivery_confirmed!==false||
      typeof data.provider_event_id!=='string'||!/^[A-Za-z0-9._:/+=-]{8,220}$/.test(data.provider_event_id)){
      await settle('review_required','provider_receipt_uncertain');
      return {status:'review_required',reason:'provider_receipt_uncertain'};
    }
    if(data.result!=='accepted_by_provider'){
      await settle('review_required',String(data.result));
      return {status:'review_required',reason:String(data.result)};
    }
    await settle('provider_accepted',undefined,{provider_event_hash:hash(data.provider_event_id)});
    return {status:'provider_accepted'};
  }catch {
    // Something might already have reached the provider. Never issue/replay.
    try{await settle('review_required','outcome_uncertain');}catch{/* no token or phone logged */}
    return {status:'review_required',reason:'outcome_uncertain'};
  }
}

/** Owner-only read model; it cannot trigger messages or issue grants. */
export async function inspectManualTracking(deliveryId:string):Promise<{status:string;reason?:string;expiresAt?:string}|null>{
  if(!validId(deliveryId))return null;
  const c=await capabilities();
  if(!c)return null;
  const snap=await confirmedDelivery(deliveryId);
  if(!snap||!belongsToTenant(snap.data,c.tenant)||canonicalOrderKey(snap.data)!==`entregas:${deliveryId}`||
    !['manual','loja'].includes(String(snap.data.origin||''))||snap.data.source_system==='dfl_site')return null;
  const id=hash(`${c.tenant}|entregas:${deliveryId}|manual-tracking-v1`);
  const row=await adminDb.collection('tracking_manual_auto_handoffs_v1').doc(id).get();
  if(!row.exists)return {status:'not_attempted'};
  const data=row.data()||{};
  return {status:['reserved','issued_pending_provider','review_required','provider_accepted'].includes(String(data.state))?String(data.state):'unknown',
    ...(typeof data.reason==='string'?{reason:data.reason.slice(0,80)}:{}),
    ...(typeof data.expires_at==='string'?{expiresAt:data.expires_at}:{})};
}
