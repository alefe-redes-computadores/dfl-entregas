/** R254 — canonical signed S2S bridge + fail-closed strict public status. Hermetic, no external IO. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),crypto=require('node:crypto');
let tests=0;
function ok(cond,msg){assert.ok(cond,msg);tests++;}
function eq(actual,expected,msg){assert.deepStrictEqual(actual,expected,msg);tests++;}
function load(file,deps={}) {
 const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 const resolution=n=>n==='server-only'?{}:Object.prototype.hasOwnProperty.call(deps,n)?deps[n]:require(n);
 new Function('require','module','exports',output)(resolution,mod,mod.exports);
 return mod.exports;
}
const protocol=load('lib/tracking/gate5/bridge-protocol.ts');
const core=load('lib/tracking/gate1/core.ts');
const siteContract=load('lib/tracking/gate4/site-contract.ts',{'../gate1/core':core});
const tenant='empresaDFL',kid='siteKey1',secret='S'.repeat(64),challenge='C'.repeat(43),nonce='N'.repeat(32),t=new Date().toISOString();
const wire=protocol.buildBridgeProbe({tenant,keyId:kid,secret,challenge,nonce,timestamp:t});
eq(wire.path,'/api/integration/tracking/v1/bridge','path fixed');
eq(wire.method,'POST','method POST');
const parsed=JSON.parse(wire.body);
eq(parsed,{contract:'dfl.tracking.bridge',version:1,action:'probe',challenge},'closed envelope');
ok(protocol.validBridgeRequest(parsed),'valid envelope');
const expected=crypto.createHmac('sha256',secret).update(['POST',wire.path,crypto.createHash('sha256').update(wire.body).digest('hex'),t,nonce,kid,tenant].join('\n')).digest('hex');
eq(wire.headers['x-dfl-tracking-signature'],expected,'canonical HMAC matches Gate1');
for(const value of [{...parsed,billing:10},{...parsed,challenge:20},{...parsed,version:2},{...parsed,action:'status'},[],null,'json',{},
  {...parsed,challenge:'x'.repeat(10)},{...parsed,challenge:'*'.repeat(43)}])ok(!protocol.validBridgeRequest(value),'closed bridge envelope');
for(const input of [
 {tenant:'?',keyId:kid,secret}, {tenant,keyId:'bad!',secret}, {tenant,keyId:kid,secret:'weak'},
 {tenant,keyId:kid,secret,nonce:'short'}, {tenant,keyId:kid,secret,challenge:'short'},
 {tenant,keyId:kid,secret,timestamp:'2026-99-40T12:00:00Z'},
 {tenant,keyId:kid,secret,timestamp:'2026-11-04 12:00:00'},
]){assert.throws(()=>protocol.buildBridgeProbe(input));tests++;}
for(let i=0;i<16;i++){
  const r=protocol.buildBridgeProbe({tenant,keyId:kid,secret});
  ok(/^[A-Za-z0-9_-]{43}$/.test(JSON.parse(r.body).challenge),'random 256 bit challenge');
  ok(/^[A-Za-z0-9_-]{32}$/.test(r.headers['x-dfl-tracking-nonce']),'random nonce');
  ok(!r.path.includes(JSON.parse(r.body).challenge),'challenge not in URL');
  ok(!JSON.stringify(r.headers).includes(JSON.parse(r.body).challenge),'challenge not in headers');
  ok(!JSON.stringify(r).includes(secret),'secret never serialized');
}
const hash=protocol.sha256(challenge);
const response={contract:'dfl.tracking.bridge',version:1,status:'reachable',challenge_hash:hash,server_time:t,
  proof:protocol.signBridgeProof({path:wire.path,challengeHash:hash,nonce,serverTime:t,tenant,kid,secret})};
ok(protocol.verifyBridgeResponse({response,request:wire,secret,tenant}),'correct proof');
ok(protocol.interpretBridgeTransport(200,response,{request:wire,secret,tenant}).connected,'connected only correct');
for(const [label,payload] of [
 ['extra secret',{...response,secret}],['wrong contract',{...response,contract:'other'}],
 ['wrong status',{...response,status:'authorized'}],['wrong version',{...response,version:2}],
 ['wrong hash',{...response,challenge_hash:'0'.repeat(64)}],['wrong proof',{...response,proof:'f'.repeat(64)}],
 ['wrong time',{...response,server_time:'1999-01-01T00:00:00.000Z'}],
 ['malformed time',{...response,server_time:'2026-99-99T99:99:99Z'}],
 ['token leaked',{...response,opaque_token:'T'.repeat(43)}],['null',null],['array',[]],['HTML','<html/>'],
 ])ok(!protocol.verifyBridgeResponse({response:payload,request:wire,secret,tenant}),label+' rejected');
for(const code of [0,201,301,400,401,403,404,409,422,429,500,503]){
  const status=protocol.interpretBridgeTransport(code,response,{request:wire,secret,tenant});
  eq(status.connected,false,'non-200 not connected');
  eq(status.public_access_granted,false,'never authorizes public');
  eq(status.messages_sent,false,'never sends messages');
}
for(const v of [{tenant:'another'}, {secret:'A'.repeat(64)}, {now:Date.now()+500_000},
  {request:{...wire,headers:{...wire.headers,'x-dfl-tracking-nonce':'Z'.repeat(32)}}}]){
  ok(!protocol.verifyBridgeResponse({response,request:wire,secret,tenant,...v}),'proof bound to party, nonce and time');
}
// Wire request signed by Site mock; probe authenticated by real security implementation with Firestore fake.
let nonceWrites=0;
const nonceDocs=new Set();
const fakeAdmin={adminDb:{collection:n=>({doc:id=>({async create(obj){
  eq(n,'tracking_replay_nonces_v1','nonce-only write path');
  ok(!JSON.stringify(obj).includes(secret),'no secret persisted');
  if(nonceDocs.has(id)){const e=new Error('ALREADY_EXISTS');e.code=6;throw e;}
  nonceDocs.add(id);nonceWrites++;
}})})},adminAuth:{verifyIdToken:async()=>({uid:'owner'})}};
process.env.DFL_TRACKING_GATE1_ACTIVE='1';
process.env.DFL_TRACKING_BRIDGE_PROBE_CERTIFIED='0';
process.env.DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED='0';
process.env.DFL_TRACKING_TENANT_ID=tenant;
process.env.DFL_TRACKING_S2S_KEYS_JSON=JSON.stringify({[kid]:secret});
const security=load('lib/tracking/gate1/security.ts',{'@/lib/integration/server/admin':fakeAdmin,'@/lib/access/roles':{isSuperadminUid:()=>true}});
const reply={json:(body,opt={})=>({status:opt.status||200,body,headers:opt.headers||{}})};
const server=load('lib/tracking/gate5/bridge-server.ts',{
  'next/server':{NextRequest:class{},NextResponse:reply},
  '../gate1/security':security,'./bridge-protocol':protocol,
});
const route=load('app/api/integration/tracking/v1/bridge/route.ts',{'@/lib/tracking/gate5/bridge-server':server});
const req=(w,override={})=>({method:w.method,nextUrl:{pathname:w.path},headers:new Map(Object.entries(w.headers)),text:async()=>w.body,...override});
(async()=>{
  const off=await route.POST(req(wire));eq(off.status,503,'default OFF');eq(nonceWrites,0,'OFF no nonce side effect');
  eq(await security.verifyTrackingBridgeRequest(req(wire),wire.body),'not_ready','bridge probe OFF');
  process.env.DFL_TRACKING_BRIDGE_PROBE_CERTIFIED='1';
  ok(!security.trackingCustomerEnabled(),'bridge does not enable customer');
  eq(await security.verifyTrackingSiteRequest(req(wire),wire.body),'not_ready','customer remains OFF');
  const res=await route.POST(req(wire));eq(res.status,200,'valid signed probe accepted');
  eq(nonceWrites,1,'one replay nonce written');
  ok(protocol.verifyBridgeResponse({response:res.body,request:wire,secret,tenant}),'actual server response authenticates');
  for(const field of ['opaque_token','scope_handle','delivery_id','grant_id','customer_name','email','phone','tenant_id','cookie','session','address','secret','key_id','IP']){
    ok(!JSON.stringify(res.body).includes(`"${field}"`),'response not expose '+field);
  }
  eq(Object.keys(res.body).length,6,'closed proof response');
  eq(res.headers['cache-control'],'no-store, max-age=0','no-cache');
  eq(res.headers['referrer-policy'],'no-referrer','no referrer');
  eq(res.headers['x-content-type-options'],'nosniff','nosniff');
  eq((await route.POST(req(wire))).status,409,'nonce replay blocked');
  eq(nonceWrites,1,'replay has no extra write');
  const request2=protocol.buildBridgeProbe({tenant,keyId:kid,secret});
  const duplicate=await Promise.all([route.POST(req(request2)),route.POST(req(request2))]);
  eq(duplicate.filter(x=>x.status===200).length,1,'concurrent duplicate exactly one accepted');
  eq(duplicate.filter(x=>x.status===409).length,1,'concurrent duplicate exactly one replay');
  eq(nonceWrites,2,'no replay double-write');
  const pristine=()=>protocol.buildBridgeProbe({tenant,keyId:kid,secret});
  const badSig=pristine();badSig.headers['x-dfl-tracking-signature']='0'.repeat(64);
  const badTime=protocol.buildBridgeProbe({tenant,keyId:kid,secret,timestamp:'2025-11-04T12:00:00Z'});
  const badPath=pristine();
  const tampered=pristine();tampered.body=tampered.body+' ';
  const falseTenant=protocol.buildBridgeProbe({tenant:'outroTenant',keyId:kid,secret});
  const badNonce=pristine();badNonce.headers['x-dfl-tracking-nonce']='a';
  const missingKid=pristine();delete missingKid.headers['x-dfl-tracking-kid'];
  const unknownKid=protocol.buildBridgeProbe({tenant,keyId:'otherKey',secret});
  const invalidClock=protocol.buildBridgeProbe({tenant,keyId:kid,secret,timestamp:'2026-11-04T12:00:00Z'});
  invalidClock.headers['x-dfl-tracking-timestamp']='2026-99-99T99:99:99Z';
  for(const [label,w,override,code] of [
    ['badSig',badSig,{},401],['expired',badTime,{},401],['path',badPath,{nextUrl:{pathname:'/api/integration/tracking/v1/status'}},404],
    ['body tamper',tampered,{},401],['tenant',falseTenant,{},401],['nonce',badNonce,{},401],
    ['missing kid',missingKid,{},401],['unknown kid',unknownKid,{},401],['bad clock',invalidClock,{},401],
    ['method',pristine(),{method:'GET'},404],
  ]){const out=await route.POST(req(w,override));eq(out.status,code,label+' rejected');}
  const beforeWrites=nonceWrites;
  for(const body of [JSON.stringify({...parsed,token:'T'.repeat(43)}),'{}','<html>','[]','invalid',JSON.stringify({...parsed,challenge:'?'})]){
    const base=pristine();base.body=body;
    eq((await route.POST(req(base))).status,422,'malformed request refused early');
  }
  eq(nonceWrites,beforeWrites,'invalids never write nonce');
  const disabled=pristine();process.env.DFL_TRACKING_BRIDGE_PROBE_CERTIFIED='0';
  eq((await route.POST(req(disabled))).status,503,'killswitch on future requests');
  eq(nonceWrites,beforeWrites,'disabled no writes');
  process.env.DFL_TRACKING_BRIDGE_PROBE_CERTIFIED='1';
  const missingEnv=pristine();delete process.env.DFL_TRACKING_TENANT_ID;
  eq((await route.POST(req(missingEnv))).status,503,'no tenant fails closed');
  process.env.DFL_TRACKING_TENANT_ID=tenant;
  const ownerStatus=fs.readFileSync('lib/tracking/gate1/http.ts','utf8');
  ok(ownerStatus.includes('validateStrictPublicProjection(projection)'),'public status strengthened');
  // Executable public status server check: injected malicious extra field cannot reach Site.
  const fixture=JSON.parse(fs.readFileSync('contracts/tracking/v1/fixtures/B-em-rota.exemplo.json','utf8'));
  let projected=fixture;
  const http=load('lib/tracking/gate1/http.ts',{
    'next/server':{NextRequest:class{},NextResponse:reply},
    './security':{authorizedOwner:async()=>null,trackingCodeEnabled:()=>false,trackingTenant:()=>tenant,
      trackingCustomerEnabled:()=>true,verifyTrackingSiteRequest:async()=> 'ok',allowTrackingStatusAttempt:async()=>true,
      allowTokenExchangeAttempt:async()=>true},
    './storage':{capabilities:async()=>({}),canAccessCustomer:()=>true,querySession:async()=>projected},
    './core':core,
  });
  const statusRequest=()=>({text:async()=>JSON.stringify({contract:'dfl.tracking.access',version:1,action:'status',scope_handle:'H'.repeat(43)})});
  eq((await http.status(statusRequest())).status,200,'strict status accepts canonical fixture');
  for(const key of ['phone','delivery_id','route_id','payment_method','address','gps','tracking_cookie']){
    projected={...fixture,[key]:'DADO PRIVADO'};
    eq((await http.status(statusRequest())).status,404,'strict status blocks extra '+key);
    eq(siteContract.parseSiteStatusResponse(200,projected).state,'unavailable','Site blocks extra '+key);
  }
  projected={...fixture,progress:{...fixture.progress,current_stop_number:999}};
  eq((await http.status(statusRequest())).status,404,'strict status blocks inconsistent progress');
  projected=fixture;
  eq((await http.status(statusRequest())).status,200,'status restored valid');
  // Legacy gates remain in PREAPK; any operational change must satisfy all of them.
  const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
  for(const v of ['scripts/test-r249-gate1-tracking.cjs','scripts/test-r250-tracking-control.cjs',
    'scripts/test-r251-gate2.cjs','scripts/test-r252-batch-audit.cjs','scripts/test-r253-site-bridge.cjs',
    'scripts/test-r254-bridge-handshake.cjs'])ok(pre.includes(v),'legacy PREAPK retained '+v);
  const source=fs.readFileSync('lib/tracking/gate5/bridge-server.ts','utf8');
  for(const mark of ['issueGrant(','revokeGrant(','exchangeToken(','querySession(','deliveries','sendWhatsApp(','fetch(','window.','localStorage'])ok(!source.includes(mark),'probe does not access '+mark);
  for(const doc of ['docs/DFL-R254-GATE5-PROVA-CONEXAO-SITE.md','docs/DFL-R254-PROMPT-SITE.txt'])ok(fs.existsSync(doc),'handoff '+doc);
  console.log(`R254_GATE5_APROVADO: ${tests} testes S2S assinados, replay, privacidade, compatibilidade e status estrito; nenhuma rede/Firestore reais.`);
})().catch(e=>{console.error('R254_GATE5_BLOQUEADO',e);process.exitCode=1});
