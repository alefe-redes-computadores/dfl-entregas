/* DFL R251 Gate2 — synthetic scenarios, runtime privacy, server-only certificate. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const ts=require('typescript');
const read=p=>fs.readFileSync(path.resolve(p),'utf8');
let checks=0;
const ok=(v,label)=>{assert.ok(v,label);checks++;};
const eq=(a,b,label)=>{assert.deepStrictEqual(a,b,label);checks++;};
function transpile(p,deps={}){
  const compiled=ts.transpileModule(read(p),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  const requireLocal=key=>Object.hasOwn(deps,key)?deps[key]:require(key);
  new Function('require','module','exports',compiled)(requireLocal,module,module.exports);
  return module.exports;
}
const core=transpile('lib/tracking/gate1/core.ts');
const lab=transpile('lib/tracking/gate2/laboratory.ts',{'../gate1/core':core});
const cert=transpile('lib/tracking/gate2/certification.ts',{'../gate1/core':core});
const cases=lab.TRACKING_LAB_CASES;
ok(Array.isArray(cases)&&cases.length>=12,'large laboratory scenario matrix');
ok(lab.laboratoryReport().all_valid,'every scenario has a valid public projection');
eq(lab.laboratoryReport().real_messaging,false,'no real messaging');
eq(lab.laboratoryReport().public_access_enabled,false,'no public links');
const unique=new Set(cases.map(c=>c.id));eq(unique.size,cases.length,'all scenario identities unique');
for(const item of cases){
  ok(core.validatePublicProjection(item.projection),`${item.id} strictly valid`);
  eq(item.projection.status,item.expected_status,`${item.id} expected status`);
  eq(Boolean(item.projection.progress),item.expect_progress,`${item.id} progress`);
  eq(item.projection.terminal,item.expect_terminal,`${item.id} terminal`);
  const json=JSON.stringify(item.projection);
  for(const secret of ['ENDERECO-FICTICIO','LOCAL-FICTICIO','FICTICIO','00000000000','payment_method','customer_name','actor_uid','tenant_id','route_id','opaque_token','scope_handle','value']){
    ok(!json.includes(secret),`${item.id} no private marker ${secret}`);
  }
}
const pick=id=>cases.find(c=>c.id===id).projection;
eq(pick('received').status,'received','received must not be accepted');
eq(pick('scheduled').status,'scheduled','scheduled not accepted');
eq(pick('preparing').status,'preparing','preparing commercial');
eq(pick('assigned').status,'assigned','assignment not dispatch');
eq(pick('assigned').progress,null,'no route before departure');
eq(pick('departed').status,'out_for_delivery','route start evidence');
eq(pick('departed').progress.current_stop_number,null,'current position never guessed');
ok(pick('grouped').progress.total_physical_stops===3,'multiple deliveries at same address count one physical stop');
eq(pick('reordered').progress,null,'reorder hides stale position');
eq(pick('reconciling').progress,null,'reconciliation hides uncertain position');
eq(pick('delivered').terminal,true,'individual completion terminal');
eq(pick('cancelled').terminal,true,'cancel terminal');
eq(pick('stale').freshness,'stale','old event stale');
eq(pick('incident').status,'delivery_issue','failed attempt not delivered');
eq(pick('pickup').progress,null,'pickup no route');
const clone=v=>JSON.parse(JSON.stringify(v));
const base=pick('departed');
function reject(label,modify){const altered=clone(base);modify(altered);ok(!core.validatePublicProjection(altered),'reject '+label);}
reject('unknown root financial field',p=>{p.payment_amount=99;});
reject('unknown root token',p=>{p.opaque_token='abc';});
reject('nested order address',p=>{p.order.address='secret';});
reject('nested order financial',p=>{p.order.value=125;});
reject('invalid status',p=>{p.status='unknown';});
reject('reorganized as status',p=>{p.status='reorganized';});
reject('fake terminal',p=>{p.terminal=true;});
reject('invalid date',p=>{p.as_of='tomorrow';});
reject('unauthorized freshness',p=>{p.freshness='live';});
reject('unknown courier field',p=>{p.courier={first_name:'Ana',phone:'123'};});
reject('empty courier',p=>{p.courier={first_name:''};});
reject('unknown event field',p=>{p.timeline[0].actor_uid='internal';});
reject('event timestamp invalid',p=>{p.timeline[0].at='invalid';});
reject('duplicate event',p=>{p.timeline.push({...p.timeline[0]});});
reject('timeline title spoof',p=>{p.timeline[0].title='Entregue';});
reject('additional progress ETA',p=>{p.progress.eta_minutes=3;});
reject('additional progress GPS',p=>{p.progress.latitude=0;});
reject('invalid stop total',p=>{p.progress.total_physical_stops=0;});
reject('invalid current stop',p=>{p.progress.current_stop_number=999;});
reject('invalid planned stop',p=>{p.progress.planned_customer_stop_number=999;});
reject('invalid next stop',p=>{p.progress.is_next_stop=!p.progress.is_next_stop;});
reject('stale progress',p=>{p.freshness='stale';});
reject('wrong state progress',p=>{p.status='received';});
const fake={
  contract:'dfl.tracking.admin.inspection',version:1,
  delivery:{canonical_order_key:'site:LAB0001',public_label:'#LAB0001',origin:'site',state:'preparing',fulfillment:'delivery'},
  readiness:{level:'needs_attention',signals:[],source:'confirmed_server_snapshot',last_confirmed_at:base.as_of},
  gate:{code_enabled:false,customer_access_certified:false,mode:'OFF',kill_switch:true,public_tracking:false,origin_eligible:false,site_connected:false,real_notifications:false},
  public_projection:base, events:[{id:'evt1',kind:'received',at:base.as_of,source:'dfl_site'}],
};
const certificate=cert.certifyInspection(fake);
eq(certificate.contract,'dfl.tracking.gate2.certificate','certificate identity');
eq(certificate.source,'confirmed_server_snapshot','no local fake source');
eq(certificate.public_activated,false,'no public access in certificate');
eq(certificate.messages_sent,false,'no real messages in certificate');
eq(certificate.evidence_count,1,'one evidence');
ok(certificate.public_projection_valid,'strict projection passes');
eq(certificate.checks.length,5,'contracts A-E covered');
eq(certificate.checks.map(c=>c.id).join(''),'ABCDE','A-E order');
eq(certificate.checks[2].status,'off','token/session are not certified');
eq(certificate.checks[3].status,'off','messaging is not certified');
const blocked=cert.certifyInspection({...fake,readiness:{...fake.readiness,signals:[{code:'NOT_ACCEPTED',severity:'blocker',label:'not accepted'}]}});
eq(blocked.operational_review,'blocked','blocked commercial authorization');
const invalid=cert.certifyInspection({...fake,public_projection:{...base,phone:'123'}});
eq(invalid.public_projection_valid,false,'certificate respects privacy guard');
const route=read('app/api/integration/tracking/v1/admin/certify/route.ts');
ok(route.includes('authorizedOwner(request)'),'admin auth before reads');
ok(route.indexOf('authorizedOwner(request)')<route.indexOf('inspectConfirmedOwnerDelivery(id)'),'no unauthenticated Firestore read');
ok(route.includes("runtime='nodejs'")&&route.includes("dynamic='force-dynamic'"),'non-static certificate');
ok(route.includes('no-store'),'no cache of private certificate');
ok(route.includes('ownerNativeCors'),'native cors restricted');
ok(!route.includes('export async function POST'),'read-only route');
const app=read('app/mais/acompanhamento/page.tsx');
ok(app.includes('/mais/acompanhamento/laboratorio'),'lab accessible from owner central');
ok(app.includes('/admin/certify?delivery_id='),'certification uses authorized server API');
ok(app.includes('TrackingGate2Certificate'),'certificate rendered');
const labPage=read('app/mais/acompanhamento/laboratorio/page.tsx');
ok(labPage.includes('isSuperadminUid'),'lab UI only owner');
ok(!labPage.includes('adminDb')&&!labPage.includes('fetch('),'lab does not query or write');
const labSource=read('lib/tracking/gate2/laboratory.ts');
ok(!labSource.includes('adminDb')&&!labSource.includes('fetch(')&&!labSource.includes('localStorage'),'pure laboratory');
const prep=read('scripts/pre-apk.cjs');
ok(prep.includes("'scripts/test-r251-gate2.cjs'"),'registered in PRE-APK');
const schema=JSON.parse(read('contracts/tracking/v1/schemas/B-public-projection.v1.schema.json'));
eq(schema.properties.contract.const,base.contract,'public schema contract');
eq(schema.properties.version.const,base.version,'public schema version');
console.log(`R251_GATE2_APROVADO: ${checks} verificações (14 cenários, privacidade estrita, A-E, Site, Android e OFF).`);
