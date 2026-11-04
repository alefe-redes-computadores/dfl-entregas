/** DFL R254 Gate5: pure Node-side bridge handshake protocol for server-only Site use.
 * No network, no Firebase, no browser, no user data and NO secrets persisted.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const BRIDGE_PATH = '/api/integration/tracking/v1/bridge' as const;
export const BRIDGE_CONTRACT = 'dfl.tracking.bridge' as const;
const opaque = /^[A-Za-z0-9_-]{32,96}$/;
const id = /^[A-Za-z0-9_-]{4,64}$/;
const kid = /^[A-Za-z0-9_-]{3,24}$/;
const noncePattern = /^[A-Za-z0-9_-]{20,90}$/;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const sigPattern = /^[a-f0-9]{64}$/;

const exact = (v: Record<string,unknown>, names: readonly string[]) =>
  Object.keys(v).length === names.length && names.every(k => Object.prototype.hasOwnProperty.call(v,k));
const isObj = (x: unknown): x is Record<string,unknown> => Boolean(x && typeof x==='object' && !Array.isArray(x));
const equalHex = (a:string,b:string) => {
  if(!sigPattern.test(a)||!sigPattern.test(b))return false;
  return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
};
export function sha256(value: string) {return createHash('sha256').update(value,'utf8').digest('hex');}
export function canonicalBridgeProof(input: {path:string;challengeHash:string;nonce:string;serverTime:string;tenant:string;kid:string}) {
  return ['DFL_TRACKING_BRIDGE_PROOF_V1',input.path,input.challengeHash,input.nonce,input.serverTime,input.tenant,input.kid].join('\n');
}
export function signBridgeProof(input: {path:string;challengeHash:string;nonce:string;serverTime:string;tenant:string;kid:string;secret:string}) {
  return createHmac('sha256',input.secret).update(canonicalBridgeProof(input)).digest('hex');
}
export type BridgeWire = {path:typeof BRIDGE_PATH;method:'POST';body:string;headers:Record<string,string>};
export function buildBridgeProbe(input:{tenant:string;keyId:string;secret:string;challenge?:string;nonce?:string;timestamp?:string}):BridgeWire {
  if(!id.test(input.tenant)||!kid.test(input.keyId)||typeof input.secret!=='string'||input.secret.length<32||input.secret.length>512)throw Error('Invalid bridge signing configuration');
  const challenge=input.challenge??randomBytes(32).toString('base64url');
  const nonce=input.nonce??randomBytes(24).toString('base64url');
  const timestamp=input.timestamp??new Date().toISOString();
  if(!opaque.test(challenge)||!noncePattern.test(nonce)||!utcPattern.test(timestamp)||!Number.isFinite(Date.parse(timestamp)))throw Error('Invalid bridge challenge/clock');
  const body=JSON.stringify({contract:BRIDGE_CONTRACT,version:1,action:'probe',challenge});
  const base=['POST',BRIDGE_PATH,sha256(body),timestamp,nonce,input.keyId,input.tenant].join('\n');
  return {path:BRIDGE_PATH,method:'POST',body,headers:{
    'content-type':'application/json',
    'x-dfl-tracking-timestamp':timestamp,
    'x-dfl-tracking-nonce':nonce,
    'x-dfl-tracking-kid':input.keyId,
    'x-dfl-tracking-signature':createHmac('sha256',input.secret).update(base).digest('hex'),
  }};
}
export function validBridgeRequest(value:unknown):value is {contract:typeof BRIDGE_CONTRACT;version:1;action:'probe';challenge:string} {
  return isObj(value)&&exact(value,['contract','version','action','challenge'])&&
    value.contract===BRIDGE_CONTRACT&&value.version===1&&value.action==='probe'&&
    typeof value.challenge==='string'&&opaque.test(value.challenge);
}
export type BridgeProof = {contract:typeof BRIDGE_CONTRACT;version:1;status:'reachable';challenge_hash:string;server_time:string;proof:string};
export function verifyBridgeResponse(input:{response:unknown;request:BridgeWire;secret:string;tenant:string;now?:number}):boolean {
  const r=input.response;
  if(!isObj(r)||!exact(r,['contract','version','status','challenge_hash','server_time','proof'])||
    r.contract!==BRIDGE_CONTRACT||r.version!==1||r.status!=='reachable'||
    typeof r.challenge_hash!=='string'||!sigPattern.test(r.challenge_hash)||
    typeof r.proof!=='string'||!sigPattern.test(r.proof)||
    typeof r.server_time!=='string'||!utcPattern.test(r.server_time)||
    !Number.isFinite(Date.parse(r.server_time)))return false;
  if(input.request.path!==BRIDGE_PATH||input.request.method!=='POST'||
     !id.test(input.tenant)||typeof input.secret!=='string'||input.secret.length<32||input.secret.length>512)return false;
  const now=input.now??Date.now();
  if(Math.abs(now-Date.parse(r.server_time))>120_000)return false;
  let envelope:unknown;
  try{envelope=JSON.parse(input.request.body);}catch{return false;}
  if(!validBridgeRequest(envelope))return false;
  const h=input.request.headers;
  const nonce=h['x-dfl-tracking-nonce']||'';
  const keyId=h['x-dfl-tracking-kid']||'';
  if(!noncePattern.test(nonce)||!kid.test(keyId))return false;
  const expectedChallenge=sha256(envelope.challenge);
  const proof=signBridgeProof({path:BRIDGE_PATH,challengeHash:expectedChallenge,nonce,
    serverTime:r.server_time,tenant:input.tenant,kid:keyId,secret:input.secret});
  return equalHex(r.challenge_hash,expectedChallenge)&&equalHex(r.proof,proof);
}
/** The Site must not convert an unavailable bridge probe into a customer access permission. */
export function interpretBridgeTransport(code:number,body:unknown,input:{request:BridgeWire;secret:string;tenant:string;now?:number}) {
  return {connected:code===200&&verifyBridgeResponse({response:body,...input}),public_access_granted:false,messages_sent:false} as const;
}
