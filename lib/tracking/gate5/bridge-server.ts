/** R254: limited signed S2S handshake. No customer access, no delivery reads, no link issuance. */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { verifyTrackingBridgeRequest, signTrackingBridgeProof, trackingTenant } from '../gate1/security';
import { BRIDGE_PATH, BRIDGE_CONTRACT, validBridgeRequest, sha256 } from './bridge-protocol';

const headers={'cache-control':'no-store, max-age=0','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff'} as const;
const error=(status:number)=>NextResponse.json({error:{code:'TRACKING_UNAVAILABLE'}},{status,headers});
export async function probeBridge(request:NextRequest) {
  try{
    if(request.method!=='POST'||request.nextUrl.pathname!==BRIDGE_PATH)return error(404);
    const raw=await request.text();
    if(raw.length<2||raw.length>2048)return error(422);
    let payload:unknown;
    try{payload=JSON.parse(raw);}catch{return error(422);}
    if(!validBridgeRequest(payload))return error(422);
    const auth=await verifyTrackingBridgeRequest(request,raw);
    if(auth!=='ok')return error(auth==='invalid'?401:auth==='replay'?409:503);
    const tenant=trackingTenant();
    const kid=request.headers.get('x-dfl-tracking-kid')||'';
    const nonce=request.headers.get('x-dfl-tracking-nonce')||'';
    if(!tenant)return error(503);
    const server_time=new Date().toISOString();
    const challenge_hash=sha256(payload.challenge);
    const proof=signTrackingBridgeProof({challengeHash:challenge_hash,nonce,serverTime:server_time,kid});
    if(!proof)return error(503);
    return NextResponse.json({contract:BRIDGE_CONTRACT,version:1,status:'reachable',challenge_hash,server_time,proof},{status:200,headers});
  }catch{return error(503);}
}
