/** R252 — explicit owner-only batch read. Never grants access or triggers notifications. */
import { NextRequest, NextResponse } from 'next/server';
import { authorizedOwner, trackingTenant } from '@/lib/tracking/gate1/security';
import { ownerNativeCors } from '@/lib/tracking/gate1/native-cors';
import { validAuditIds } from '@/lib/tracking/gate3/batch-audit';
import { runOwnerBatchAudit } from '@/lib/tracking/gate3/audit-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const SAFE = { 'cache-control':'private, no-store, max-age=0', 'referrer-policy':'no-referrer', 'x-content-type-options':'nosniff' };
const headers=(req:NextRequest)=>({...SAFE,...ownerNativeCors(req.headers.get('origin'),'POST')});
const reject=(req:NextRequest,status:number)=>NextResponse.json({ok:false,error:'AUDIT_UNAVAILABLE'}, {status,headers:headers(req)});
export function OPTIONS(req:NextRequest){
  const cors=ownerNativeCors(req.headers.get('origin'),'POST');
  return new NextResponse(null,{status:cors?204:403,headers:cors||SAFE});
}
export async function POST(req: NextRequest){
  if(!(await authorizedOwner(req)))return reject(req,403);
  if(!trackingTenant())return reject(req,503);
  let packet:unknown;
  try{
    const raw=await req.text();
    if(raw.length<10||raw.length>4096)return reject(req,413);
    packet=JSON.parse(raw);
  }catch{return reject(req,422);}
  if(!packet||typeof packet!=='object'||Array.isArray(packet))return reject(req,422);
  const p=packet as Record<string,unknown>;
  if(Object.keys(p).length!==3||p.contract!=='dfl.tracking.gate3.audit_request'||p.version!==1||!validAuditIds(p.delivery_ids))return reject(req,422);
  try{
    const summary=await runOwnerBatchAudit(p.delivery_ids);
    return NextResponse.json({ok:true,summary}, {headers:headers(req)});
  }catch{return reject(req,503);}
}
