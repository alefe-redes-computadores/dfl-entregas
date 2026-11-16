import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/integration/server/admin';
import { isSuperadminUid } from '@/lib/access/roles';
import { notifyR76KitchenStage } from '@/lib/integration/server/r76KitchenMessaging';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const NATIVE=new Set(['https://localhost','http://localhost','capacitor://localhost']);
const cors=(req:NextRequest):Record<string,string>=>{const origin=req.headers.get('origin')||'';return NATIVE.has(origin)?{
  'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, content-type','vary':'Origin'}:{}};
const output=(req:NextRequest,data:unknown,status=200)=>NextResponse.json(data,{status,headers:{...cors(req),'cache-control':'private, no-store'}});
export async function OPTIONS(req:NextRequest){return NATIVE.has(req.headers.get('origin')||'')?new NextResponse(null,{status:204,headers:cors(req)}):new NextResponse(null,{status:403});}
export async function POST(req:NextRequest){
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return output(req,{ok:false,status:'off',reason:'unauthorized'},401);
  try{const user=await adminAuth.verifyIdToken(auth.slice(7),true);if(!isSuperadminUid(user.uid))return output(req,{ok:false,status:'off',reason:'forbidden'},403);}
  catch{return output(req,{ok:false,status:'off',reason:'unauthorized'},401);}
  let data:Record<string,unknown>;
  try{const raw=await req.text();if(raw.length>256)return output(req,{ok:false,status:'off',reason:'request_too_large'},413);
    const parsed:unknown=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();data=parsed as Record<string,unknown>;
  }catch{return output(req,{ok:false,status:'off',reason:'invalid_json'},400);}
  if(Object.keys(data).length!==2||!Object.keys(data).every(x=>['deliveryId','stage'].includes(x))||
    typeof data.deliveryId!=='string'||!/^dfl-[A-Za-z0-9-]{12,120}$/.test(data.deliveryId)||
    (data.stage!=='preparing'&&data.stage!=='ready'))return output(req,{ok:false,status:'skipped',reason:'invalid_request'},422);
  try{const result=await notifyR76KitchenStage(data.deliveryId,data.stage);
    return output(req,{ok:result.status!=='review_required',...result},result.status==='review_required'?503:200);
  }catch{return output(req,{ok:false,status:'review_required',reason:'server_uncertain'},503);}
}
