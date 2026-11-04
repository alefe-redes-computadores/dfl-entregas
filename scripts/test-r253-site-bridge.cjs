/** R253: S2S wire, strict public payload, owner-only diagnostics, site fail-closed — no live network. */
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const crypto=require('node:crypto');
let tests=0;
const read=f=>fs.readFileSync(f,'utf8');
function ok(condition,label){assert.ok(condition,label);tests++;}
function eq(actual,expected,label){assert.deepEqual(actual,expected,label);tests++;}
function load(file,dependencies={}) {
  const compiled=ts.transpileModule(read(file),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const mod={exports:{}};
  const resolve=n=> n==='server-only'?{}:Object.prototype.hasOwnProperty.call(dependencies,n)?dependencies[n]:require(n);
  new Function('require','module','exports',compiled)(resolve,mod,mod.exports);
  return mod.exports;
}
const handoff=load('lib/tracking/gate4/handoff.ts');
const siteWire=load('lib/tracking/gate4/site-wire.ts');
const core=load('lib/tracking/gate1/core.ts');
const siteContract=load('lib/tracking/gate4/site-contract.ts',{'../gate1/core':core});

// Missing and malformed S2S configuration cannot be confused with readiness.
const secret='S'.repeat(48), tenant='empresaDFL',kid='siteKey1';
for(const value of [undefined,'','{','[]','{}','{"a":"short"}',JSON.stringify({a:secret,b:secret,c:secret,d:secret,e:secret}),
  JSON.stringify({'!bad':secret}),JSON.stringify({a:42})])ok(!handoff.validateKeysetShape(value),'keyset rejected');
for(const value of [JSON.stringify({siteKey1:secret}),JSON.stringify({siteKey1:secret,siteKey2:'Q'.repeat(32)})])ok(handoff.validateKeysetShape(value),'keyset accepted');

const defaults=handoff.evaluateGate4({codeEnabled:false,tenantConfigured:false,keysetConfigured:false,customerCertified:false});
eq(defaults.integration_status,'off','default gated');
eq(defaults.company_mode,'OFF','default mode OFF');
eq(defaults.kill_switch,true,'default kill-switch');
eq(defaults.public_links_issued_by_diagnostic,false,'no issue');
eq(defaults.messages_sent_by_diagnostic,false,'no messages');
eq(defaults.checks.length,5,'five contracts');
for(const v of [
  {codeEnabled:true,tenantConfigured:true,keysetConfigured:true,customerCertified:false,capability:{mode:'MANUAL',kill_switch:false,public_tracking:true,issue_tracking_link:true}},
  {codeEnabled:true,tenantConfigured:true,keysetConfigured:true,customerCertified:true,capability:{mode:'OFF',kill_switch:false,public_tracking:true,issue_tracking_link:true}},
  {codeEnabled:true,tenantConfigured:true,keysetConfigured:true,customerCertified:true,capability:{mode:'MANUAL',kill_switch:true,public_tracking:true,issue_tracking_link:true}},
  {codeEnabled:true,tenantConfigured:true,keysetConfigured:true,customerCertified:true,capability:{mode:'MANUAL',kill_switch:false,public_tracking:false,issue_tracking_link:true}},
])eq(handoff.evaluateGate4(v).integration_status,'off','safe off policy');
for(const mode of ['DRY_RUN','MANUAL','AUTOMATIC_CERTIFIED']){
 const report=handoff.evaluateGate4({codeEnabled:true,tenantConfigured:true,keysetConfigured:true,customerCertified:true,
   capability:{mode,kill_switch:false,public_tracking:true,issue_tracking_link:true}});
 eq(report.integration_status,'requires_joint_certification','no spurious E2E certificate');
 ok(report.checks.every(c=>['A','B','C','D','E'].includes(c.id)),'contract ids');
 const exported=handoff.formatGate4HandoffForSite(report);
 for(const forbidden of ['TOKEN','bearer','credential','keyId','telefone','endereço','senha','privada']){
   // Privacy wording may legitimately include the word "token"; no actual material included.
   if(forbidden==='TOKEN')continue;
   ok(!exported.includes(`${forbidden}=`),'no sensitive assignments');
 }
}
for(const mode of [false,null,0,'strange','DRY_RUN']){
 const result=handoff.evaluateGate4({codeEnabled:true,tenantConfigured:false,keysetConfigured:false,customerCertified:false,
   capability:{mode,kill_switch:false,public_tracking:true,issue_tracking_link:true}});
 eq(result.integration_status,'off','invalid/low modes gated');
}
const config='TESTCONFIG SECRET 4394';
const generated=handoff.formatGate4HandoffForSite(handoff.evaluateGate4({codeEnabled:true,tenantConfigured:true,keysetConfigured:true,customerCertified:false}));
ok(!generated.includes(config)&&!generated.includes(tenant),'sanitized report');

// Literal wire bytes: match Entregas HMAC exactly. No credential in path or header.
const time='2026-11-04T15:12:00.000Z',nonce='K'.repeat(32),token='T'.repeat(43),handle='H'.repeat(43);
for(const [action,credential] of [['exchange',token],['status',handle]]){
  const wire=siteWire.buildSiteTrackingWire({action,credential,tenant,keyId:kid,signingSecret:secret,timestamp:time,nonce});
  eq(wire.method,'POST','POST only');
  eq(wire.path,siteWire.SITE_TRACKING_PATHS[action],'canonical path');
  ok(!wire.path.includes(credential),'not in URL');
  eq(wire.headers['content-type'],'application/json','json');
  ok(!JSON.stringify(wire.headers).includes(credential),'not in headers');
  ok(!JSON.stringify(wire).includes(secret),'secret never returned');
  const signed=['POST',wire.path,crypto.createHash('sha256').update(wire.body).digest('hex'),time,nonce,kid,tenant].join('\n');
  eq(wire.headers['x-dfl-tracking-signature'],crypto.createHmac('sha256',secret).update(signed).digest('hex'),'HMAC matches security.ts');
  const data=JSON.parse(wire.body);
  eq(data.contract,'dfl.tracking.access','C contract');
  eq(data.version,1,'C version');
  eq(data.action,action,'action match');
  eq(Object.keys(data).length,4,'closed input');
  ok(Object.values(data).includes(credential),'credential only in body');
  ok(!JSON.stringify(data).includes(tenant),'tenant derived from S2S configuration');
  for(const tamper of [wire.path+'/x',wire.body+' ',nonce+'Q',tenant+'Q',kid+'Q']){
    const sig=crypto.createHmac('sha256',secret).update(tamper).digest('hex');
    ok(sig!==wire.headers['x-dfl-tracking-signature'],'tamper not same signature');
  }
}
for(const input of [
  {action:'exchange',credential:'short',tenant,keyId:kid,signingSecret:secret},
  {action:'status',credential:'invalid',tenant,keyId:kid,signingSecret:secret},
  {action:'status',credential:handle,tenant:'bad tenant!',keyId:kid,signingSecret:secret},
  {action:'status',credential:handle,tenant,keyId:'?',signingSecret:secret},
  {action:'status',credential:handle,tenant,keyId:kid,signingSecret:'short'},
  {action:'status',credential:handle,tenant,keyId:kid,signingSecret:secret,nonce:'x'},
  {action:'status',credential:handle,tenant,keyId:kid,signingSecret:secret,timestamp:'invalid'},
]){assert.throws(()=>siteWire.buildSiteTrackingWire(input));tests++;}
const policy=siteWire.siteTrackingFetchPolicy();
eq(policy.cache,'no-store','cache off');eq(policy.redirect,'error','redirect blocked');eq(policy.credentials,'omit','cookie not forwarded');

// B schema strict: valid sample succeeds, private or stale output invalidated.
const fixture=JSON.parse(read('contracts/tracking/v1/fixtures/B-em-rota.exemplo.json'));
eq(siteContract.parseSiteStatusResponse(200,fixture).state,'ok','B fixture accepted');
for(const extra of [{phone:'3499999999'},{payment:42},{administrative_uid:'abc'},{gps:{lat:0,lng:0}},{eta_minutes:5}]){
 const result=siteContract.parseSiteStatusResponse(200,{...fixture,...extra});
 eq(result.state,'unavailable','B extra rejected');
 eq(result.reason,'invalid_payload','B fail closed');
 ok(siteContract.siteMustClearDisplayedTracking(result),'clear display');
}
for(const invalid of [null,undefined,[],{},'html',{...fixture,version:42},{...fixture,status:'assigned'},
 {...fixture,progress:{...fixture.progress,current_stop_number:99}},{...fixture,order:{...fixture.order,phone:'123'}}]){
 const output=siteContract.parseSiteStatusResponse(200,invalid);
 ok(output.state==='unavailable','invalid 200 blocked');
 ok(siteContract.siteMustClearDisplayedTracking(output),'no stale display');
}
for(const code of [0,202,301,400,401,403,404,409,422,429,500,503,504]){
 const result=siteContract.parseSiteStatusResponse(code,fixture);
 eq(result.state,'unavailable','non-200 not reused');
 eq(siteContract.siteMustClearDisplayedTracking(result),true,'clear after error');
}
const exp={contract:'dfl.tracking.access',version:1,authorized:true,scope_handle:handle,scope_expires_at:new Date(Date.now()+20*60_000).toISOString()};
ok(siteContract.isValidExchangeResponse(exp),'valid short session');
for(const error of [
 {...exp,scope_handle:'bad'},
 {...exp,scope_expires_at:new Date(Date.now()-1000).toISOString()},
 {...exp,scope_expires_at:new Date(Date.now()+40*60_000).toISOString()},
 {...exp,scope_expires_at:'bad'},
 {...exp,authorized:false},
 {...exp,admin:true},
 {...exp,version:2},
])ok(!siteContract.isValidExchangeResponse(error),'invalid exchange response rejected');

// Owner-only GET API, no token leakage and native CORS is limited.
const mockCors=(origin,method)=> origin==='https://localhost'?{
  'access-control-allow-origin':origin,'access-control-allow-methods':`${method}, OPTIONS`,vary:'Origin'
}:null;
let ownerUid=null;
let inspected=0;
const fakeReport=handoff.evaluateGate4({codeEnabled:false,tenantConfigured:false,keysetConfigured:false,customerCertified:false});
const reply={json:(body,opts={})=>({body,status:opts.status||200,headers:opts.headers||{}})};
function Response(_body,opts={}){this.status=opts.status;this.headers=opts.headers;}
const api=load('app/api/integration/tracking/v1/admin/handoff/route.ts',{
  'next/server':{NextRequest:class {},NextResponse:Object.assign(Response,reply)},
  '@/lib/tracking/gate1/security':{authorizedOwner:async()=>ownerUid},
  '@/lib/tracking/gate1/native-cors':{ownerNativeCors:mockCors},
  '@/lib/tracking/gate4/owner-server':{inspectSiteHandoff:async()=>{inspected++;return fakeReport;}},
});
const req=origin=>({headers:{get:n=>n==='origin'?origin:null}});
(async()=>{
  let result=await api.GET(req(null));
  eq(result.status,403,'unauthorized 403');eq(inspected,0,'unauthorized no Firestore');
  ownerUid='authorized-owner';
  result=await api.GET(req('https://localhost'));
  eq(result.status,200,'owner can inspect');
  eq(result.body.report.contract,'dfl.tracking.gate4.handoff','report contract');
  eq(result.headers['access-control-allow-origin'],'https://localhost','CORS native only');
  eq(result.headers['cache-control'],'no-store, max-age=0','no-cache');
  const serialized=JSON.stringify(result.body);
  for(const field of ['opaque_token','scope_handle','tenant_id','phone','address','value','secret','order_key','email'])ok(!serialized.includes(`"${field}"`),'no private field');
  result=await api.GET(req('https://evil.example'));
  ok(!('access-control-allow-origin' in result.headers),'foreign origin no CORS');
  eq((await api.OPTIONS(req('https://localhost'))).status,204,'native OPTIONS');
  eq((await api.OPTIONS(req('https://evil.example'))).status,403,'foreign OPTIONS refused');
  const ui=read('app/mais/acompanhamento/ponte/page.tsx');
  for(const marker of ['isSuperadminUid','getIdToken','cache:\'no-store\'','formatGate4HandoffForSite','TrackingGate4Handoff','onClick={()=>void inspect()}',"credentials:'omit'"])
    ok(ui.includes(marker),'UI owner-only/no-polling marker '+marker);
  const forbiddenInPage=['localStorage.setItem','sessionStorage.setItem','setInterval','setTimeout','issueGrant(','window.location.hash'];
  for(const marker of forbiddenInPage)ok(!ui.includes(marker),'no active public behavior '+marker);
  const route=read('app/api/integration/tracking/v1/admin/handoff/route.ts');
  for(const forbidden of ['adminDb','collection(','.set(','.create(','getFirestore','console.log','JSON.stringify(process.env)'])
    ok(!route.includes(forbidden),'no datastore mutation/secret logging '+forbidden);
  const pre=read('scripts/pre-apk.cjs');
  ok(pre.includes('scripts/test-r253-site-bridge.cjs'),'PRE-APK registered');
  console.log(`R253_SITE_BRIDGE_APROVADO: ${tests} verificações locais; ZERO rede, ZERO Firestore real, ZERO WhatsApp.`);
})().catch(e=>{console.error('R253_GATE4_BLOQUEADO',e);process.exitCode=1});
