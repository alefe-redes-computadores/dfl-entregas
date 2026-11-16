import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import { adminDb } from '@/lib/integration/server/admin';
import { r76KitchenPlan, r76KitchenAudienceAllowed, type KitchenStage } from '@/lib/integration/r76KitchenPolicy';
import { confirmedDelivery } from '@/lib/tracking/gate1/storage';
export type KitchenNotice = {status:'off'|'skipped'|'queued'|'duplicate'|'review_required';reason?:string};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const enabled=()=>process.env.DFL_R76_KITCHEN_ENABLED==='true'&&process.env.DFL_R76_KITCHEN_KILL_SWITCH==='false'&&
  process.env.DFL_R76_KITCHEN_ROLLOUT_APPROVED==='true'&&process.env.DFL_R76_KITCHEN_WORKER_CERTIFIED==='true'&&
  process.env.DFL_MANUAL_MESSAGING_ENABLED==='true'&&process.env.DFL_MANUAL_MESSAGING_KILL_SWITCH!=='true';
const activated=()=>{const n=Date.parse(process.env.DFL_R76_KITCHEN_ACTIVATED_AT||'');return Number.isFinite(n)?n:null};
function site(){
  const raw=process.env.DFL_SITE_INTEGRATION_URL?.trim(),secret=process.env.DFL_INTEGRATION_SIGNING_SECRET?.trim();
  if(!raw||!secret)return null;
  try{const url=new URL(raw);if(url.protocol!=='https:'||url.port||url.search||url.hash||
    !['dafamilialanches.com.br','www.dafamilialanches.com.br','dafamilialanches.vercel.app'].includes(url.hostname))return null;
    return {url:`${url.origin}/api/integration/manual-messaging`,secret};
  }catch{return null;}
}
/** Reserva Firestore CREATE por pedido e etapa antes de qualquer tentativa externa. */
export async function notifyR76KitchenStage(deliveryId:string,stage:KitchenStage):Promise<KitchenNotice>{
  if(!enabled())return {status:'off',reason:'kitchen_rollout_off'};
  if(!/^dfl-[A-Za-z0-9-]{12,120}$/.test(deliveryId)||!['preparing','ready'].includes(stage))return {status:'skipped',reason:'invalid_request'};
  const activation=activated();if(activation===null)return {status:'off',reason:'activation_unconfigured'};
  const target=site();if(!target)return {status:'off',reason:'site_bridge_unconfigured'};
  const confirmed=await confirmedDelivery(deliveryId);
  if(!confirmed)return {status:'skipped',reason:'order_unavailable'};
  const plan=r76KitchenPlan(confirmed.data,stage,Date.now(),confirmed.route);
  if(!plan.eligible)return {status:'skipped',reason:plan.reason};
  if(!r76KitchenAudienceAllowed(process.env,plan.phone))return {status:'skipped',reason:'r76_pilot_only'};
  const created=Date.parse(String(confirmed.data.created_at||confirmed.data.createdAt||''));
  if(!Number.isFinite(created)||created<activation||Date.parse(plan.at)<activation)return {status:'skipped',reason:'predates_rollout'};
  const transitionKey=hash(`r76-kitchen-v1|${deliveryId}|${stage}|${plan.at}`);
  const eventId=`manual-msg-v2__${plan.eventType}__${deliveryId}__${transitionKey}`;
  const ledger=adminDb.collection('r76_kitchen_stage_events_v1').doc(hash(`${deliveryId}|${stage}`));
  try{await ledger.create({delivery_id:deliveryId,phase:stage,event_id:eventId,occurred_at:plan.at,status:'reserved',created_at:new Date().toISOString()});}
  catch(error){const code=String((error as {code?:unknown})?.code||'');return /^(6|already-exists|ALREADY_EXISTS)$/.test(code)?{status:'duplicate',reason:'already_reserved'}:{status:'review_required',reason:'reservation_unconfirmed'};}
  const settle=async(status:string,reason?:string)=>{try{await ledger.update({status,updated_at:new Date().toISOString(),...(reason?{reason}:{})});}catch{/* original reservation remains */}};
  try{
    // Relê para evitar um envio após cancelamento, reclassificação ou alteração de telefone.
    const current=await confirmedDelivery(deliveryId),fresh=current?r76KitchenPlan(current.data,stage,Date.now(),current.route):null;
    if(!fresh?.eligible||fresh.at!==plan.at||fresh.phone!==plan.phone){await settle('suppressed','state_changed');return {status:'skipped',reason:'state_changed'};}
    const event={source:'manual',event_type:plan.eventType,event_id:eventId,order_id:`entregas:${deliveryId}`,
      occurred_at:plan.at,customer_phone:plan.phone,customer_name:plan.name,payload:{...plan.payload,transition_key:transitionKey}};
    const body=JSON.stringify(event),timestamp=String(Date.now());
    const signature=createHmac('sha256',target.secret).update(`${timestamp}.${body}`,'utf8').digest('hex');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
    try{
      const reply=await fetch(target.url,{method:'POST',headers:{'content-type':'application/json','x-dfl-timestamp':timestamp,
        'x-dfl-event-id':eventId,'x-dfl-signature':signature},body,signal:controller.signal,cache:'no-store',redirect:'error'});
      const json=await reply.json().catch(()=>null) as {ok?:boolean;queued?:boolean;duplicate?:boolean}|null;
      if(reply.ok&&json?.ok===true&&json.queued===true){await settle('queued');return {status:'queued'};}
      if(reply.ok&&json?.ok===true&&json.duplicate===true){await settle('duplicate');return {status:'duplicate'};}
      await settle('review_required','site_not_confirmed');return {status:'review_required',reason:'site_not_confirmed'};
    }catch{await settle('review_required','transport_uncertain');return {status:'review_required',reason:'transport_uncertain'};}
    finally{clearTimeout(timer);}
  }catch{await settle('review_required','unconfirmed');return {status:'review_required',reason:'unconfirmed'};}
}
