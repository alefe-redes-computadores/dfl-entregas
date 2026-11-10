/** R299 P9 — server-only DFL360 automatic tracking bridge. Never sends WhatsApp. */
import 'server-only';
import {createHmac} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {adminDb} from '@/lib/integration/server/admin';
import {trackingCustomerEnabled,trackingTenant,verifyTrackingAutomaticRequest,hexSha256} from '@/lib/tracking/gate1/security';
import {canonicalOrderKey,iso,mayIssueNewTrackingGrant} from '@/lib/tracking/gate1/core';
import {capabilities,canAccessCustomer,belongsToTenant,confirmedDelivery,resolveCanonicalOrder,issueGrant,reconcileConfirmedEvents} from '@/lib/tracking/gate1/storage';
import {canAutoIssue,canonicalE164,parseSiteAcceptance,parseSiteIssue,parseSiteReceipt} from './auto-policy';

const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{
  'cache-control':'no-store, max-age=0',pragma:'no-cache','referrer-policy':'no-referrer',
  'x-content-type-options':'nosniff', 'x-robots-tag':'noindex',
}});
const unavailable=(status=404)=>json({ok:false,code:'TRACKING_AUTO_UNAVAILABLE'},status);
const conflict=()=>json({ok:false,code:'TRACKING_AUTO_CONFLICT_OR_UNCERTAIN'},409);
const keyFor=(tenant:string,key:string)=>hexSha256(`${tenant}|${key}`);
const receptionRef=(tenant:string,key:string)=>adminDb.collection('tracking_auto_acceptances_v1').doc(keyFor(tenant,key));
const deliveryRef=(tenant:string,key:string)=>adminDb.collection('tracking_auto_initial_delivery_v1').doc(keyFor(tenant,key));
const secret=()=>{
  const value=process.env.DFL_TRACKING_AUTO_RECIPIENT_HMAC_KEY||'';
  return value.length>=32&&value.length<=512?value:null;
};
function privateHash(kind:'recipient'|'provider_event',tenant:string,value:string):string|null {
  const hmacKey=secret();if(!hmacKey)return null;
  return createHmac('sha256',hmacKey).update(`dfl360|${kind}|${tenant}|${value}`,'utf8').digest('hex');
}
// R311: Site S2S ainda precisa respeitar o unico destinatario do piloto.
 // Falha fechada se a env nao existir. Sem telefone em logs ou resposta.
