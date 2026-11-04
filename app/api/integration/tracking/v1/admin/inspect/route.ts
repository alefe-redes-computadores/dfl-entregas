import { NextRequest, NextResponse } from 'next/server';
import { authorizedOwner } from '@/lib/tracking/gate1/security';
import { inspectConfirmedOwnerDelivery } from '@/lib/tracking/gate1/owner-inspection';
import { ownerNativeCors } from '@/lib/tracking/gate1/native-cors';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const baseHeaders={'cache-control':'private, no-store, max-age=0','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
const headers=(request:NextRequest)=>({...baseHeaders,...ownerNativeCors(request.headers.get('origin'),'GET')});
const fail=(request:NextRequest,status:number)=>NextResponse.json({ok:false,error:'INSPECTION_UNAVAILABLE'}, {status,headers:headers(request)});
export function OPTIONS(request:NextRequest){
  const native=ownerNativeCors(request.headers.get('origin'),'GET');
  return new NextResponse(null,{status:native?204:403,headers:native||baseHeaders});
}
export async function GET(request:NextRequest){
  // This is an internal read-only inspection; it does not enable tracking, grants or messaging.
  if (!(await authorizedOwner(request))) return fail(request,403);
  const id=request.nextUrl.searchParams.get('delivery_id')||'';
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(id) || [...request.nextUrl.searchParams.keys()].some(k=>k!=='delivery_id')) return fail(request,422);
  try {
    const snapshot=await inspectConfirmedOwnerDelivery(id);
    return snapshot ? NextResponse.json({ok:true,inspection:snapshot},{headers:headers(request)}):fail(request,404);
  }catch{return fail(request,503);}
}
