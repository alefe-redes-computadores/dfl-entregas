/** R70 — owner-only, read-only initial tracking status.
 * An inspection MUST NEVER send, reserve or generate a token.
 */
import { NextRequest,NextResponse } from 'next/server';
import { adminAuth } from '@/lib/integration/server/admin';
import { isSuperadminUid } from '@/lib/access/roles';
import { inspectManualTracking } from '@/lib/tracking/manualTrackingAuto';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const NATIVE=new Set(['https://localhost','http://localhost','capacitor://localhost']);
const headers=(req:NextRequest):Record<string,string>=>NATIVE.has(req.headers.get('origin')||'')?
  {'access-control-allow-origin':req.headers.get('origin')||'','access-control-allow-methods':'GET, OPTIONS',
    'access-control-allow-headers':'authorization','vary':'Origin','cache-control':'private, no-store'}:
  {'cache-control':'private, no-store'};
const json=(req:NextRequest,body:unknown,status=200)=>NextResponse.json(body,{status,headers:headers(req)});
export async function OPTIONS(req:NextRequest){return NATIVE.has(req.headers.get('origin')||'')?
  new NextResponse(null,{status:204,headers:headers(req)}):new NextResponse(null,{status:403});}
export async function GET(req:NextRequest){
  const authorization=req.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))return json(req,{ok:false,code:'UNAUTHORIZED'},401);
  try {
    const actor=await adminAuth.verifyIdToken(authorization.slice(7),true);
    if(!isSuperadminUid(actor.uid))return json(req,{ok:false,code:'FORBIDDEN'},403);
  }catch{return json(req,{ok:false,code:'UNAUTHORIZED'},401);}
  const id=req.nextUrl.searchParams.get('deliveryId')||'';
  if(!/^dfl-[A-Za-z0-9-]{12,75}$/.test(id))return json(req,{ok:false,code:'INVALID_ID'},422);
  try{
    const info=await inspectManualTracking(id);
    if(!info)return json(req,{ok:false,code:'NOT_AVAILABLE'},404);
    return json(req,{ok:true,...info});
  }catch{return json(req,{ok:false,code:'INSPECTION_UNAVAILABLE'},503);}
}
