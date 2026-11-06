import 'server-only';
import { createHmac } from 'node:crypto';
import { adminDb } from './admin';
import { planManualMessage, type ManualDeliveryRecord, type ManualMessageReason, type ManualRouteRecord } from '../manualMessagingPolicy';

export type ManualMessageResult = { status: 'off'|'skipped'|'queued'|'duplicate'|'failed'; reason?: string };
const off = (): ManualMessageResult => ({status:'off',reason:'manual_messages_disabled'});
const activationTime = () => {
  const value = process.env.DFL_MANUAL_MESSAGING_ACTIVATED_AT?.trim() || '';
  const ms = Date.parse(value);
  // New orders only: a rollout boundary must be explicitly configured.
  return value && Number.isFinite(ms) ? ms : null;
};
const enabled = () => process.env.DFL_MANUAL_MESSAGING_ENABLED === 'true' && activationTime() !== null;
const createdAfterActivation = (delivery: ManualDeliveryRecord) => {
  const created = Date.parse(String(delivery.created_at || delivery.createdAt || ''));
  const activated = activationTime();
  return activated !== null && Number.isFinite(created) && created >= activated;
};
const siteEndpoint = () => {
  const raw = process.env.DFL_SITE_INTEGRATION_URL?.trim();
  const secret = process.env.DFL_INTEGRATION_SIGNING_SECRET?.trim();
  if (!raw || !secret) return null;
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !['dafamilialanches.com.br','www.dafamilialanches.com.br','dafamilialanches.vercel.app'].includes(url.hostname)) return null;
  return { url: `${url.origin}/api/integration/manual-messaging`, secret };
};

async function forward(delivery: ManualDeliveryRecord, reason: ManualMessageReason, route?: ManualRouteRecord|null): Promise<ManualMessageResult> {
  if (!enabled()) return off();
  if (!createdAfterActivation(delivery)) return {status:'skipped',reason:'predates_rollout'};
  const plan = planManualMessage({delivery,reason,route});
  if (!plan.eligible) return {status:'skipped',reason:plan.reason};
  const target = siteEndpoint();
  if (!target) return {status:'failed',reason:'bridge_configuration_invalid'};
  const event = {
    event_id: `manual-msg-v1__${plan.eventType}__${delivery.id}`,
    source: 'manual', event_type:plan.eventType, order_id:plan.orderId,
    customer_phone:plan.phone,customer_name:plan.customerName,payload:plan.payload,
  };
  // Site reverse-inbound contract (including this manual endpoint): epoch milliseconds
  // and bare 64-character hex HMAC. The Site -> Entregas relay uses a distinct
  // wire format (ISO + sha256=), and MUST NOT be reused in this direction.
  const body = JSON.stringify(event), timestamp = String(Date.now());
  const signature = createHmac('sha256',target.secret).update(`${timestamp}.${body}`,'utf8').digest('hex');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),7000);
  try {
    const response = await fetch(target.url,{method:'POST',headers:{'content-type':'application/json','x-dfl-timestamp':timestamp,'x-dfl-signature':signature,'x-dfl-event-id':event.event_id},body,cache:'no-store',signal:controller.signal});
    const result = await response.json().catch(()=>null) as {ok?:boolean;queued?:boolean;duplicate?:boolean;error?:string}|null;
    if (!response.ok || result?.ok!==true) return {status:'failed',reason:response.status===403?'site_gate_off':`site_http_${response.status}`};
    if(result.duplicate===true) return {status:'duplicate'};
    if(result.queued===true) return {status:'queued'};
    return {status:'failed',reason:'not_queued'};
  } catch {return {status:'failed',reason:'site_bridge_unavailable'};}
  finally {clearTimeout(timer);}
}

export async function notifyNewManualDelivery(id:string):Promise<ManualMessageResult>{
  if (!enabled()) return off();
  if (!/^dfl-[a-zA-Z0-9-]{12,120}$/.test(id)) return {status:'skipped',reason:'invalid_delivery_id'};
  const doc = await adminDb.collection('deliveries').doc(id).get();
  if (!doc.exists) return {status:'skipped',reason:'delivery_not_found'};
  return forward({...doc.data(),id:doc.id} as ManualDeliveryRecord,'created');
}

export async function notifyManualRoute(input:{routeId:string;reason:string}):Promise<{status:'off'|'skipped'|'processed'|'failed';eligible:number;queued:number;duplicates:number;failed:number;reason?:string}>{
  const empty={eligible:0,queued:0,duplicates:0,failed:0};
  if (!enabled()) return {status:'off',...empty};
  if (!['route_started','delivery_completed','manual_recovery'].includes(input.reason)) return {status:'skipped',reason:'not_a_messaging_event',...empty};
  if (!/^[a-zA-Z0-9_-]{8,160}$/.test(input.routeId)) return {status:'skipped',reason:'invalid_route_id',...empty};
  const routeDoc=await adminDb.collection('routes').doc(input.routeId).get();
  if (!routeDoc.exists) return {status:'skipped',reason:'route_missing',...empty};
  const snapshot=await adminDb.collection('deliveries').where('route_id','==',input.routeId).limit(41).get();
  if (snapshot.size>40) return {status:'skipped',reason:'route_too_large_requires_manual_review',...empty};
  const route=routeDoc.data() as ManualRouteRecord;
  const reason:ManualMessageReason=input.reason==='delivery_completed'?'delivery_completed':'route_started';
  let eligible=0,queued=0,duplicates=0,failed=0;
  // Janela limitada de concorrência: não serializar dezenas de requisições na saída.
  // O ingest aplica idempotência por evento/pedido, inclusive em retries.
  const candidates=snapshot.docs.map(doc=>({...doc.data(),id:doc.id} as ManualDeliveryRecord))
    .filter(d=>createdAfterActivation(d) && planManualMessage({delivery:d,reason,route}).eligible);
  eligible=candidates.length;
  for(let offset=0;offset<candidates.length;offset+=6){
    const outcomes=await Promise.all(candidates.slice(offset,offset+6).map(d=>forward(d,reason,route)));
    for(const outcome of outcomes){
      if(outcome.status==='queued') queued+=1;
      if(outcome.status==='duplicate') duplicates+=1;
      if(outcome.status==='failed') failed+=1;
    }
  }
  return {status:failed?'failed':'processed',eligible,queued,duplicates,failed};
}
