import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/integration/server/admin';
import { isSuperadminUid } from '@/lib/access/roles';
import { notifyManualPickup } from '@/lib/integration/server/manualPickup';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const NATIVE_ORIGINS=new Set(['https://localhost','http://localhost','capacitor://localhost']);
const cors=(req:NextRequest):Record<string,string>=>{
  const origin=req.headers.get('origin')||'';
  return NATIVE_ORIGINS.has(origin)?{'access-control-allow-origin':origin,
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'authorization, content-type','vary':'Origin'}:{};
};
const result=(req:NextRequest,body:unknown,status=200)=>NextResponse.json(body,{status,headers:{...cors(req),'cache-control':'private, no-store'}});
export async function OPTIONS(req:NextRequest){
  return NATIVE_ORIGINS.has(req.headers.get('origin')||'')
    ?new NextResponse(null,{status:204,headers:cors(req)}):new NextResponse(null,{status:403});
}
export async function POST(req:NextRequest){
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return result(req,{ok:false,error:'Unauthorized'},401);
  try{
    const user=await adminAuth.verifyIdToken(bearer.slice(7),true);
    if(!isSuperadminUid(user.uid))return result(req,{ok:false,error:'Forbidden'},403);
  }catch{return result(req,{ok:false,error:'Unauthorized'},401);}
  if(process.env.DFL_MANUAL_PICKUP_ENABLED!=='true')return result(req,{ok:true,status:'off'});
  let body:Record<string,unknown>;
  try{
    const raw=await req.text();if(raw.length>512)return result(req,{ok:false,error:'Request too large'},413);
    const parsed:unknown=JSON.parse(raw);
    if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error('invalid');
    body=parsed as Record<string,unknown>;
  }catch{return result(req,{ok:false,error:'Invalid JSON'},400);}
  if((body.action!=='created'&&body.action!=='ready')||
     typeof body.deliveryId!=='string'||!/^[A-Za-z0-9-]{16,125}$/.test(body.deliveryId))
    return result(req,{ok:false,error:'Invalid action or delivery'},422);
  try{
    const output=await notifyManualPickup(body.deliveryId,body.action);
    return result(req,{ok:output.status!=='failed',...output},output.status==='failed'?503:200);
  }catch{return result(req,{ok:false,status:'failed',reason:'server_error'},503);}
}
