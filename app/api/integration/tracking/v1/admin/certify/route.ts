/** Gate2: owner-only, bounded, read-only certificate. Never issues credentials or messages. */
import { NextRequest, NextResponse } from 'next/server';
import { authorizedOwner } from '@/lib/tracking/gate1/security';
import { inspectConfirmedOwnerDelivery } from '@/lib/tracking/gate1/owner-inspection';
import { ownerNativeCors } from '@/lib/tracking/gate1/native-cors';
import { certifyInspection } from '@/lib/tracking/gate2/certification';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const SAFE={'cache-control':'private, no-store, max-age=0','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
const headers=(request:NextRequest)=>({...SAFE,...ownerNativeCors(request.headers.get('origin'),'GET')});
const fail=(request:NextRequest,status:number)=>NextResponse.json({ok:false,error:'CERTIFICATION_UNAVAILABLE'},{status,headers:headers(request)});
export function OPTIONS(request:NextRequest){
  const cors=ownerNativeCors(request.headers.get('origin'),'GET');
  return new NextResponse(null,{status:cors?204:403,headers:cors||SAFE});
}
export async function GET(request:NextRequest){
  if(!(await authorizedOwner(request)))return fail(request,403);
  const id=request.nextUrl.searchParams.get('delivery_id')||'';
  if(!/^[A-Za-z0-9_-]{1,120}$/.test(id)||[...request.nextUrl.searchParams.keys()].some(k=>k!=='delivery_id'))return fail(request,422);
  try {
    const inspection=await inspectConfirmedOwnerDelivery(id);
    return inspection?NextResponse.json({ok:true,certificate:certifyInspection(inspection)}, {headers:headers(request)}):fail(request,404);
  } catch {return fail(request,503);}
}
