#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const read=f=>fs.readFileSync(f,'utf8');let n=0;
function ok(value,label){assert.ok(value,'R95: '+label);n++;console.log('OK R95:',label)}
function rejects(fn,phrase){assert.throws(fn,new RegExp(phrase));n++}
function load(file,mocks={}){
 const source=read(file),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'TS legível '+file);
 const js=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const out={exports:{}};
 vm.runInNewContext(js,{module:out,exports:out.exports,require:key=>{if(key in mocks)return mocks[key];throw new Error('Import inesperado: '+key)},Map,Set,Error,Boolean},{filename:file});
 return out.exports;
}
const {assertRemoteDeliveryTransition:transition,assertRouteClosureStable:close,assertRemoteSettlementAdjustment:adjust}=load('lib/operation/remoteOperationGuards.ts',{
 '@/lib/integration/site-order':{isCancelledSiteDelivery:d=>d.source_system==='dfl_site'&&['cancelado','cancelada','cancelled','canceled'].includes(d.site_order_status)}
});
const delivery={id:'d1',route_id:'r1',completed:false,updated_at:'2026-10-24T11:00:00.000Z',source_system:'dfl_entregas'};
const route={id:'r1',status:'aberta',started_at:'2026-10-24T10:00:00.000Z'};
transition(delivery,{...delivery},{completed:true},route,true);n++;
transition(delivery,{...delivery},{completed:false},route,true);n++;
transition(delivery,{...delivery},{route_id:'r2'},{...route,id:'r2'},true);n++;
rejects(()=>transition(delivery,null,{completed:true},route,true),'ausente');
rejects(()=>transition(delivery,{...delivery,id:'d2'},{completed:true},route,true),'diferente');
rejects(()=>transition(delivery,{...delivery,route_id:'r2'},{completed:true},route,true),'outro aparelho');
rejects(()=>transition(delivery,{...delivery,completed:true},{completed:true},route,true),'outro aparelho');
rejects(()=>transition(delivery,{...delivery,updated_at:'2026-10-24T11:01:00.000Z'},{completed:true},route,true),'outro aparelho');
rejects(()=>transition(delivery,{...delivery,source_system:'dfl_site',site_order_status:'cancelado'},{completed:true},route,true),'cancelado');
rejects(()=>transition(delivery,{...delivery},{completed:true},null,true),'rota');
rejects(()=>transition(delivery,{...delivery},{completed:true},{...route,status:'fechada'},true),'rota');
rejects(()=>transition(delivery,{...delivery},{completed:true},{...route,started_at:undefined},true),'iniciada');
transition(delivery,{...delivery},{completed:true},null,false);n++;
const current=[{...delivery},{...delivery,id:'d2',completed:true}];
close('r1',route,current,[route],current);n++;
rejects(()=>close('r1',route,current,[{...route,status:'fechada'}],current),'rota mudou');
rejects(()=>close('r1',route,current,[route],current.slice(0,1)),'pedidos da rota');
rejects(()=>close('r1',route,current,[route],[current[0],{...current[1],completed:false}]),'entrega mudou');
rejects(()=>close('r1',route,current,[route],[current[0],{...current[1],updated_at:'2026-10-24T12:00:00.000Z'}]),'entrega mudou');
rejects(()=>close('r1',route,current,[route],[current[0],{...current[1],id:'novo'}]),'entrega mudou');
const a={id:'a',status:'pending',amount:12.5,direction:'addition',kind:'extra_fee',category_id:'c1',description:'Extra',motoboy_id:'m1',operational_date:'2026-10-24'};
adjust(a,{...a});n++;
rejects(()=>adjust({...a,amount:20},a),'outro aparelho');
rejects(()=>adjust({...a,direction:'deduction'},a),'outro aparelho');
rejects(()=>adjust({...a,category_id:'c2'},a),'outro aparelho');
rejects(()=>adjust({...a,status:'incorporated'},a),'outro aparelho');
rejects(()=>adjust({...a,description:'Outro'},a),'outro aparelho');
rejects(()=>adjust({...a,operational_date:'2026-10-23'},a),'outro aparelho');
rejects(()=>adjust(a,undefined),'outro aparelho');
// Conserva o contrato estrutural com a R94: commits normais continuam batch.
const store=read('store/useAppStore.ts'),pre=read('scripts/pre-apk.cjs');
for(const [part,label] of [
 ['if (isCompleting || isReopening || routeChanged)', 'somente transições críticas exigem leitura'],
 ['assertRemoteDeliveryTransition(deliveryToUpdate, remoteDelivery, dataWithTimestamp, remoteRoute, needsRoute)', 'autoridade remota chamada'],
 ["queueDeliveryDocuments(queueEntityWrite, [id], () => batch.commit())", 'fila R94 para demais edições'],
 ["queueDeliveryDocuments(queueEntityWrite, [id], () =>", 'fila R94 para commits críticos'],
 ["queueEntityWrite('customers', customer.id, commitCritical)",'resumo do cliente usa fila existente'],
 ['assertRouteClosureStable(routeId, routeBeforeClose, routeDeliveries, get().routes, get().deliveries)', 'rota confere fotografia no fechamento'],
 ["queueEntityWrite('routes', routeId, () => runTransaction(db", 'reabertura aguarda edições da rota'],
 ['assertRemoteSettlementAdjustment(adjustment, localAdjustmentsAtStart.get(snapshot.id))','acerto compara valor e direção remotos'],
 ["'scripts/test-v112-r95-remote-authority.cjs'",'R95 registrada no PRE-APK'],
 ["'scripts/test-v112-r94-delivery-concurrency.cjs'",'R94 preservada no PRE-APK'],
 ['if (deliveryCommitCompleted)', 'não reverte baixa gravada'],
 ['if (deletionCommitted)', 'não recria exclusão confirmada'],
 ["queueEntityWrite('routes', routeId, () => runTransaction(db",'R93-R2 exige quarta operação da rota na fila'],
 ['transaction.set(settlementRef', 'acerto mantém atomicidade'],
 ['const remoteRouteDeliveries = await getDocs(query(', 'fechamento confere vinculação remota'],
])ok((part.startsWith("'scripts/")?pre:store).includes(part),label);
// 6000 interleavings: nenhum registro com revisão diferente pode ser sobrescrito.
for(let i=0;i<6000;i++){
 const newer={...delivery,updated_at:`2026-10-24T11:${String(i%60).padStart(2,'0')}:${String(i%60).padStart(2,'0')}.000Z`};
 if(newer.updated_at===delivery.updated_at) continue;
 assert.throws(()=>transition(delivery,newer,{completed:true},route,true));
 n++;
}
console.log(`R95: ${n} contratos/casos aprovados. Sem conexão Firebase nem escrita.`);
