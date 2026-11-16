/** R76 P2 — policy pure, sem rede. Avisos apenas de cozinha realmente persistida. */
import { normalizeManualMessagePhone } from './manualMessagingPolicy';
export type KitchenStage = 'preparing' | 'ready';
export type KitchenRecord = Record<string, unknown>;
export type KitchenPlan = {eligible:false;reason:string} | {eligible:true;stage:KitchenStage;eventType:'order.production'|'order.ready';at:string;phone:string;name:string;payload:Record<string,string|boolean>};
const txt=(v:unknown)=>typeof v==='string'?v.trim():'';
const time=(v:unknown):number|null=>{
  const s=txt(v);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(s))return null;
  const ms=Date.parse(s);return Number.isFinite(ms)?ms:null;
};
/** R76: canario de cozinha por destinatario, sem afetar mensagens anteriores. */
export function r76KitchenAudienceAllowed(env:Record<string,string|undefined>,phone:string):boolean {
  if(!/^55[1-9]\d{9,10}$/.test(phone))return false;
  if(env.DFL_R76_KITCHEN_AUDIENCE_MODE==='general'&&env.DFL_R76_KITCHEN_GENERAL_APPROVED==='true')return true;
  const pilot=(env.DFL_MESSAGING_PILOT_PHONE_E164||'').trim();
  return /^55[1-9]\d{9,10}$/.test(pilot)&&phone===pilot;
}
export function r76KitchenPlan(d:KitchenRecord,stage:KitchenStage,now=Date.now(),route?:KitchenRecord|null):KitchenPlan {
  const id=txt(d.id), origin=txt(d.origin),source=txt(d.source_system);
  if(!/^dfl-[A-Za-z0-9-]{12,120}$/.test(id))return {eligible:false,reason:'invalid_delivery_id'};
  if(source==='dfl_site'||!['','manual','dfl_entregas'].includes(source)||txt(d.external_order_id))return {eligible:false,reason:'site_or_external_authority'};
  if(!['loja','manual','ifood','food99','keeta'].includes(origin))return {eligible:false,reason:'unapproved_origin'};
  if(d.fulfillment_mode!=='delivery'||(txt(d.logistics_provider)&&d.logistics_provider!=='dfl'))return {eligible:false,reason:'not_dfl_delivery'};
  if(['ifood','food99','keeta'].includes(origin)&&d.logistics_provider!=='dfl')return {eligible:false,reason:'marketplace_not_dfl_courier'};
  if(d.notify_whatsapp!==true||d.manual_messaging_opt_in_v1!==true)return {eligible:false,reason:'no_individual_consent'};
  if(d.developer_test===true||d.exclude_from_reports===true||Boolean(d.owner_order_context)||d.operational_dismissed_at!=null)return {eligible:false,reason:'test_or_dismissed'};
  if(d.completed===true||txt(d.site_order_status).toLowerCase().includes('cancel'))return {eligible:false,reason:'terminal_order'};
  if(route && (route.status==='fechada'||time(route.started_at)!==null||time(route.departure_time)!==null))return {eligible:false,reason:'already_dispatched'};
  const created=time(d.created_at)||time(d.createdAt);
  const prepared=time(d.preparation_started_at),ready=time(d.preparation_ready_at);
  const at=stage==='preparing'?prepared:ready;
  if(created===null||at===null)return {eligible:false,reason:'missing_persisted_evidence'};
  if(stage==='preparing'&&ready!==null)return {eligible:false,reason:'stage_already_ready'};
  if(stage==='ready'&&(prepared===null||ready===null||ready<prepared))return {eligible:false,reason:'stage_order_invalid'};
  if(now-at>7*60_000||at>now+30_000)return {eligible:false,reason:'stage_expired'};
  if(at<created)return {eligible:false,reason:'before_created'};
  const phone=normalizeManualMessagePhone(d.phone);
  if(!phone)return {eligible:false,reason:'invalid_phone'};
  return {eligible:true,stage,eventType:stage==='preparing'?'order.production':'order.ready',at:new Date(at).toISOString(),phone,
    name:txt(d.customer_name).slice(0,80),payload:{delivery_stage_v1:true,delivery_id:id,fulfillment_mode:'delivery',
      logistics_provider:'dfl',origin,source_system:source||'dfl_entregas',notify_whatsapp:true,manual_messaging_opt_in_v1:true,
      created_at:new Date(created).toISOString(),preparation_started_at:new Date(prepared!).toISOString(),
      ...(ready!==null?{preparation_ready_at:new Date(ready).toISOString()}:{})}};
}
