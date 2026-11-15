import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/integration/server/admin';
import { isSuperadminUid } from '@/lib/access/roles';
import { notifyNewManualDelivery } from '@/lib/integration/server/manualMessaging';
import { sendManualTrackingInitial } from '@/lib/tracking/manualTrackingAuto';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const NATIVE_ORIGINS = new Set(['https://localhost','http://localhost','capacitor://localhost']);
function headers(req:NextRequest): Record<string,string>{const origin=req.headers.get('origin')||'';return NATIVE_ORIGINS.has(origin)?{'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, content-type','vary':'Origin'}:{};}
const result=(req:NextRequest,data:unknown,status=200)=>NextResponse.json(data,{status,headers:{...headers(req),'cache-control':'private, no-store'}});
export async function OPTIONS(req:NextRequest){return NATIVE_ORIGINS.has(req.headers.get('origin')||'')?new NextResponse(null,{status:204,headers:headers(req)}):new NextResponse(null,{status:403});}
export async function POST(req:NextRequest){
  if(process.env.DFL_MANUAL_MESSAGING_ENABLED!=='true')return result(req,{ok:true,status:'off'});
  const header=req.headers.get('authorization')||'';
  if(!header.startsWith('Bearer '))return result(req,{ok:false,error:'Unauthorized'},401);
  let ownerUid='';
  try{const decoded=await adminAuth.verifyIdToken(header.slice(7),true);if(!isSuperadminUid(decoded.uid))return result(req,{ok:false,error:'Forbidden'},403);ownerUid=decoded.uid;}catch{return result(req,{ok:false,error:'Unauthorized'},401);}
  let raw:unknown;
  try{const body=await req.text();if(body.length>512) return result(req,{ok:false,error:'Request too large'},413);raw=JSON.parse(body);}catch{return result(req,{ok:false,error:'Invalid JSON'},400);}
  const data=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
  if(data.action!=='created'||typeof data.deliveryId!=='string')return result(req,{ok:false,error:'Unsupported action'},400);
  try{
    // Independent, owner-authorized handoffs. Failure of tracking must never
    // undo the commercial order or change ordinary messaging semantics.
    const [output,tracking]=await Promise.all([
      notifyNewManualDelivery(data.deliveryId),
      sendManualTrackingInitial(data.deliveryId,ownerUid).catch(()=>({status:'review_required' as const,reason:'tracking_unconfirmed'})),
    ]);
    return result(req,{ok:output.status!=='failed',...output,tracking_status:tracking.status},output.status==='failed'?503:200);
  }catch{return result(req,{ok:false,status:'failed',reason:'server_error'},503);}
}
