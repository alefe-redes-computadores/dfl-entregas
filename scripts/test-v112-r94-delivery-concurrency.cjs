#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
let checks=0;
function ok(condition,message){assert.ok(condition,'R94: '+message);checks++;console.log('OK R94:',message);}
function load(p){
 const tree=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 ok(tree.parseDiagnostics.length===0,'TypeScript parse '+p);
 const js=ts.transpileModule(read(p),{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,Promise,Set,Map,Error},{filename:p});return m.exports;
}
const {createKeyedWriteQueue}=load('lib/store/keyedWriteQueue.ts');
const {queueDeliveryDocuments}=load('lib/store/atomicDeliveryWriteQueue.ts');
const store=read('store/useAppStore.ts');
for(const [pattern,label] of [
 ["queueEntityWrite('deliveries', delivery.id, () => setDoc",'criação unitária na fila real'],
 ["queueDeliveryDocuments(queueEntityWrite, prepared.map((delivery) => delivery.id), () => batch.commit())",'criação multipedido atomicamente enfileirada'],
 ["queueDeliveryDocuments(queueEntityWrite, [id], () => batch.commit())",'baixa e edição na mesma fila'],
 ["queueEntityWrite('deliveries', id, () => deleteDoc",'exclusão respeita baixa anterior'],
 ["queueDeliveryDocuments(queueEntityWrite, normalized.map((delivery) => delivery.id), () => batch.commit())",'ordem da rota na mesma fila'],
 ["if (deliveryCommitCompleted)",'baixa salva não sofre rollback tardio'],
 ["if (deletionCommitted)",'exclusão salva não sofre rollback tardio'],
 ["withRouteOrderWriteLock(routeId",'reordenação inter-rotas mantém autoridade'],
 ["rollbackRouteOrderFields(",'rollback específico da ordem preservado'],
 ["mergeDeliveriesPreservingExpansion(",'merge remoto e visual preservado'],
])ok(store.includes(pattern),label);
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-v112-r94-delivery-concurrency.cjs'"),'testes R94 no PRE-APK');
ok(pre.includes("'scripts/test-v112-r93-write-order.cjs'"),'testes R93 preservados');
for(const token of ['getDocs(', 'onSnapshot(', 'setInterval(', 'runTransaction(', 'firebase/firestore'])ok(!read('lib/store/atomicDeliveryWriteQueue.ts').includes(token),'fila pura não inclui '+token);
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function run(){
 let q=createKeyedWriteQueue(),gate=deferred(),events=[];
 const individual=q('deliveries','b',async()=>{events.push('old-b');await gate.promise;events.push('done-b');});
 const batch=queueDeliveryDocuments(q,['b','a','b'],async()=>{events.push('batch-ab');return 27;});
 const unrelated=q('deliveries','c',async()=>{events.push('other-c');return 'c';});
 await tick();
 ok(events.includes('old-b'),'escrita anterior já iniciada');
 ok(!events.includes('batch-ab'),'lote não ultrapassa escrita do seu segundo documento');
 ok(events.includes('other-c'),'pedido independente não fica bloqueado');
 ok(await unrelated==='c','retorno não relacionado preservado');
 gate.resolve();await individual;
 ok(await batch===27,'lote devolve valor do commit');
 ok(events.indexOf('done-b')<events.indexOf('batch-ab'),'ordem do mesmo documento preservada');
 q=createKeyedWriteQueue();gate=deferred();events=[];
 const first=queueDeliveryDocuments(q,['y','x'],async()=>{events.push('batch1');await gate.promise;events.push('finish1')});
 const second=queueDeliveryDocuments(q,['x','y'],async()=>{events.push('batch2')});
 await tick();ok(events.join(',')==='batch1','dois lotes com IDs invertidos não rodam juntos');
 gate.resolve();await Promise.all([first,second]);
 ok(events.join(',')==='batch1,finish1,batch2','lotes com IDs invertidos não geram deadlock');
 q=createKeyedWriteQueue();events=[];
 const broken=queueDeliveryDocuments(q,['k1','k2'],async()=>{events.push('broken');throw new Error('offline')});
 const repaired=q('deliveries','k2',async()=>{events.push('repaired');return true});
 await assert.rejects(broken,/offline/);ok(await repaired===true,'erro libera fila para nova gravação');
 ok(events.join(',')==='broken,repaired','erro não permite ultrapassagem');
 q=createKeyedWriteQueue();let writes=0;
 ok(await queueDeliveryDocuments(q,[],async()=>{writes++;return 'empty'})==='empty'&&writes===1,'rota vazia conserva callback original');
 await assert.rejects(queueDeliveryDocuments(q,['a',' '],async()=>{writes++;}),/IDs válidos/);
 ok(writes===1,'IDs inválidos falham sem escrever');
 const once=await queueDeliveryDocuments(q,['id','id','id'],async()=>{writes++;return 99});
 ok(once===99&&writes===2,'IDs duplicados executam batch somente uma vez');
 // Simula operação com milhares de solicitações do mesmo pedido sem permitir
 // commits fora de ordem; nenhuma espera de rede ou retry é criada pelo helper.
 q=createKeyedWriteQueue();const observed=[];const pending=[];
 for(let i=0;i<110;i++)pending.push(i%3===0?queueDeliveryDocuments(q,['z','a'],async()=>{observed.push(i);return i}):q('deliveries','a',async()=>{observed.push(i);return i}));
 const results=await Promise.all(pending);
 ok(results.length===110&&observed.every((id,i)=>id===i),'110 operações mistas conservam FIFO por pedido');
 ok(new Set(observed).size===110,'sem duplicar commit no stress');
 console.log(`R94 CONCORRÊNCIA DE ENTREGAS: ${checks} contratos e cenários OK`);
}
run().catch(e=>{console.error(e);process.exitCode=1});
