#!/usr/bin/env node
'use strict';
/** R302 Gate 1: producer físico real, banco/HTTP herméticos. Sem Evolution. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const read = p => fs.readFileSync(p,'utf8');
let checks = 0;
const ok = (x, msg) => { assert.ok(x,'R302: '+msg); checks++; };
const equal = (x,y,msg) => { assert.equal(x,y,'R302: '+msg); checks++; };
const serverFile='lib/integration/server/manualNextStop.ts';
const policyFile='lib/integration/manualNextStopPolicy.ts';
const serverSrc=read(serverFile),policySrc=read(policyFile);
for (const [p,source] of [[serverFile,serverSrc],[policyFile,policySrc]]) {
 const tree=ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 equal(tree.parseDiagnostics.length,0,'AST TypeScript '+p);
}
ok(serverSrc.includes("manual_next_stop_transitions_v2"),'reserva persistente preservada');
ok(serverSrc.includes("source:'manual',event_type:'delivery.next_stop'"),'evento v2 manual preservado');
ok(serverSrc.includes("DFL_MANUAL_NEXT_STOP_ENABLED === 'true'"),'OFF por padrão');
ok(serverSrc.includes('normaliz') || serverSrc.includes('normalizeManualMessagePhone'),'telefone normalizado no produtor');
ok(serverSrc.includes('recipientLedgerKey') && serverSrc.includes('transitionKey'),'reserva por transição e destinatário, não por pedido');
ok(serverSrc.includes('const candidateByPhone = new Map'),'somente um candidato por telefone por parada');
ok(!serverSrc.includes('sendText/') && !serverSrc.includes('Evolution'),'nenhum envio direto a provedor');
const now=Date.now(),iso=ms=>new Date(ms).toISOString();
const routeId='route-real-12345678';
const route={id:routeId,status:'aberta',started_at:iso(now-120_000)};
const deliveryId=i=>`dfl-test-${i}-12345678901234567890`;
const phone='5534999999999';
const stops=['A','B','B','C','D','E','F'].map((addr,i)=>({
 id:deliveryId(i),route_id:routeId,origin:'loja',source_system:'dfl_entregas',
 fulfillment_mode:'delivery',address_string:addr,order_index:i===2?1:i>2?i-1:i,
 completed:false,manual_messaging_opt_in_v1:true,notify_whatsapp:true,
 phone:'(34) 99999-9999',customer_name:'Cliente Teste'
}));
const ledgers=new Map(),httpCalls=[];
const docs=()=>stops.map(item=>({id:item.id,data:()=>({...item})}));
const db={collection(name){
 if(name==='routes') return {doc:key=>({get:async()=>({exists:key===routeId,data:()=>({...route})})})};
 if(name==='deliveries') return {where:(field,op,v)=>{equal(field,'route_id','query rota');equal(op,'==','filtro igualdade');equal(v,routeId,'chave rota');return {limit:n=>({get:async()=>({size:stops.length,docs:docs()})})}}};
 if(name==='manual_next_stop_transitions_v2') return {doc:key=>({
  create:async row=>{if(ledgers.has(key))throw Object.assign(Error('already exists'),{code:6});ledgers.set(key,{...row});},
  update:async row=>{ledgers.set(key,{...ledgers.get(key),...row});}
 })};
 throw Error('R302: coleção Firestore inesperada: '+name);
}};
const env={DFL_MANUAL_NEXT_STOP_ENABLED:'true',DFL_MANUAL_NEXT_STOP_KILL_SWITCH:'false',DFL_MANUAL_NEXT_STOP_SCOPE:'canary',
 DFL_MANUAL_MESSAGING_ENABLED:'true',DFL_MANUAL_MESSAGING_KILL_SWITCH:'false',DFL_MANUAL_MESSAGING_SCOPE:'canary',
 DFL_MESSAGING_PILOT_PHONE_E164:phone,DFL_MANUAL_MESSAGING_ACTIVATED_AT:iso(now-300_000),
 DFL_SITE_INTEGRATION_URL:'https://dafamilialanches.com.br',DFL_INTEGRATION_SIGNING_SECRET:'R302_TEST_ONLY_NOT_REAL'};
const norm=value=>{const n=String(value||'').replace(/\D/g,'');return /^55[1-9]\d{9,10}$/.test(n)?n:/^[1-9]\d{9,10}$/.test(n)?'55'+n:null;};
const load=(p,deps)=>{
 const module={exports:{}};
 const compiled=ts.transpileModule(read(p),{fileName:p,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,'transpile '+p);
 const ctx={module,exports:module.exports,require:id=>{
  if(Object.prototype.hasOwnProperty.call(deps,id))return deps[id];
  throw Error('R302: import não previsto '+id+' de '+p);
 },process:{env},Date,Number,String,Math,Map,Set,JSON,RegExp,crypto,URL,AbortController,setTimeout,clearTimeout,console,
 fetch:async(url,opts)=>{
  equal(url,'https://dafamilialanches.com.br/api/integration/manual-messaging','destino Site existente');
  const payload=JSON.parse(opts.body);
  equal(payload.event_type,'delivery.next_stop','evento de próxima parada');
  equal(payload.source,'manual','origem manual');
  equal(payload.payload.pending_stop_rank,1,'rank físico');
  equal(payload.payload.stops_ahead,0,'sem ETA ou distância inventada');
  equal(opts.headers['x-dfl-signature'],crypto.createHmac('sha256',env.DFL_INTEGRATION_SIGNING_SECRET)
   .update(`${opts.headers['x-dfl-timestamp']}.${opts.body}`,'utf8').digest('hex'),'HMAC do corpo bruto');
  ok(payload.event_id===`manual-msg-v2__delivery.next_stop__${payload.payload.delivery_id}__${payload.payload.transition_key}`,'identidade v2 consistente');
  httpCalls.push(payload);
  return {ok:true,status:200,json:async()=>({ok:true,queued:true})};
 }};
 vm.runInNewContext(compiled.outputText,ctx,{filename:p,timeout:10000});
 return module.exports;
};
const policy=load(policyFile,{'@/lib/route-stops':{deliveryStopKey:d=>`${d.route_id}:${d.address_string}`}});
const bridge=load(serverFile,{'server-only':{},'node:crypto':crypto,'./admin':{adminDb:db},'../manualNextStopPolicy':policy,
 '../manualMessagingPolicy':{normalizeManualMessagePhone:norm,planManualMessage:()=>({eligible:false})}});
(async()=>{
 let r=await bridge.notifyManualNextStop(routeId);
 equal(r.status,'skipped','sem conclusão da primeira parada não há envio');equal(httpCalls.length,0,'nenhum HTTP antes da baixa');
 stops[0].completed=true;stops[0].completed_at=iso(now-2500);
 r=await bridge.notifyManualNextStop(routeId);
 equal(r.queued,1,'dois pedidos, mesmo telefone: um evento');equal(r.eligible,1,'uma oportunidade por telefone e transição');equal(httpCalls.length,1,'um POST ao Site');
 const firstKey=httpCalls[0].payload.transition_key;
 r=await bridge.notifyManualNextStop(routeId);
 equal(r.duplicates,1,'duplicata reaproveita reserva');equal(httpCalls.length,1,'sem segundo POST');
 stops[1].completed=true;stops[1].completed_at=iso(now-1500);
 r=await bridge.notifyManualNextStop(routeId);
 equal(r.duplicates,1,'baixa parcial da parada 2 não gera novo evento para mesmo telefone');
 equal(httpCalls.length,1,'baixa parcial não duplica WhatsApp');
 stops[2].completed=true;stops[2].completed_at=iso(now-1000);
 r=await bridge.notifyManualNextStop(routeId);
 equal(r.queued,1,'somente conclusão integral da parada 2 libera a terceira');
 equal(httpCalls.length,2,'nova parada física = segundo evento');
 ok(httpCalls[1].payload.transition_key!==firstKey,'transição física nova tem chave própria');
 env.DFL_MANUAL_NEXT_STOP_KILL_SWITCH='true';r=await bridge.notifyManualNextStop(routeId);
 equal(r.status,'off','kill switch impede novo produtor');equal(httpCalls.length,2,'kill switch sem requisições');
 env.DFL_MANUAL_NEXT_STOP_KILL_SWITCH='false';route.status='fechada';r=await bridge.notifyManualNextStop(routeId);
 equal(r.status,'skipped','rota fechada não notifica');equal(httpCalls.length,2,'rota fechada sem requisições');
 console.log(`R302 PHYSICAL NEXT-STOP: ${checks} validações executáveis, 6 paradas/7 pedidos, sem Firestore real, Site real ou WhatsApp`);
})().catch(e=>{console.error(e);process.exitCode=1});
