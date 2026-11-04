/** Gate4: restricted read-only S2S readiness. Never reveals secrets or enables public services. */
import { NextRequest, NextResponse } from 'next/server';
import { authorizedOwner } from '@/lib/tracking/gate1/security';
import { ownerNativeCors } from '@/lib/tracking/gate1/native-cors';
import { inspectSiteHandoff } from '@/lib/tracking/gate4/owner-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const responseHeaders = {'cache-control':'no-store, max-age=0','pragma':'no-cache','referrer-policy':'no-referrer'};
function reply(req: NextRequest, data:unknown, status:number){
  const cors=ownerNativeCors(req.headers.get('origin'),'GET');
  return NextResponse.json(data,{status,headers:{...responseHeaders,...(cors||{})}});
}
export async function OPTIONS(req:NextRequest){
  const cors=ownerNativeCors(req.headers.get('origin'),'GET');
  return new NextResponse(null,{status:cors?204:403,headers:{...responseHeaders,...(cors||{})}});
}
export async function GET(req:NextRequest){
  if(!(await authorizedOwner(req)))return reply(req,{ok:false,error:'Unauthorized'},403);
  try{return reply(req,{ok:true,report:await inspectSiteHandoff()},200);}
  catch{return reply(req,{ok:false,error:'Handoff unavailable'},503);}
}
