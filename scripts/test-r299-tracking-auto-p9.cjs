#!/usr/bin/env node
/* DFL R299 P9: hermetic automatic tracking bridge tests; no provider/network/real Firestore. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const crypto=require('node:crypto');
let tests=0;
const ok=(condition,label)=>{assert.ok(condition,'R299 P9 '+label);tests++;};
const equal=(actual,want,label)=>{assert.deepStrictEqual(actual,want,'R299 P9 '+label);tests++;};
const read=p=>fs.readFileSync(p,'utf8');
function load(path,mocks={}){
 const source=read(path),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 equal(ast.parseDiagnostics.length,0,'AST '+path);
 const t=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 ok(!(t.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'transpile '+path);
 const mod={exports:{}};
 new Function('require','module','exports',t.outputText)(name=>{
   if(name==='server-only')return {};
   if(name==='node:crypto')return crypto;
   if(Object.prototype.hasOwnProperty.call(mocks,name))return mocks[name];
   throw Error('R299 P9 import inesperado '+path+' => '+name);
 },mod,mod.exports);
 return mod.exports;
}
const paths={
 policy:'lib/tracking/gate6/auto-policy.ts',server:'lib/tracking/gate6/auto-server.ts',
 security:'lib/tracking/gate1/security.ts',core:'lib/tracking/gate1/core.ts',
 accept:'app/api/integration/tracking/v1/auto/accept/route.ts',
 issue:'app/api/integration/tracking/v1/auto/issue/route.ts',
 receipt:'app/api/integration/tracking/v1/auto/receipt/route.ts',
};
for(const path of Object.values(paths)){
 const source=read(path),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 equal(ast.parseDiagnostics.length,0,'TS/AST '+path);
}
const policy=load(paths.policy);
const now=Date.now(),at=new Date(now-120000).toISOString();
const payload={contract:'dfl.tracking.automatic',version:1,action:'commercial_accept',
 canonical_order_key:'site:ABC88',event_id:'site-R21-accept-ABC88',accepted_at:at,
 idempotency_key:'acceptR21_abcdef123456',recipient_e164:'+5534999999999',
 consent:{channel:'whatsapp',granted:true,granted_at:at,source:'dfl_site'}};
const issue={contract:'dfl.tracking.automatic',version:1,action:'issue_initial',canonical_order_key:'site:ABC88',
 acceptance_event_id:payload.event_id,idempotency_key:'issueInitial_abc123456789',
 recipient_e164:'+5534999999999',requested_ttl_minutes:45};
const receipt={contract:'dfl.tracking.automatic',version:1,action:'provider_receipt',
 canonical_order_key:'site:ABC88',grant_id:'a'.repeat(64),idempotency_key:'receipt_abcdefgh123456',
 provider_event_id:'provider-event-ABC88',result:'delivery_uncertain'};
ok(Boolean(policy.parseSiteAcceptance(payload,now)),'aceite consentido válido');
equal(policy.canonicalE164('55 (34) 99999-9999'),'+5534999999999','telefone BR normalizado');
for(const input of ['11999999999','55349999999999999','+5500999999999','',null,'abc'])equal(policy.canonicalE164(input),null,'telefone inválido sem falsa autorização');
for(const x of [
 {...payload,consent:{...payload.consent,granted:false}},
 {...payload,consent:{...payload.consent,source:'browser'}},
 {...payload,action:'preparing'},
 {...payload,canonical_order_key:'entregas:ABC88'},
 {...payload,accepted_at:new Date(now+3600000).toISOString()},
 {...payload,accepted_at:new Date(now-25*3600000).toISOString()},
 {...payload,unknown:true},
])equal(policy.parseSiteAcceptance(x,now),null,'aceite ilegal recusado');
ok(Boolean(policy.parseSiteIssue(issue)),'emissão inicial válida');
for(const x of [{...issue,requested_ttl_minutes:1440},{...issue,action:'issue_return'},
 {...issue,canonical_order_key:'entregas:ABC88'},{...issue,recipient_e164:'+5531999999999'}]){
 if(x.recipient_e164!==issue.recipient_e164)continue;equal(policy.parseSiteIssue(x),null,'issue não certificado recusado');
}
ok(Boolean(policy.parseSiteReceipt(receipt)),'ACK incerto válido');
equal(policy.parseSiteReceipt({...receipt,result:'customer_delivered'}),null,'ACK não inventa entrega ao cliente');
const cap={mode:'AUTOMATIC_CERTIFIED',kill_switch:false,public_tracking:true,issue_tracking_link:true,eligible_origins:['dfl_site']};
ok(policy.canAutoIssue({configured:true,customerCertified:true,capability:cap}),'capability explícita autoriza apenas política');
for(const x of [{...cap,mode:'MANUAL'},{...cap,kill_switch:true},{...cap,eligible_origins:['manual']},{...cap,public_tracking:false},{...cap,issue_tracking_link:false}])
 equal(policy.canAutoIssue({configured:true,customerCertified:true,capability:x}),false,'capability restrita');
equal(policy.canAutoIssue({configured:false,customerCertified:true,capability:cap}),false,'flag geral OFF');
equal(policy.canAutoIssue({configured:true,customerCertified:false,capability:cap}),false,'sem certificação do cliente');
equal(policy.mayNotifyAfter({candidateAt:at,completed:true}),false,'sem evento pós conclusão');
equal(policy.mayNotifyAfter({candidateAt:at,cancelled:true}),false,'sem evento pós cancelamento');
equal(policy.mayNotifyAfter({candidateAt:at,terminalAt:new Date(now-100000).toISOString()}),false,'evento anterior ao terminal bloqueado');
// A bridge is server-to-server. The actual HMAC verifier, nonce storage, token grants
// and outbox remain in their existing implementation; never mock them in production.
const security=read(paths.security),server=read(paths.server),coreSource=read(paths.core);
ok(security.includes("process.env.DFL_TRACKING_AUTO_S2S_CERTIFIED !== '1'") && security.includes('return verifySignedTrackingRequest(request,rawBody);'),'gate separado reutiliza assinatura e replay existentes');
ok(server.includes("import 'server-only'")&&!server.includes('authorizedOwner')&&!server.includes('verifyIdToken'),'não usa token Firebase do proprietário');
ok(server.includes('canonicalOrderKey')&&server.includes('belongsToTenant')&&server.includes('mayIssueNewTrackingGrant'),'autoridade para pedido, empresa e terminal');
ok(server.includes('recipient_hash')&&server.includes("createHmac('sha256'")&&!server.includes('localStorage'),'identidade do destinatário usa HMAC servidor');
ok(!/fetch\(|navigator\.|sendWhatsApp|notifyManualRoute|DFL_MESSAGING_INGEST_TOKEN/.test(server),'nunca envia ou simula mensagem');
ok(server.includes('issued.state!==\'issued\'')&&server.includes('if(receiptDoc.exists)return conflict()'),'sem reemissão após incerteza');
ok(coreSource.includes("commercial === 'received' && events.some(event => event.kind === 'confirmed')"),'R21 aceito não equivale a Em Preparo');
const memory=new Map();
function ref(id){return {id,async get(){return snapshot(id)},async create(v){if(memory.has(id)){const e=new Error('exists');e.code='6';throw e;}memory.set(id,structuredClone(v));}};}
function snapshot(id){const exists=memory.has(id);return{id:id.split('/').at(-1),exists,data:()=>exists?structuredClone(memory.get(id)):undefined};}
const adminDb={collection(name){return {doc(id){return ref(`${name}/${id}`);}}},async runTransaction(callback){
 return callback({get:async target=>snapshot(target.id),create(target,v){if(memory.has(target.id)){const e=new Error('exists');e.code='6';throw e;}memory.set(target.id,structuredClone(v));},
 update(target,v){if(!memory.has(target.id))throw Error('missing');memory.set(target.id,{...memory.get(target.id),...structuredClone(v)});}});
}};
const core=load(paths.core);
let auth='ok',capability={tenant:'tenant01',...cap},issuedCount=0,reconcileCount=0;
const customer= {id:'delivery-r299-1',source_system:'dfl_site',external_order_id:'ABC88',phone:'+5534999999999',
  tenant_id:'tenant01',site_order_status:'Pendente',site_order_timeline:[],
  created_at:new Date(now-3600000).toISOString(),completed:false,fulfillment_mode:'delivery'};
memory.set('deliveries/delivery-r299-1',customer);
const secrets={trackingCustomerEnabled:()=>true,trackingTenant:()=> 'tenant01',
 verifyTrackingAutomaticRequest:async()=>auth,hexSha256:(x)=>crypto.createHash('sha256').update(x).digest('hex')};
const storage={
 capabilities:async()=>capability,canAccessCustomer:c=>!!c&&c.public_tracking&&c.issue_tracking_link&&!c.kill_switch,
 belongsToTenant:(d,t)=>d.tenant_id===t,
 resolveCanonicalOrder:async k=> k==='site:ABC88'?'delivery-r299-1':null,
 confirmedDelivery:async id=>{const v=memory.get(`deliveries/${id}`);return v?{data:{...v,id},route:null,routeDeliveries:[]}:null;},
 reconcileConfirmedEvents:async(t,id)=>{reconcileCount++;ok(memory.get(`deliveries/${id}`).site_order_timeline.some(x=>x.status==='Aceito'),'aceite materializado antes da reconciliação');return{found:true,added:1,existing:0};},
 issueGrant:async()=>{issuedCount++;return issuedCount>1?{state:'already_active'}:{state:'issued',grant_id:'a'.repeat(64),token:'s'.repeat(43),expires_at:new Date(now+45*60000).toISOString()};},
};
const serverApi=load(paths.server,{
 'next/server':{NextResponse:{json:(data,options)=>({data,status:options.status,headers:options.headers})}},
 '@/lib/integration/server/admin':{adminDb},
 '@/lib/tracking/gate1/security':secrets,
 '@/lib/tracking/gate1/core':core,
 '@/lib/tracking/gate1/storage':storage,
 './auto-policy':policy,
});
const makeReq=data=>({text:async()=>JSON.stringify(data)});
async function run(){
 process.env.DFL_TRACKING_AUTO_S2S_CERTIFIED='1';
 process.env.DFL_TRACKING_AUTO_PILOT_PHONE_E164='+5534999999999';
 process.env.DFL_TRACKING_AUTO_RECIPIENT_HMAC_KEY='synthetic-hmac-recipient-key-long-enough-do-not-use-production';
 const baseDelivery=structuredClone(memory.get('deliveries/delivery-r299-1'));
 for(const [label,changed] of [
   ['pedido concluído',{completed:true}],
   ['pedido cancelado',{site_order_status:'Cancelado'}],
   ['pedido entregue no Site',{site_order_status:'Entregue'}],
   ['pedido finalizado no Site',{site_order_status:'Finalizado'}],
   ['tenant divergente',{tenant_id:'other_tenant'}],
   ['origem marketplace',{source_system:'ifood'}],
   ['pedido de teste',{is_test:true}],
   ['pedido descarregado',{operational_dismissed_at:at}],
 ]) {
   memory.set('deliveries/delivery-r299-1',{...baseDelivery,...changed});
   const denied=await serverApi.commercialAccept(makeReq(payload));
   equal(denied.status,404,'aceite não autorizável: '+label);
 }
 memory.set('deliveries/delivery-r299-1',baseDelivery);
 let r=await serverApi.commercialAccept(makeReq({...payload,recipient_e164:'+5531999999999'}));equal(r.status,422,'destinatário errado recusado');
 r=await serverApi.commercialAccept(makeReq({...payload,consent:{...payload.consent,granted:false}}));equal(r.status,422,'sem WhatsApp opt-in');
 r=await serverApi.commercialAccept(makeReq(payload));equal(r.status,201,'aceite assinado aceito');
 equal(memory.get('deliveries/delivery-r299-1').site_order_status,'Pendente','aceite não altera produção comercial');
 ok(memory.get('deliveries/delivery-r299-1').site_order_timeline.some(x=>x.status==='Aceito'),'evento comercial assinado preservado');
 r=await serverApi.commercialAccept(makeReq(payload));equal(r.status,200,'evento duplicado idempotente');
 r=await serverApi.commercialAccept(makeReq({...payload,event_id:'site-accept-conflict-ABC88'}));equal(r.status,409,'evento concorrente divergente bloqueado');
 r=await serverApi.issueInitial(makeReq({...issue,acceptance_event_id:'wrong-accept-id-123'}));equal(r.status,403,'emissão sem prova de aceite correta bloqueada');
 r=await serverApi.issueInitial(makeReq({...issue,recipient_e164:'+5531999999999'}));equal(r.status,422,'emissão para outro telefone bloqueada');
 capability={...capability,mode:'MANUAL'};
 r=await serverApi.issueInitial(makeReq(issue));equal(r.status,403,'modo MANUAL não libera emissão');
 capability={...capability,mode:'AUTOMATIC_CERTIFIED',kill_switch:true};
 r=await serverApi.issueInitial(makeReq(issue));equal(r.status,403,'kill switch cancela emissão');
 capability={...capability,kill_switch:false};
 auth='replay';r=await serverApi.issueInitial(makeReq(issue));equal(r.status,409,'replay HMAC de nonce recusado');auth='ok';
 process.env.DFL_TRACKING_AUTO_S2S_CERTIFIED='0';
 r=await serverApi.issueInitial(makeReq(issue));equal(r.status,503,'chave de ativação OFF');
 process.env.DFL_TRACKING_AUTO_S2S_CERTIFIED='1';
 r=await serverApi.issueInitial(makeReq(issue));equal(r.status,201,'emissão única de grant');
 equal(r.data.opaque_token,'s'.repeat(43),'token de uso único retornado somente na resposta transitória');
 equal(issuedCount,1,'um único grant');
 const stored=JSON.stringify([...memory.entries()].filter(([id])=>id.startsWith('tracking_auto_')));
 ok(!stored.includes('s'.repeat(43))&&!stored.includes('+5534999999999'),'sem token bruto ou telefone nas coleções novas');
 r=await serverApi.issueInitial(makeReq({...issue,idempotency_key:'issueRetry_different1234'}));equal(r.status,409,'retry incerto não emite novo link');
 equal(issuedCount,1,'proibição efetiva de retry após emissão');
 r=await serverApi.providerReceipt(makeReq({...receipt,grant_id:'b'.repeat(64)}));equal(r.status,404,'ACK de grant alheio não aceito');
 r=await serverApi.providerReceipt(makeReq(receipt));equal(r.status,200,'ACK incerto registrado');
 equal(r.data.customer_delivery_confirmed,false,'ACK não promete mensagem entregue');
 r=await serverApi.providerReceipt(makeReq(receipt));equal(r.status,200,'ACK duplicado idempotente');
 r=await serverApi.providerReceipt(makeReq({...receipt,result:'accepted_by_provider'}));equal(r.status,409,'ACK posterior divergente não reescreve estado');
 ok(reconcileCount===1,'reconciliação apenas uma vez na emissão');
 console.log(`R299 P9: ${tests} verificações herméticas e de fluxo; zero rede, WhatsApp real e Firestore real.`);
}
run().catch(e=>{console.error(e);process.exitCode=1});
