'use strict';
/** R71: signed commercial evidence wins over route staging; read-only timeline. */
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),crypto=require('node:crypto');
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++};const equal=(a,b,m)=>{assert.equal(a,b,m);n++};
const file=p=>fs.readFileSync(p,'utf8');
function transpile(path){const text=file(path),ast=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);equal(ast.parseDiagnostics.length,0,'AST '+path);return ts.transpileModule(text,{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText}
function load(path,imports){const m={exports:{}};new Function('require','module','exports',transpile(path))(p=>{if(Object.hasOwn(imports,p))return imports[p];throw Error('unexpected module '+p)},m,m.exports);return m.exports}
const core=load('lib/tracking/gate1/core.ts',{});
const now=Date.now(),at=t=>new Date(now-t*60000).toISOString();
const siteId='98BE412C',deliveryId='dfl-12345678-1234-1234-1234-123456789abc',routeId='route_R71';
let delivery={id:deliveryId,tenant_id:'tenant71',source_system:'dfl_site',origin:'loja',external_order_id:siteId,created_at:at(15),completed:false,fulfillment_mode:'delivery',route_id:routeId,site_order_status:'Em Produção',site_order_status_updated_at:at(3),site_order_last_event_id:'evt-prep-000001',site_order_last_event_at:at(3),site_order_timeline:[{event_id:'evt-acc-000001',status:'Aceito',occurred_at:at(10)},{event_id:'evt-prep-000001',status:'Em Produção',occurred_at:at(3)}]};
let route={id:routeId,status:'aberta'};
const stored={id:'old-received',event_id:'old-received',kind:'received',at:at(15),source:'dfl_site',actor_uid:null,revision:1,causation_id:null};
let writes=0;
const db={collection:name=>{
 if(name==='deliveries')return {doc:id=>({get:async()=>({exists:id===deliveryId,data:()=>delivery})}),where:()=>({limit:()=>({get:async()=>({size:1,docs:[{data:()=>delivery,id:deliveryId}]})})})};
 if(name==='routes')return {doc:id=>({get:async()=>({id,exists:id===routeId,data:()=>route})})};
 if(name==='tracking_event_ledgers_v1')return {doc:()=>({collection:()=>({orderBy:()=>({limit:()=>({get:async()=>({docs:[{data:()=>stored}]})})})})})};
 throw Error('unexpected Firestore collection '+name);
},runTransaction:async()=>{writes++;throw Error('public reader must not write')}};
const storage=load('lib/tracking/gate1/storage.ts',{
 'server-only':{},'@/lib/integration/server/admin':{adminDb:db},'./core':core,
 './security':{hexSha256:v=>crypto.createHash('sha256').update(v).digest('hex'),randomSecret:()=>{throw Error('no grant')},trackingCustomerEnabled:()=>true,trackingTenant:()=> 'tenant71',trackingCodeEnabled:()=>true},
});
const c={tenant:'tenant71',mode:'AUTOMATIC_CERTIFIED',kill_switch:false,public_tracking:true,issue_tracking_link:true,eligible_origins:['dfl_site'],show_courier:false,show_position:false,event_modes:{}};
const grant={tenant_id:c.tenant,delivery_id:deliveryId,order_key:`site:${siteId}`,status:'active'};
(async()=>{
 let projection=await storage.publicForAuthorizedGrant(grant,c);
 ok(projection!==null,'existing authenticated grant works');
 equal(projection.status,'preparing','preparing cannot be hidden behind route preallocation');
 ok(projection.timeline.some(x=>x.kind==='preparing'&&x.at===at(3)),'confirmed preparation appears in timeline');
 ok(projection.timeline.some(x=>x.kind==='confirmed'),'confirmed acceptance comes from signed timeline');
 equal(projection.progress,null,'no route progress fabricated');
 equal(writes,0,'public status never writes Firestore');
 ok(!JSON.stringify(projection).includes('evt-prep-000001'),'source id never leaks');
 delivery={...delivery,site_order_timeline:[]};
 projection=await storage.publicForAuthorizedGrant(grant,c);
 ok(projection.timeline.some(x=>x.kind==='preparing'),'verified status + event id fallback visible');
 delivery={...delivery,site_order_status:'Pendente',site_order_last_event_id:'',site_order_status_updated_at:null,site_order_timeline:[]};
 projection=await storage.publicForAuthorizedGrant(grant,c);
 ok(!projection.timeline.some(x=>x.kind==='preparing'),'no commercial evidence creates no fake preparation');
 equal(projection.status,'assigned','original route staging still valid without commercial update');
 route={...route,started_at:at(1)};
 projection=await storage.publicForAuthorizedGrant(grant,c);
 equal(projection.status,'out_for_delivery','only real route start dispatches');
 delivery={...delivery,site_order_status:'Cancelado'};
 projection=await storage.publicForAuthorizedGrant(grant,c);
 equal(projection.status,'cancelled','cancelled remains highest priority');
 console.log(`R71 ENTREGAS: ${n} contratos de sincronização e integridade herméticos; ZERO rede/Firestore real.`);
})().catch(e=>{console.error(e);process.exitCode=1});
