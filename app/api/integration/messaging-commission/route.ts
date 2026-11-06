import { randomUUID, createHash, createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/integration/server/admin';
import { isSuperadminUid } from '@/lib/access/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NATIVE_ORIGINS = new Set(['https://localhost','http://localhost','capacitor://localhost']);
function cors(req:NextRequest):Record<string,string>{
  const origin=req.headers.get('origin')||'';
  return {'cache-control':'private, no-store, max-age=0',...(NATIVE_ORIGINS.has(origin)?{
    'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, OPTIONS',
    'access-control-allow-headers':'authorization, content-type',vary:'Origin'}:{})};
}
const reply=(req:NextRequest,data:unknown,status=200)=>NextResponse.json(data,{status,headers:cors(req)});
export async function OPTIONS(req:NextRequest){const valid=NATIVE_ORIGINS.has(req.headers.get('origin')||'');return new NextResponse(null,{status:valid?204:403,headers:valid?cors(req):{}});}
async function owner(req:NextRequest):Promise<string|null>{
  const auth=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
  if(!auth)return null;
  try{const decoded=await adminAuth.verifyIdToken(auth,true);return isSuperadminUid(decoded.uid)?decoded.uid:null;}catch{return null;}
}
function dayInBrazil(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/\D/g,'');}
function phone(){const p=process.env.DFL_MESSAGING_PILOT_PHONE_E164?.trim()||'';return /^55[1-9]\d{9,10}$/.test(p)?p:null;}
function target(){
  try{
    const raw=process.env.DFL_SITE_INTEGRATION_URL?.trim()||'';
    const secret=process.env.DFL_INTEGRATION_SIGNING_SECRET?.trim()||'';
    if(!raw||!secret)return null;
    const url=new URL(raw);
    if(url.protocol!=='https:'||!['dafamilialanches.com.br','www.dafamilialanches.com.br','dafamilialanches.vercel.app'].includes(url.hostname))return null;
    return {url:`${url.origin}/api/integration/messaging-commission`,secret};
  }catch{return null;}
}
async function invoke(action:'probe'|'pilot_preflight'|'pilot_send',day:string,number:string|null){
  const destination=target();
  if(!destination)return {ok:false,code:'SITE_BRIDGE_NOT_CONFIGURED'};
  const event_id=`dfl-pilot-${randomUUID()}`;
  const body=JSON.stringify({protocol:'dfl.messaging.pilot.v1',source:'dfl_entregas',event_id,
    action,day,...(number?{phone_sha256:createHash('sha256').update(number).digest('hex')}:{})});
  const timestamp=String(Date.now());
  const signature=createHmac('sha256',destination.secret).update(`${timestamp}.${body}`,'utf8').digest('hex');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(destination.url,{method:'POST',cache:'no-store',signal:controller.signal,
      headers:{'content-type':'application/json','x-dfl-event-id':event_id,'x-dfl-timestamp':timestamp,'x-dfl-signature':signature},body});
    const content=await response.json().catch(()=>null) as {ok?:unknown;code?:unknown;queued?:unknown;duplicate?:unknown;providerDelivered?:unknown}|null;
    return {ok:response.ok&&content?.ok===true,code:String(content?.code||`SITE_HTTP_${response.status}`).slice(0,100),
      queued:content?.queued===true,duplicate:content?.duplicate===true,providerDelivered:false};
  }catch{return {ok:false,code:'SITE_BRIDGE_UNAVAILABLE',deliveryUnknown:true};}
  finally{clearTimeout(timer);}
}
function pilotEnabled(){return process.env.DFL_MESSAGING_PILOT_ENABLED==='true'&&phone()!==null;}

export async function GET(req:NextRequest){
  if(!await owner(req))return reply(req,{ok:false,code:'AUTH_REQUIRED'},401);
  const day=dayInBrazil();
  const ledger=await adminDb.collection('integration_messaging_pilot_runs').doc(day).get();
  return reply(req,{ok:true,pilotEnabled:pilotEnabled(),phoneConfigured:phone()!==null,
    bridgeConfigured:target()!==null,alreadyUsedToday:ledger.exists,
    previousOutcome:ledger.exists?String(ledger.data()?.outcome||'reserved'):null,
    note:'Somente um teste por dia; nenhuma mensagem para clientes reais.'});
}
export async function POST(req:NextRequest){
  const uid=await owner(req);if(!uid)return reply(req,{ok:false,code:'AUTH_REQUIRED'},401);
  let action='';
  try{const raw=await req.text();if(raw.length>110)return reply(req,{ok:false,code:'BODY_TOO_LARGE'},413);
    const data=JSON.parse(raw) as {action?:unknown;confirmation?:unknown};
    if(!data||typeof data!=='object'||Array.isArray(data))return reply(req,{ok:false,code:'INVALID_BODY'},400);
    action=typeof data.action==='string'?data.action:'';
    if(action==='pilot_send'&&data.confirmation!=='ENVIAR TESTE FICTICIO')return reply(req,{ok:false,code:'CONFIRMATION_REQUIRED'},400);
  }catch{return reply(req,{ok:false,code:'INVALID_JSON'},400);}
  const day=dayInBrazil();
  if(action==='probe'){
    const check=await invoke('probe',day,null);
    return reply(req,{...check,mode:'read_only',whatsappSent:false},check.ok?200:503);
  }
  if(action!=='pilot_send')return reply(req,{ok:false,code:'ACTION_NOT_SUPPORTED'},400);
  const number=phone();
  if(!pilotEnabled()||!number)return reply(req,{ok:false,code:'PILOT_OFF'},403);
  // Preflight validates both independent gates and test-number fingerprints
  // BEFORE reserving this day's single pilot. Nothing goes to a real queue yet.
  const preflight=await invoke('pilot_preflight',day,number);
  if(!preflight.ok)return reply(req,{ok:false,code:preflight.code,stage:'preflight'},503);
  const ref=adminDb.collection('integration_messaging_pilot_runs').doc(day);
  let reserved=false;
  try{
    reserved=await adminDb.runTransaction(async tx=>{
      const old=await tx.get(ref);
      if(old.exists)return false;
      tx.create(ref,{protocol:'dfl.messaging.pilot.v1',day,created_at:new Date().toISOString(),
        created_by:uid,outcome:'reserved',note:'O número de teste não é armazenado neste documento.'});
      return true;
    });
  }catch{return reply(req,{ok:false,code:'PILOT_LOCK_UNAVAILABLE'},503);}
  if(!reserved)return reply(req,{ok:false,code:'DAILY_LIMIT_REACHED'},409);
  const sent=await invoke('pilot_send',day,number);
  try{await ref.update({outcome:sent.ok?sent.code:'uncertain',updated_at:new Date().toISOString()});}catch{/* O envio pode ter ocorrido. Reserva permanece; nao repetir. */}
  return reply(req,{...sent,stage:'enqueue',dailyLimitReached:true,
    note:'Teste único reservado. Mesmo com timeout, não reenviar; consultar fila e WhatsApp.'},sent.ok?200:503);
}
