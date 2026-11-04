/* DFL Gate1 R249 — pure + mocked backend contract/security regression. NO Firebase/network/messages. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = process.cwd();
const read = name => fs.readFileSync(path.join(root,name),'utf8');
let tests=0;function ok(cond,msg){assert.ok(cond,msg);tests++;}
function eq(a,b,msg){assert.deepStrictEqual(a,b,msg);tests++;}
function loaded(name,mocks={}) {
  const js=ts.transpileModule(read(name),{fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  const mod={exports:{}};
  const localReq=x => { if(x==='server-only')return {};if(Object.hasOwn(mocks,x))return mocks[x];return require(x);};
  new Function('require','module','exports',js)(localReq,mod,mod.exports);
  return mod.exports;
}
const core=loaded('lib/tracking/gate1/core.ts');
ok(core.TRACKING_PUBLIC_CONTRACT==='dfl.tracking.public','nome contrato');
eq(core.commercialState('Pendente'),'received','pendente não aceito');
eq(core.commercialState('Agendado'),'scheduled','agendado sem aceite');
eq(core.commercialState('Em Produção'),'preparing','produção confirmada');
eq(core.commercialState('Saiu para Entrega'),null,'status comercial não despacha');
eq(core.commercialState('Finalizado'),null,'status comercial não conclui');
eq(core.commercialState('Cancelado'),'cancelled','cancelamento');
eq(core.iso('2026-11-04T21:10:00-03:00'),'2026-11-05T00:10:00.000Z','timezone');
eq(core.iso('valor inválido'),null,'data inválida');
const now=Date.now(),created=new Date(now-60*60*1000).toISOString(),started=new Date(now-5*60*1000).toISOString();
const delivery={id:'delivery100',origin:'loja',source_system:'dfl_entregas',created_at:created,route_id:'rota1',order_index:3,customer_name:'NÃO EXPOR',phone:'34999999999',value:200,payment_method:'pix',address_string:'RUA PRIVADA 123',completed:false};
const route={id:'rota1',status:'aberta',started_at:started,motoboy_name:'Bruno da Silva',updated_at:created};
const other1={id:'d1',route_id:'rota1',order_index:1,completed:true,address_string:'RUA OUTRA',value:99};
const other2={id:'d2',route_id:'rota1',order_index:2,completed:true,address_string:'RUA OUTRA',value:88};
const other3={id:'d3',route_id:'rota1',order_index:4,completed:false,address_string:'RUA TERCEIROS',phone:'11111'};
const event={id:'evt1',event_id:'evt1',kind:'received',at:created,actor_uid:null,source:'dfl_entregas',revision:1,causation_id:null};
const make=(extra={})=>core.projectPublicTracking({delivery,route,routeDeliveries:[other1,other2,delivery,other3],ledgerEvents:[event,event],confirmedAt:started,now,showCourier:true,showPosition:true,...extra});
const pub=make();
eq(pub.status,'out_for_delivery','roteiro inicia apenas com início persistido');
eq(pub.progress.total_physical_stops,3,'agrupar dois pedidos no mesmo endereço');
eq(pub.progress.planned_customer_stop_number,2,'parada prevista é 2/3');
eq(pub.progress.current_stop_number,null,'sem chegada confirmada não fingir posição atual');
eq(pub.progress.stops_ahead,0,'pendências antes calculadas por paradas');
eq(pub.timeline.length,1,'evento duplicado deduplicado');
ok(core.validatePublicProjection(pub),'projeção valida');
const pubJson=JSON.stringify(pub);for(const privateField of ['RUA PRIVADA','RUA TERCEIROS','34999999999','payment_method','actor_uid','route_id','value','phone']) ok(!pubJson.includes(privateField),'sem dados privados: '+privateField);
eq(make({reconciling:true}).progress,null,'reconciliação inibe números');
eq(make({now:now+45*60_000}).progress,null,'stale oculta posição');
eq(make({route:{...route,updated_at:new Date(now-1_000).toISOString()}}).progress,null,'reordenação recente oculta posição');
eq(make({route:{...route,status:'fechada'}}).progress,null,'rota encerrada não apresenta progresso');
eq(make({route:{...route,route_revision:5},delivery:{...delivery,route_revision:4}}).progress,null,'revisão divergiu e progresso fica oculto');
eq(make({delivery:{...delivery,completed:true,completed_at:new Date(now-2_000).toISOString()}}).status,'delivered','conclusão individual');
eq(make({delivery:{...delivery,site_order_status:'Cancelado'}}).status,'cancelled','cancelamento prioritário');
eq(make({route:null}).status,'received','alocação sem rota não despacha');
eq(make({delivery:{...delivery,route_id:'rota1'},route:{...route,started_at:undefined,departure_time:undefined}}).status,'assigned','alocado não despachado');
eq(make({showCourier:false}).courier,null,'ocultar motoboy');
// Security and backend tests use in-memory Firestore-like emulator, no writes to production.
const records=new Map();
const clone = x => x == null?x:structuredClone(x);
const snap=(id,v) => ({id,exists:v!==undefined,data:()=>clone(v),get:(key)=>v?.[key]});
class Doc {
  constructor(id){this.id=id.split('/').at(-1);this.path=id;}
  async get(){return snap(this.id,records.get(this.path));}
  async create(v){if(records.has(this.path)){const err=new Error('ALREADY_EXISTS');err.code=6;throw err;}records.set(this.path,clone(v));}
  async set(v,opt){records.set(this.path,opt?.merge?{...records.get(this.path),...clone(v)}:clone(v));}
  async update(v){if(!records.has(this.path))throw Error('missing doc');records.set(this.path,{...records.get(this.path),...clone(v)});}
  collection(name){return new Collection(this.id+'/'+name);}
}
class Collection {
  constructor(prefix,filters=[],limitNum=999999,sortBy=null){this.prefix=prefix;this.filters=filters;this.limitNum=limitNum;this.sortBy=sortBy;}
  doc(id){if(!id)throw Error('blank id');return new Doc(this.prefix+'/'+id);}
  where(k,op,v){assert.equal(op,'==');return new Collection(this.prefix,[...this.filters,[k,v]],this.limitNum,this.sortBy);}
  orderBy(k,direction){return new Collection(this.prefix,this.filters,this.limitNum,[k,direction]);}
  limit(num){return new Collection(this.prefix,this.filters,num,this.sortBy);}
  async get(){let xs=[];for(const [key,v] of records){if(!key.startsWith(this.prefix+'/')||key.slice(this.prefix.length+1).includes('/'))continue;if(!this.filters.every(([k,w])=>v[k]===w))continue;xs.push(snap(key.split('/').at(-1),v));}
    if(this.sortBy)xs.sort((a,b)=>{const [k,dir]=this.sortBy;return String(a.data()?.[k]).localeCompare(String(b.data()?.[k]))*(dir==='desc'?-1:1);});
    const docs=xs.slice(0,this.limitNum);return {docs,size:docs.length};}
}
const fakeDb={collection:n=>new Collection(n),runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v)=>r.set(v),update:(r,v)=>r.update(v),create:(r,v)=>r.create(v)})};
const fakeAdmin={adminDb:fakeDb,adminAuth:{verifyIdToken:async t=>({uid:t})}};
const roles={isSuperadminUid:u=>u==='owner'};
process.env.DFL_TRACKING_GATE1_ACTIVE='1';
process.env.DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED='1';
process.env.DFL_TRACKING_TENANT_ID='companyA';
process.env.DFL_TRACKING_LEGACY_TENANT_ID='companyA';
process.env.DFL_TRACKING_S2S_KEYS_JSON=JSON.stringify({sitev1:'A'.repeat(64)});
const security=loaded('lib/tracking/gate1/security.ts',{'@/lib/integration/server/admin':fakeAdmin,'@/lib/access/roles':roles});
const store=loaded('lib/tracking/gate1/storage.ts',{'@/lib/integration/server/admin':fakeAdmin,'./security':security,'./core':core});
ok(security.randomSecret().length===43,'token de 256 bits base64url');
eq(security.trackingTenant(),'companyA','tenant configurado');
ok(security.trackingCodeEnabled(),'flag explícita');
const requestBody=JSON.stringify({contract:'dfl.tracking.access',version:1,action:'status',scope_handle:'x'.repeat(43)});
const timestamp=new Date().toISOString(),nonce='NONCEABCDEFGHIJKLMNOPQRST',key='sitev1',tenant='companyA';
const sig=security.signTrackingRequest({method:'POST',path:'/api/integration/tracking/v1/status',body:requestBody,timestamp,nonce,kid:key,tenant,secret:'A'.repeat(64)});
ok(/^[a-f0-9]{64}$/.test(sig),'assinatura HMAC');
ok(sig!==security.signTrackingRequest({method:'POST',path:'/api/integration/tracking/v1/issue',body:requestBody,timestamp,nonce,kid:key,tenant,secret:'A'.repeat(64)}),'assina método/caminho');
ok(sig!==security.signTrackingRequest({method:'POST',path:'/api/integration/tracking/v1/status',body:requestBody+' ',timestamp,nonce,kid:key,tenant,secret:'A'.repeat(64)}),'assina corpo bruto');
const signedReq={method:'POST',nextUrl:{pathname:'/api/integration/tracking/v1/status'},headers:new Map([
  ['x-dfl-tracking-timestamp',timestamp],['x-dfl-tracking-nonce',nonce],['x-dfl-tracking-kid',key],['x-dfl-tracking-signature',sig]])};
const work=async()=>{
 eq(await security.verifyTrackingSiteRequest(signedReq,requestBody),'ok','requisição autentica');
 eq(await security.verifyTrackingSiteRequest(signedReq,requestBody),'replay','nonce idempotente');
 eq(await security.verifyTrackingSiteRequest({...signedReq,headers:new Map([...signedReq.headers].map(([k,v])=>[k,k==='x-dfl-tracking-signature'?'0'.repeat(64):v]))},requestBody),'invalid','assinatura inválida');
 records.set('tracking_capabilities_v1/companyA',{mode:'MANUAL',kill_switch:false,public_tracking:true,issue_tracking_link:true,show_courier:true,show_position:true,eligible_origins:['manual']});
 const cap=await store.capabilities();ok(store.canAccessCustomer(cap),'modo manual certificado');
 records.set('deliveries/delivery100',clone(delivery));
 records.set('routes/rota1',clone(route));
 records.set('deliveries/d1',clone(other1));records.set('deliveries/d2',clone(other2));records.set('deliveries/d3',clone(other3));
 eq(await store.hasCommercialAcceptance('companyA',delivery),false,'manual sem confirmação');
 const confirmed=await store.confirmInternalDelivery({tenant:'companyA',deliveryId:'delivery100',actorUid:'owner',idempotencyKey:'test-accept-001'});
 eq(confirmed.state,'confirmed','aceite manual transacional');

 eq(await store.hasCommercialAcceptance('companyA',delivery),true,'confirmado persistido');
 const again=await store.confirmInternalDelivery({tenant:'companyA',deliveryId:'delivery100',actorUid:'owner',idempotencyKey:'test-accept-001'});
 eq(again.state,'already_processed','aceite idempotente');
 const sync=await store.reconcileConfirmedEvents('companyA','delivery100');eq(sync.added,0,'reconciliação sem duplicação');
 const audits=[...records.entries()].filter(([id])=>id.includes('/events/')).map(([,raw])=>raw.operational_event);
 ok(audits.length>=2,'eventos persistidos com envelope A');
 const aschema=JSON.parse(read('contracts/tracking/v1/schemas/A-operational-event.v1.schema.json'));
 for (const row of audits) {
   ok(row.contract==='dfl.operational_event' && row.version===1,'identidade de evento A');
   ok(aschema.required.every(key=>Object.hasOwn(row,key)),'campos A obrigatórios');
   ok(aschema.properties.event_type.enum.includes(row.event_type),'tipo A conhecido');
   ok(row.actor_id && row.transition_id && row.revision>0,'autoria, identidade, revisão');
 }
 if(process.env.DFL_GATE1_LOCAL_SCHEMA_SAMPLES)fs.writeFileSync(process.env.DFL_GATE1_LOCAL_SCHEMA_SAMPLES,JSON.stringify(audits,null,2));
 const issued=await store.issueGrant({tenant:'companyA',deliveryId:'delivery100',actorUid:'owner',idempotencyKey:'issue-00001',ttlMinutes:120,c:cap});
 eq(issued.state,'issued','grant emitido');ok(typeof issued.token==='string'&&issued.token.length===43,'token uma vez');
 const duplicate=await store.issueGrant({tenant:'companyA',deliveryId:'delivery100',actorUid:'owner',idempotencyKey:'issue-00001',ttlMinutes:120,c:cap});
 eq(duplicate.state,'already_active','grant único');ok(!duplicate.token,'não reexibe token');
 const scope=await store.exchangeToken('companyA',issued.token);ok(scope&&scope.session_token,'scope restrito');
 const projection=await store.querySession('companyA',scope.session_token,cap);ok(projection,'sessão autoriza consulta');ok(core.validatePublicProjection(projection),'projeção real tipo B');
 const revoked=await store.revokeGrant({tenant:'companyA',grantId:issued.grant_id,actorUid:'owner',reason:'cancelamento',idempotencyKey:'rev-00101'});
 eq(revoked.state,'revoked','grant revogado');
 eq(await store.querySession('companyA',scope.session_token,cap),null,'sessão emitida perde acesso imediatamente');
 eq(await store.exchangeToken('companyA',issued.token),null,'token revogado não troca');
 const revoked2=await store.revokeGrant({tenant:'companyA',grantId:issued.grant_id,actorUid:'owner',reason:'cancelamento',idempotencyKey:'rev-00101'});
 eq(revoked2.already_revoked,true,'revogação idempotente');
 process.env.DFL_TRACKING_LEGACY_TENANT_ID='otherCompany';
 eq(store.belongsToTenant(delivery,'companyA'),false,'isolamento empresa legado');
 process.env.DFL_TRACKING_LEGACY_TENANT_ID='companyA';
 records.set('tracking_capabilities_v1/companyA',{mode:'OFF',kill_switch:true,public_tracking:false});
 const capOff=await store.capabilities();eq(store.canAccessCustomer(capOff),false,'modo OFF fail closed');
 // Full signed Site <-> Entregas HTTP flow, mocked Firestore and admin login.
 records.set('tracking_capabilities_v1/companyA',{mode:'MANUAL',kill_switch:false,public_tracking:true,issue_tracking_link:true,show_courier:true,show_position:true,eligible_origins:['manual']});
 const http=loaded('lib/tracking/gate1/http.ts',{
   '@lib/unused':{}, './security':security, './storage':store, './core':core,
   'next/server':{NextResponse:{json:(body,init={})=>({status:init.status||200,body,headers:init.headers})}},
 });
 const req=(path,v,auth)=>({method:'POST',nextUrl:{pathname:path},headers:new Map(auth?[['authorization',auth]]:[]),text:async()=>JSON.stringify(v)});
 const id2='delivery200',d2={...delivery,id:id2,route_id:'',order_index:0};
 records.set('deliveries/'+id2,clone(d2));
 const iBody={contract:'dfl.tracking.access',version:1,action:'issue',order:{canonical_order_key:'entregas:'+id2,origin:'manual'},idempotency_key:'issued-for-delivery200',requested_ttl_minutes:120};
 eq((await http.issue(req('/api/integration/tracking/v1/issue',iBody,'Bearer user'))).status,403,'não proprietário bloqueado');
 eq((await http.issue(req('/api/integration/tracking/v1/issue',iBody,'Bearer owner'))).status,404,'sem aceite não emite link');
 const approve={contract:'dfl.tracking.confirm',version:1,delivery_id:id2,idempotency_key:'accept-delivery200'};
 eq((await http.confirm(req('/api/integration/tracking/v1/confirm',approve,'Bearer owner'))).status,201,'aceite via endpoint administrativo');
 const issueReply=await http.issue(req('/api/integration/tracking/v1/issue',iBody,'Bearer owner'));
 eq(issueReply.status,201,'emissão API aceita após confirmação');
 ok(issueReply.body.opaque_token && issueReply.body.status==='issued','response issue C');
 eq((await http.issue(req('/api/integration/tracking/v1/issue',iBody,'Bearer owner'))).status,409,'API idempotência sem reexibir token');
 function siteReq(action,payload,suffix) {
   const path='/api/integration/tracking/v1/'+action;
   const raw=JSON.stringify(payload),nonce='test-nonce-0123456789-'+suffix;
   const timestamp=new Date().toISOString();
   const signature=security.signTrackingRequest({method:'POST',path,body:raw,timestamp,nonce,kid:'sitev1',tenant:'companyA',secret:'A'.repeat(64)});
   return {method:'POST',nextUrl:{pathname:path},text:async()=>raw,
     headers:new Map([['x-dfl-tracking-timestamp',timestamp],['x-dfl-tracking-nonce',nonce],['x-dfl-tracking-kid','sitev1'],['x-dfl-tracking-signature',signature]])};
 }
 const exchangeReq={contract:'dfl.tracking.access',version:1,action:'exchange',opaque_token:issueReply.body.opaque_token};
 const exchangeReply=await http.authorize(siteReq('authorize',exchangeReq,'exchange1'));
 eq(exchangeReply.status,200,'token Site trocado por scope');
 ok(exchangeReply.body.authorized===true && exchangeReply.body.scope_handle,'response grant C');
 const statusReq={contract:'dfl.tracking.access',version:1,action:'status',scope_handle:exchangeReply.body.scope_handle};
 const statusReply=await http.status(siteReq('status',statusReq,'status1'));
 eq(statusReply.status,200,'consulta Site com HMAC');
 ok(core.validatePublicProjection(statusReply.body),'response B validado');
 const sLeak=JSON.stringify(statusReply.body);ok(!sLeak.includes('payment_method')&&!sLeak.includes('address_string'),'sem segredo operacional');
 const switched=await http.status(siteReq('status',{...statusReq,order_id:'delivery100'},'status2'));
 eq(switched.status,422,'escopo não pode ser alterado por body');
 const reason={contract:'dfl.tracking.access',version:1,action:'revoke',grant_id:issueReply.body.grant_id,reason:'admin_action',idempotency_key:'revoke-delivery200'};
 const revokedReply=await http.revoke(req('/api/integration/tracking/v1/revoke',reason,'Bearer owner'));
 eq(revokedReply.status,200,'revogação API');
 ok(revokedReply.body.revoked && revokedReply.body.revoked_at,'response revoke C');
 eq((await http.status(siteReq('status',statusReq,'status3'))).status,404,'cookie Site perde sessão ativa após revogação');
 eq((await http.authorize(siteReq('authorize',exchangeReq,'exchange2'))).status,404,'link revogado não abre nova sessão');
 const strictSchemas=[
   ['C-issue-response.v1.schema.json',issueReply.body],
   ['C-access-grant.v1.schema.json',exchangeReply.body],
   ['C-revoke-response.v1.schema.json',revokedReply.body],
   ['B-public-projection.v1.schema.json',statusReply.body],
 ];
 for(const [filename,object] of strictSchemas){
   const schema=JSON.parse(read('contracts/tracking/v1/schemas/'+filename));
   ok(Object.keys(object).every(k=>Object.prototype.hasOwnProperty.call(schema.properties,k)),'sem campo extra '+filename);
   ok(schema.required.every(k=>Object.prototype.hasOwnProperty.call(object,k)),'campos requeridos '+filename);
 }
 if(process.env.DFL_GATE1_LOCAL_RESPONSE_SAMPLES)fs.writeFileSync(process.env.DFL_GATE1_LOCAL_RESPONSE_SAMPLES,JSON.stringify(Object.fromEntries(strictSchemas),null,2));

 process.env.DFL_TRACKING_GATE1_ACTIVE='0';ok(!security.trackingCodeEnabled(),'código inativo sem env');
 // Static and contract checks.
 for(const route of ['authorize','status','issue','revoke','sync','confirm']) {
   const p=`app/api/integration/tracking/v1/${route}/route.ts`;
   ok(read(p).includes("runtime = 'nodejs'")&&read(p).includes(`return ${route}(request)`),`rota ${route}`);
 }
 const schema=JSON.parse(read('contracts/tracking/v1/schemas/B-public-projection.v1.schema.json'));
 eq(schema.properties.contract.const,'dfl.tracking.public','schema B identidade');
 const specs=fs.readdirSync('contracts/tracking/v1/schemas').filter(x=>x.endsWith('.json'));
 eq(specs.length,11,'onze schemas');
 const fixtures=fs.readdirSync('contracts/tracking/v1/fixtures').filter(x=>x.endsWith('.json'));
 eq(fixtures.length,16,'dezesseis fixtures');
 for(const f of [...specs.map(x=>'schemas/'+x),...fixtures.map(x=>'fixtures/'+x)]){
   JSON.parse(read('contracts/tracking/v1/'+f));tests++;
 }
 ok(!fs.readdirSync('lib/tracking/gate1').includes('provider-whatsapp.ts'),'sem transporte real');
 console.log(`R249 Gate1: ${tests} verificações locais OK; zero rede, zero Firestore real, zero WhatsApp.`);
};
work().catch(error=>{console.error('R249 GATE1 BLOQUEADO',error);process.exitCode=1;});
