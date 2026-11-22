/**
 * R82 — fast-lane reversa de cozinha para pedidos do DFL Site.
 * O servidor do Entregas nunca produz mensagem de Site. Ele persiste somente
 * o evento operacional com ID estável e aguarda aceite autenticado do Site.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { adminAuth, adminDb } from '@/lib/integration/server/admin';
import { isSuperadminUid } from '@/lib/access/roles';
import { buildIntegrationEvent, buildOutboxRecord } from '@/lib/integration/contracts';
import { drainReverseIntegrationEventIds } from '@/lib/integration/server/reverseRelay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NATIVE_ORIGINS = new Set(['https://localhost','http://localhost','capacitor://localhost']);
function cors(req: NextRequest): Record<string,string> {
  const origin = req.headers.get('origin')?.trim() || '';
  return NATIVE_ORIGINS.has(origin) ? {
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'authorization, content-type',
    'vary':'Origin',
  } : {};
}
const output=(req:NextRequest,data:unknown,status=200)=>NextResponse.json(data,{
  status,headers:{...cors(req),'cache-control':'private, no-store'},
});
export function OPTIONS(req:NextRequest) {
  return NATIVE_ORIGINS.has(req.headers.get('origin')||'')
    ? new NextResponse(null,{status:204,headers:cors(req)})
    : new NextResponse(null,{status:403});
}
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const validIso=(value:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)&&Number.isFinite(Date.parse(value));

export async function POST(req:NextRequest) {
  const authorization=req.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))return output(req,{ok:false,status:'review_required',reason:'unauthorized'},401);
  try {
    const actor=await adminAuth.verifyIdToken(authorization.slice(7),true);
    if(!isSuperadminUid(actor.uid))return output(req,{ok:false,status:'review_required',reason:'forbidden'},403);
  } catch {return output(req,{ok:false,status:'review_required',reason:'unauthorized'},401);}
  let id='',stage:'preparing'|'ready';
  try {
    const raw=await req.text();
    if(raw.length>256)return output(req,{ok:false,status:'review_required',reason:'request_too_large'},413);
    const parsed=JSON.parse(raw) as Record<string,unknown>;
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed) ||
       Object.keys(parsed).length!==2 || !Object.keys(parsed).every(key=>key==='deliveryId'||key==='stage'))throw Error();
    id=text(parsed.deliveryId);
    if(!/^dfl-[A-Za-z0-9-]{12,120}$/.test(id) || (parsed.stage!=='preparing'&&parsed.stage!=='ready'))throw Error();
    stage=parsed.stage;
  }catch{return output(req,{ok:false,status:'review_required',reason:'invalid_request'},422);}

  try {
    // Nunca confiar no snapshot do telefone, consentimento ou estado do cliente.
    // A unica prova de etapa vem do Firestore operacional ja persistido.
    const snap=await adminDb.collection('deliveries').doc(id).get();
    if(!snap.exists)return output(req,{ok:false,status:'skipped',reason:'delivery_missing'},404);
    const d=snap.data()||{},externalOrderId=text(d.external_order_id);
    if(d.source_system!=='dfl_site'||!externalOrderId||d.fulfillment_mode!=='delivery' ||
       d.completed===true||d.operational_dismissed_at||
       /cancel|finaliz/.test(text(d.site_order_status).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())) {
      return output(req,{ok:false,status:'skipped',reason:'not_active_site_delivery'},409);
    }
    const prepAt=text(d.preparation_started_at),readyAt=text(d.preparation_ready_at);
    const occurredAt=stage==='preparing'?prepAt:readyAt;
    const createdAt=text(d.created_at)||text(d.createdAt);
    if(!validIso(occurredAt) || !validIso(createdAt) || Date.parse(occurredAt)<Date.parse(createdAt) ||
       Date.parse(occurredAt)>Date.now()+30_000) {
      return output(req,{ok:false,status:'review_required',reason:'missing_persisted_stage'},422);
    }
    const commercialPreparing=/producao|pronto|saiu/.test(text(d.site_order_status).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
    if(stage==='ready' && !(
      (validIso(prepAt) && Date.parse(prepAt)<=Date.parse(readyAt)) || commercialPreparing
    )) return output(req,{ok:false,status:'review_required',reason:'preparation_not_confirmed'},422);
    const routeId=text(d.route_id);
    if(routeId) {
      const routeSnap=await adminDb.collection('routes').doc(routeId).get();
      const route=routeSnap.data()||{};
      const started=text(route.started_at)||text(route.departure_time);
      // A etapa precisa existir antes da saída real: não inventar preparo posterior.
      if(validIso(started) && Date.parse(occurredAt)>Date.parse(started))
        return output(req,{ok:false,status:'skipped',reason:'route_already_dispatched'},409);
    }
    const type=stage==='preparing'?'delivery.kitchen_preparing':'delivery.kitchen_ready';
    const fingerprint=createHash('sha256').update(JSON.stringify(occurredAt)).digest('hex').slice(0,24);
    const eventId=`evt-v1__${type}__${encodeURIComponent(id)}__kitchen-${fingerprint}`;
    const payload={
      externalOrderId,externalOrderSource:'dfl_site' as const,deliveryId:id,
      routeId:routeId||null,routeName:null,motoboyId:null,motoboyName:null,
      stopGroupId:text(d.stop_group_id)||id,
      stopPosition:null,stopsAhead:null,totalStops:null,nextStop:false,
      completedAt:null,failedReason:null,
      preparationStartedAt:validIso(prepAt)?prepAt:null,
      preparationReadyAt:validIso(readyAt)?readyAt:null,
    };
    const event=buildIntegrationEvent({
      event_id:eventId,event_type:type,occurred_at:occurredAt,
      source_system:'dfl_entregas',entity_type:'delivery',entity_id:id,
      correlation_id:externalOrderId,payload,
    });
    const ref=adminDb.collection('integration_outbox').doc(encodeURIComponent(eventId));
    try {await ref.create(buildOutboxRecord(event));}
    catch(error){
      const code=String((error as {code?:unknown})?.code??'').toLowerCase();
      if(code!=='6'&&!code.includes('already')&&!code.includes('exists'))throw error;
    }
    // Um segundo toque encontra o MESMO ID. Nao gerar nova mensagem de nunca.
    const ack=await drainReverseIntegrationEventIds([eventId]);
    if(ack.ok) return output(req,{ok:true,status:ack.alreadySent>0?'duplicate':'queued',reason:'site_accepted_event'});
    return output(req,{ok:false,status:'review_required',reason:'site_sync_unconfirmed'},503);
  }catch(error){
    console.warn('[R82 site-kitchen] handoff nao confirmado',error instanceof Error?error.name:'unknown');
    return output(req,{ok:false,status:'review_required',reason:'server_uncertain'},503);
  }
}
