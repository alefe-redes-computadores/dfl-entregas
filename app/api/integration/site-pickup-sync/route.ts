/** R83 — pós-escrita de RETIRADA Site, com ACK reverso idempotente.
 * Não cria mensagem Supabase/Evolution. O Site é autoridade comercial.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/integration/server/admin';
import { isSuperadminUid } from '@/lib/access/roles';
import { reconcileReverseTrackingOutbox } from '@/lib/integration/server/reverseReconciler';
import { drainReverseIntegrationEventIds } from '@/lib/integration/server/reverseRelay';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const ORIGINS=new Set(['https://localhost','http://localhost','capacitor://localhost']);
function cors(req:NextRequest):Record<string,string>{
 const origin=req.headers.get('origin')?.trim()||'';
 return ORIGINS.has(origin)?{'access-control-allow-origin':origin,
  'access-control-allow-methods':'POST, OPTIONS',
  'access-control-allow-headers':'authorization, content-type',
  'vary':'Origin'}:{};
}
const result=(req:NextRequest,value:unknown,status=200)=>NextResponse.json(value,{status,
 headers:{...cors(req),'cache-control':'private, no-store'}});
export function OPTIONS(req:NextRequest){
 return ORIGINS.has(req.headers.get('origin')||'')?
  new NextResponse(null,{status:204,headers:cors(req)}):new NextResponse(null,{status:403});
}
const str=(x:unknown)=>typeof x==='string'?x.trim():'';

export async function POST(req:NextRequest){
 const authorization=req.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer '))return result(req,{ok:false,status:'review_required',reason:'unauthorized'},401);
 try{
  const actor=await adminAuth.verifyIdToken(authorization.slice(7),true);
  if(!isSuperadminUid(actor.uid))return result(req,{ok:false,status:'review_required',reason:'forbidden'},403);
 }catch{return result(req,{ok:false,status:'review_required',reason:'unauthorized'},401);}
 let deliveryId='',stage:'ready'|'completed';
 try{
  const raw=await req.text();
  if(raw.length>256) return result(req,{ok:false,status:'review_required',reason:'too_large'},413);
  const data:unknown=JSON.parse(raw);
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('body');
  const parsed=data as Record<string,unknown>,keys=Object.keys(parsed);
  if(keys.length!==2||!keys.every(x=>x==='deliveryId'||x==='stage'))throw Error('shape');
  deliveryId=str(parsed.deliveryId);
  if(!/^dfl-[A-Za-z0-9-]{12,120}$/.test(deliveryId)||
     (parsed.stage!=='ready'&&parsed.stage!=='completed'))throw Error('fields');
  stage=parsed.stage;
 }catch{return result(req,{ok:false,status:'review_required',reason:'invalid_request'},422);}
 try{
  // A solicitação não informa estados, mensagens, telefone ou status comercial.
  // Tudo é lido NOVAMENTE do Firestore após a escrita operacional.
  const snapshot=await adminDb.collection('deliveries').doc(deliveryId).get();
  if(!snapshot.exists)return result(req,{ok:false,status:'skipped',reason:'not_found'},404);
  const delivery=snapshot.data()||{};
  if(delivery.source_system!=='dfl_site'||delivery.fulfillment_mode!=='pickup'||
     !str(delivery.external_order_id)||
     /cancel/.test(str(delivery.site_order_status).toLowerCase()))
    return result(req,{ok:false,status:'skipped',reason:'not_site_pickup'},409);
  if(stage==='ready' && (!str(delivery.pickup_ready_at)||delivery.completed===true))
    return result(req,{ok:false,status:'skipped',reason:'pickup_not_pending_ready'},409);
  if(stage==='completed' && delivery.completed!==true)
    return result(req,{ok:false,status:'skipped',reason:'not_completed'},409);
  // Sem busca global de concluidos, sem replay de mensagens antigas.
  const reconciliation=await reconcileReverseTrackingOutbox({
   tracking:true,recovery:false,analytics:false,activeLimit:1,deliveryId,
  });
  if(!reconciliation.eventIds.length)
    return result(req,{ok:false,status:'review_required',reason:'no_event_selected'},503);
  const relay=await drainReverseIntegrationEventIds(reconciliation.eventIds);
  if(!relay.ok)
    return result(req,{ok:false,status:'review_required',reason:'site_ack_unconfirmed'},503);
  return result(req,{ok:true,status:relay.alreadySent>0?'duplicate':'queued',reason:'site_ack_confirmed'});
 }catch(error){
  console.warn('[R83 pickup-sync] ACK incerto',error instanceof Error?error.name:'unknown');
  return result(req,{ok:false,status:'review_required',reason:'bridge_uncertain'},503);
 }
}
