#!/usr/bin/env node
'use strict';
/** R70 Entregas: consent, owner handoff, once-only reservation, uncertainty. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto');
let n=0;const ok=(b,msg)=>{assert.ok(b,'R70 ENT '+msg);n++};
const file='lib/tracking/manualTrackingAuto.ts';
const src=fs.readFileSync(file,'utf8');
const route=fs.readFileSync('app/api/integration/manual-tracking/route.ts','utf8');
const manual=fs.readFileSync('app/api/integration/manual-messaging/route.ts','utf8');
const ui=fs.readFileSync('app/mais/acompanhamento/page.tsx','utf8');
for(const path of [file,'app/api/integration/manual-tracking/route.ts','app/api/integration/manual-messaging/route.ts','app/mais/acompanhamento/page.tsx']){
 const ast=ts.createSourceFile(path,fs.readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'AST '+path);
}
ok(src.includes('.create({tenant_id:')&&src.includes("state:'reserved'"),'durable reservation before issue');
ok(src.indexOf("state:'reserved'")<src.indexOf('const issued=await issueGrant'),'reserve before issue');
ok(src.indexOf("await settle('issued_pending_provider'")<src.indexOf('outcome=await fetch('),'receipt before sending');
ok(!/console\.|localStorage|sessionStorage/.test(src),'no logging token/phone');
ok(manual.includes('sendManualTrackingInitial(data.deliveryId,ownerUid)'),'existing save kick now triggers automatic link');
ok(manual.includes('tracking_status:tracking.status'),'legacy message response preserved');
ok(ui.includes('Conferir envio')&&ui.includes('não repita automaticamente'),'safe owner UI');
ok(route.includes('inspectManualTracking(id)')&&!route.includes('sendManualTrackingInitial'),'read-only GET');
const js=ts.transpileModule(src,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const deliveryId='dfl-12345678-1234-1234-1234-123456789abc';
let sent=0,grants=0,accepts=0;let fakeDelivery={id:deliveryId,origin:'loja',notify_whatsapp:true,manual_messaging_opt_in_v1:true,phone:'(34) 99999-9999',customer_name:'Ficticio',fulfillment_mode:'delivery',created_at:new Date().toISOString(),completed:false};
const docs=new Map();let env={...process.env,
 DFL_MANUAL_MESSAGING_ENABLED:'true',DFL_MANUAL_MESSAGING_KILL_SWITCH:'false',DFL_MANUAL_MESSAGING_SCOPE:'consented_customers',DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED:'true',DFL_MANUAL_MESSAGING_ACTIVATED_AT:new Date(Date.now()-60000).toISOString(),
 DFL_TRACKING_GATE1_ACTIVE:'1',DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED:'1',DFL_SITE_INTEGRATION_URL:'https://dafamilialanches.com.br',DFL_INTEGRATION_SIGNING_SECRET:'test-only-secret-long-enough-hmac'};
const db={collection:()=>({doc:id=>({
 async create(value){if(docs.has(id))throw Error('already_exists');docs.set(id,{...value});},
 async update(patch){if(!docs.has(id))throw Error('not_exists');docs.set(id,{...docs.get(id),...patch});},
 async get(){const item=docs.get(id);return {exists:!!item,data:()=>item};},
 })})};
const mocked={
 'server-only':{}, 'node:crypto':crypto,
 '@/lib/integration/server/admin':{adminDb:db},
 '@/lib/integration/manualMessagingPolicy':{planManualMessage:({delivery})=>delivery.notify_whatsapp===true&&delivery.manual_messaging_opt_in_v1===true&&delivery.origin==='loja'&&delivery.completed!==true?{eligible:true,phone:'5534999999999'}:{eligible:false,reason:'not_eligible'}},
 '@/lib/tracking/gate1/core':{canonicalOrderKey:d=>`entregas:${d.id}`,mayIssueNewTrackingGrant:d=>d.completed!==true},
 '@/lib/tracking/gate1/storage':{
   capabilities:async()=>({tenant:'tenant',mode:'AUTOMATIC_CERTIFIED',kill_switch:false,public_tracking:true,issue_tracking_link:true,eligible_origins:['manual']}),
   belongsToTenant:()=>true,canAccessCustomer:()=>true,
   confirmedDelivery:async id=>({data:{...fakeDelivery,id}}),
   confirmInternalDelivery:async()=>{accepts++;return {state:'confirmed'};},
   issueGrant:async()=>{grants++;return {state:'issued',grant_id:'a'.repeat(64),token:'b'.repeat(43),expires_at:new Date(Date.now()+90*60000).toISOString()};},
 },
};
function load(){const m={exports:{}};new Function('require','module','exports',js)(id=>{if(id in mocked)return mocked[id];throw Error('unexpected module '+id)},m,m.exports);return m.exports;}
const x=load();const prev=process.env;
(async()=>{
 process.env={...env,DFL_MANUAL_MESSAGING_ENABLED:'false'};
 let state=await x.sendManualTrackingInitial(deliveryId,'owner');ok(state.status==='off','OFF no side effects');ok(grants===0,'OFF no grant');
 process.env=env;
 const originalFetch=global.fetch;
 global.fetch=async(url,opts)=>{sent++;ok(url==='https://dafamilialanches.com.br/api/integration/manual-tracking','trusted site only');
  const b=JSON.parse(opts.body);ok(b.tracking_link.includes('#t='),'ephemeral token only on wire');
  ok(opts.headers['x-dfl-signature']===crypto.createHmac('sha256',env.DFL_INTEGRATION_SIGNING_SECRET).update(`${opts.headers['x-dfl-timestamp']}.${opts.body}`).digest('hex'),'HMAC');
  return {ok:true,text:async()=>JSON.stringify({contract:'dfl.tracking.manual.handoff.v1',version:1,ok:true,result:'accepted_by_provider',provider_event_id:'provider-123456789',customer_delivery_confirmed:false})};};
 try{
  state=await x.sendManualTrackingInitial(deliveryId,'owner');ok(state.status==='provider_accepted','accepted is not delivered');
  ok(grants===1&&accepts===1&&sent===1,'exact one grant, acceptance and provider');
  ok(!JSON.stringify([...docs.values()]).includes('bbbb')&&!JSON.stringify([...docs.values()]).includes('5534'),'no token/phone persisted');
  state=await x.sendManualTrackingInitial(deliveryId,'owner');ok(state.status==='duplicate','duplicate blocked');ok(grants===1&&sent===1,'no automatic resend');
  const report=await x.inspectManualTracking(deliveryId);ok(report.status==='provider_accepted','owner read-only status');
  fakeDelivery={...fakeDelivery,notify_whatsapp:false};const noOpt=await x.sendManualTrackingInitial('dfl-ABCD123456789012345678','owner');ok(noOpt.status==='skipped','opt-out denied');ok(sent===1,'opt-out no provider');
  console.log(`R70 ENTREGAS: ${n} verificações herméticas OK; zero rede real, Firestore e WhatsApp.`);
 }finally{global.fetch=originalFetch;}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{process.env=prev});