function r311PilotRecipient(phone:string):boolean {
  const expected=(process.env.DFL_TRACKING_AUTO_PILOT_PHONE_E164||'').trim();
  return /^\+55[1-9][0-9][2-9][0-9]{7,8}$/.test(expected) && phone===expected;
}
async function packet(req:NextRequest){
  const raw=await req.text();
  if(raw.length<2||raw.length>4096)return null;
  try{const parsed:unknown=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return null;
    return {raw,data:parsed};
  }catch{return null;}
}
async function context(req:NextRequest,raw:string){
  // Explicit opt-in, not the existing MANUAL or pilot messaging switch.
  if(process.env.DFL_TRACKING_AUTO_S2S_CERTIFIED!=='1'||!trackingCustomerEnabled()||!secret())return {status:503 as const};
  const auth=await verifyTrackingAutomaticRequest(req,raw);
  if(auth!=='ok')return {status:(auth==='invalid'?401:auth==='replay'?409:503) as 401|409|503};
  const c=await capabilities(),tenant=trackingTenant();
  if(!tenant||!c||c.tenant!==tenant||!canAccessCustomer(c)||!canAutoIssue({
    configured:true,customerCertified:trackingCustomerEnabled(),capability:c
  }))return {status:403 as const};
  return {status:200 as const,tenant,c};
}
function confirmedSite(d:Record<string,unknown>,tenant:string,key:string){
  // Fail closed on terminal commercial labels when the logistics completion
  // flag has not yet synchronized; do not treat Site completion as dispatch evidence.
  const siteStatus=String(d.site_order_status||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(/cancel|entregue|conclu|finaliz|reembols|devolv/.test(siteStatus))return false;
  return d.source_system==='dfl_site' && canonicalOrderKey(d)===key &&
    belongsToTenant(d,tenant) && mayIssueNewTrackingGrant(d) &&
    d.test_order!==true && d.is_test!==true && d.is_test_order!==true &&
    d.is_fictitious!==true && d.is_demo!==true && d.test_mode!==true;
}
async function siteDelivery(tenant:string,key:string){
  const deliveryId=await resolveCanonicalOrder(key);
  if(!deliveryId)return null;
  const snap=await confirmedDelivery(deliveryId);
  return snap&&confirmedSite(snap.data,tenant,key)?{...snap,id:deliveryId}:null;
}
/**
 * Only the Site server can attest acceptedAt and WhatsApp consent, using the
 * existing signed S2S protocol. The source of truth is NOT the client/browser.
 * No production WhatsApp activity occurs in this endpoint.
 */
export async function commercialAccept(req:NextRequest){
  try{
    const p=await packet(req);if(!p)return unavailable(422);
    const ctx=await context(req,p.raw);if(ctx.status!==200)return unavailable(ctx.status);
    const v=parseSiteAcceptance(p.data);if(!v)return unavailable(422);
    const snap=await siteDelivery(ctx.tenant,v.canonical_order_key);if(!snap)return unavailable();
    const phone=canonicalE164(snap.data.phone||snap.data.customer_phone);
    const recipient=canonicalE164(v.recipient_e164);
    if(!phone||!recipient||phone!==recipient||!r311PilotRecipient(recipient))return unavailable(422);
    const recipientHash=privateHash('recipient',ctx.tenant,recipient);
    if(!recipientHash)return unavailable(503);
    const created=iso(snap.data.created_at)||iso(snap.data.createdAt);
    if(created && Date.parse(v.accepted_at)+300_000<Date.parse(created))return unavailable(422);
    const ref=receptionRef(ctx.tenant,v.canonical_order_key);
    const orderRef=adminDb.collection('deliveries').doc(snap.id);
    const result=await adminDb.runTransaction(async tx=>{
      const [existing,live]=await Promise.all([tx.get(ref),tx.get(orderRef)]);
      const old=(existing.data()||{}) as Record<string,unknown>;
      if(existing.exists){
        return old.event_id===v.event_id && old.recipient_hash===recipientHash &&
          old.accepted_at===v.accepted_at && old.idempotency_key===v.idempotency_key
          ? 'already_recorded' as const:'conflict' as const;
      }
      const delivery=(live.data()||{}) as Record<string,unknown>;
      const row={...delivery,id:live.id};
      if(!live.exists||!confirmedSite(row,ctx.tenant,v.canonical_order_key)||
         canonicalE164(delivery.phone||delivery.customer_phone)!==recipient)return 'invalid' as const;
      const prior=Array.isArray(delivery.site_order_timeline)?delivery.site_order_timeline.filter(x=>x&&typeof x==='object'):[];
      const eventId=`r299-auto-accept-${v.event_id}`;
      if(prior.some((x:Record<string,unknown>)=>x.event_id===eventId))return 'conflict' as const;
      const timeline=[...prior.slice(-148),{event_id:eventId,status:'Aceito',occurred_at:v.accepted_at}];
      tx.create(ref,{
        tenant_id:ctx.tenant,order_key:v.canonical_order_key,delivery_id:snap.id,
        event_id:v.event_id,idempotency_key:v.idempotency_key,
        accepted_at:v.accepted_at,consent_at:v.consent.granted_at,consent_granted:true,
        recipient_hash:recipientHash,source:'dfl_site_r21',created_at:new Date().toISOString(),
      });
      // Site owns status: do not set Em Produção, mark ready, or start a route.
      tx.update(orderRef,{site_order_timeline:timeline,site_order_accepted_at:v.accepted_at});
      return 'recorded' as const;
    });
    if(result==='conflict')return conflict();
    if(result==='invalid')return unavailable();
    return json({ok:true,code:result,commercial_state:'confirmed',production_started:false},result==='recorded'?201:200);
  }catch{return unavailable(503);}
}
/** Returns the opaque token ONCE to an authenticated Site backend only.
 * Caller must hand it to an authorized provider without persisting it.
 * Network uncertainty leaves the grant reserved; never retry blindly.
 */
export async function issueInitial(req:NextRequest){
  try{
    const p=await packet(req);if(!p)return unavailable(422);
    const ctx=await context(req,p.raw);if(ctx.status!==200)return unavailable(ctx.status);
    const v=parseSiteIssue(p.data);if(!v)return unavailable(422);
    const snap=await siteDelivery(ctx.tenant,v.canonical_order_key);if(!snap)return unavailable();
    const recipient=canonicalE164(v.recipient_e164);
    if(!recipient||!r311PilotRecipient(recipient)||canonicalE164(snap.data.phone||snap.data.customer_phone)!==recipient)return unavailable(422);
    const recipientHash=privateHash('recipient',ctx.tenant,recipient);if(!recipientHash)return unavailable(503);
    const existing=await receptionRef(ctx.tenant,v.canonical_order_key).get();
    const acceptance=(existing.data()||{}) as Record<string,unknown>;
    if(!existing.exists || acceptance.tenant_id!==ctx.tenant || acceptance.order_key!==v.canonical_order_key ||
      acceptance.delivery_id!==snap.id || acceptance.consent_granted!==true ||
      acceptance.event_id!==v.acceptance_event_id || acceptance.recipient_hash!==recipientHash ||
      !iso(acceptance.accepted_at) || Date.now()-Date.parse(String(acceptance.accepted_at))>24*3600_000)return unavailable(403);
    // If initial delivery was ever attempted, no second grant or WhatsApp retry.
    const receiptDoc=await deliveryRef(ctx.tenant,v.canonical_order_key).get();
    if(receiptDoc.exists)return conflict();
    const timeline=Array.isArray(snap.data.site_order_timeline)?snap.data.site_order_timeline:[];
    if(!timeline.some((x:Record<string,unknown>)=>x&&x.event_id===`r299-auto-accept-${v.acceptance_event_id}`&&
      x.status==='Aceito'&&x.occurred_at===acceptance.accepted_at))return unavailable(403);
    await reconcileConfirmedEvents(ctx.tenant,snap.id);
    const issued=await issueGrant({tenant:ctx.tenant,deliveryId:snap.id,actorUid:'dfl_site_automatic_s2s',
      idempotencyKey:v.idempotency_key,ttlMinutes:v.requested_ttl_minutes,c:ctx.c});
    if(issued.state!=='issued')return conflict();
    // A failed receipt write is UNCERTAIN, not permission to issue another token.
    await deliveryRef(ctx.tenant,v.canonical_order_key).create({
      tenant_id:ctx.tenant,order_key:v.canonical_order_key,delivery_id:snap.id,
      grant_id:issued.grant_id,issue_idempotency_key:v.idempotency_key,
      acceptance_event_id:v.acceptance_event_id,recipient_hash:recipientHash,
      state:'issued_pending_provider',issued_at:new Date().toISOString(),
      expires_at:issued.expires_at,
    });
    return json({contract:'dfl.tracking.automatic',version:1,action:'issue_initial',
      status:'issued_pending_provider',grant_id:issued.grant_id,
      opaque_token:issued.token,expires_at:issued.expires_at,
      one_time_only:true,delivery_confirmed:false},201);
  }catch{return unavailable(503);}
}
/** Provider ACK records acceptance/rejection/uncertainty, never customer delivery. */
export async function providerReceipt(req:NextRequest){
  try{
    const p=await packet(req);if(!p)return unavailable(422);
    const ctx=await context(req,p.raw);if(ctx.status!==200)return unavailable(ctx.status);
    const v=parseSiteReceipt(p.data);if(!v)return unavailable(422);
    const providerHash=privateHash('provider_event',ctx.tenant,v.provider_event_id);if(!providerHash)return unavailable(503);
    const ref=deliveryRef(ctx.tenant,v.canonical_order_key);
    const result=await adminDb.runTransaction(async tx=>{
      const snap=await tx.get(ref);const old=(snap.data()||{}) as Record<string,unknown>;
      if(!snap.exists||old.tenant_id!==ctx.tenant||old.order_key!==v.canonical_order_key||old.grant_id!==v.grant_id)return 'invalid' as const;
      if(old.state!=='issued_pending_provider') {
        return old.state===v.result&&old.provider_event_hash===providerHash&&old.receipt_idempotency_key===v.idempotency_key
          ? 'already_recorded' as const:'conflict' as const;
      }
      tx.update(ref,{state:v.result,provider_event_hash:providerHash,
        receipt_idempotency_key:v.idempotency_key,received_at:new Date().toISOString(),
        customer_delivery_confirmed:false});
      return 'recorded' as const;
    });
    if(result==='invalid')return unavailable();
    if(result==='conflict')return conflict();
    return json({ok:true,code:result,provider_state:v.result,customer_delivery_confirmed:false});
  }catch{return unavailable(503);}
}
