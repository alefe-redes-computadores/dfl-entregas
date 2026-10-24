#!/usr/bin/env node
'use strict';
/* V112 R93: behavior of the actual TypeScript queue, no Firestore or network. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
let checks=0;
const check=(condition,label)=>{assert.ok(condition,`R93: ${label}`);checks++};
const read=f=>fs.readFileSync(f,'utf8');
const sourceFile='lib/store/keyedWriteQueue.ts';
const src=read(sourceFile);
const ast=ts.createSourceFile(sourceFile,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
check(ast.parseDiagnostics.length===0,'helper TypeScript sem erro sintático');
const js=ts.transpileModule(src,{fileName:sourceFile,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{},Promise,Map,Error,String};
vm.runInNewContext(js,context,{filename:sourceFile});
const {createKeyedWriteQueue}=context.exports;
check(typeof createKeyedWriteQueue==='function','helper real exportado');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};
const pump=async()=>{for(let i=0;i<4;i++)await Promise.resolve()};
async function run(){
  for(let seed=0;seed<30;seed++){
    const queue=createKeyedWriteQueue();
    const waiting=deferred();
    const trace=[];
    const first=queue('routes','same',async()=>{trace.push('start-old');await waiting.promise;trace.push('end-old');return 'old'});
    const second=queue('routes','same',async()=>{trace.push('start-new');trace.push('end-new');return 'new'});
    const unrelated=queue('routes','other',async()=>{trace.push('other');return 'other-result'});
    await pump();
    check(trace.includes('start-old'),'primeira inicia');
    check(!trace.includes('start-new'),'mesmo documento espera a primeira gravação');
    check(trace.includes('other'),'outra rota não espera a primeira');
    waiting.resolve();
    const results=await Promise.all([first,second,unrelated]);
    check(results.join('|')==='old|new|other-result','todos os retornos preservados');
    check(trace.indexOf('start-new')>trace.indexOf('end-old'),'mesmo documento é serializado');
  }
  for(let seed=0;seed<20;seed++){
    const queue=createKeyedWriteQueue();const awaiting=deferred();let starts=0;
    const a=queue('customers','one',async()=>{starts++;await awaiting.promise;throw new Error('offline')});
    const b=queue('customers','one',async()=>{starts++;return 'retry'});
    await pump();
    check(starts===1,'falha não permite concorrência no mesmo documento');
    awaiting.resolve();
    await assert.rejects(a,/offline/);checks++;
    check(await b==='retry','erro antigo não bloqueia próxima escrita');
    const c=await queue('customers','one',async()=>42);
    check(c===42,'fila liberada após falha');
  }
  // A chave é composta de par (coleção,id), inclusive IDs estranhos/legados.
  {
    const q=createKeyedWriteQueue();const wait=deferred();const log=[];
    const a=q('a','bc',async()=>{log.push('a-start');await wait.promise;log.push('a-end')});
    const b=q('ab','c',async()=>{log.push('b')});
    const c=q('a','bd',async()=>{log.push('c')});
    await pump();check(log.includes('b')&&log.includes('c'),'namespace e ID não colidem');
    wait.resolve();await Promise.all([a,b,c]);
  }
  {
    const q=createKeyedWriteQueue();
    await assert.rejects(q('','some',async()=>undefined),/R93/);checks++;
    await assert.rejects(q('routes',' ',async()=>undefined),/R93/);checks++;
    check(await q('routes','safe',async()=>7)===7,'rejeições não contaminam próximas operações');
  }
  {
    const queue=createKeyedWriteQueue();let concurrency=0,max=0;
    const promises=Array.from({length:75},(_,i)=>queue('deliveries','doc-'+i,async()=>{
      concurrency++;max=Math.max(max,concurrency);await Promise.resolve();concurrency--;return i;
    }));
    const out=await Promise.all(promises);
    check(max>1,'documentos distintos continuam paralelos');
    check(out.length===75&&out.every((n,i)=>n===i),'lote paralelo sem perda de resultados');
  }
  const store=read('store/useAppStore.ts');
  const pre=read('scripts/pre-apk.cjs');
  check(store.includes("import { createKeyedWriteQueue } from '@/lib/store/keyedWriteQueue';"),'store importa fila nova');
  check(store.includes('const queueEntityWrite = createKeyedWriteQueue();'),'fila compartilhada por escopo do store');
  const targets=[
   ['routes','routeId',4],['motoboys','id',2],['customers','id',1],
   ['stock_suppliers','id',1],['team_members','id',1],['stock_products','id',1],['fuelings','id',2],
  ];
  for(const [collection,id,count] of targets){
    const re=new RegExp('queueEntityWrite\\(\\\''+collection+'\\\',\\s*'+id+'\\s*,\\s*\\(\\)\\s*=>','g');
    check((store.match(re)||[]).length===count,collection+' com '+count+' gravações serializadas');
  }
  // R95-R3: contrato reforçado de reabertura, exatamente uma vez.
  const reopenStart=store.indexOf('      reopenRoute: async (routeId) => {');
  const reopenEnd=store.indexOf('      reorderDelivery: async',reopenStart);
  check(reopenStart>=0 && reopenEnd>reopenStart,'R95: reabertura de rota preservada');
  const reopenBody=store.slice(reopenStart,reopenEnd);
  check(reopenBody.includes("queueEntityWrite('routes', routeId, () => runTransaction(db"),
    'R95: reabertura mantém quarta escrita serializada');
  check(store.includes('rollbackUpdatedEntity(')&&store.includes('rollbackDeletedEntity('),'rollbacks granulares preservados');
  check(store.includes('if (deliveryCommitCompleted)')&&store.includes('if (deletionCommitted)'),'pós-commit não desfaz baixa e exclusão confirmadas');
  check(store.includes('const queueStoreSettingsWrite = createSerializedWriteQueue();'),'fila de configurações original preservada');
  check(store.includes('withRouteOrderWriteLock('),'ordem das paradas usa proteção especializada');
  check(pre.includes("'scripts/test-v112-r93-write-order.cjs'")&&pre.includes("'scripts/test-v112-r92-snapshot-integrity.cjs'"),'pré-APK incorpora R92 e R93');
  for(const name of ['store/useAppStore.ts','scripts/pre-apk.cjs']){
    if(name.endsWith('.ts')){
     const ast=ts.createSourceFile(name,read(name),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
     check(ast.parseDiagnostics.length===0,'sintaxe do store preservada');
    } else {check(read(name).includes("'scripts/test-v112-r93-write-order.cjs'"),'registro sem alterar suíte antiga')}
  }
  check(!src.includes('firebase')&&!src.includes('firestore')&&!src.includes('setInterval')&&!src.includes('setTimeout'), 'fila não cria consultas nem polling');
  console.log(`V112 R93 FILAS E INTEGRIDADE: ${checks} verificações aprovadas`);
}
run().catch(error=>{console.error(error);process.exitCode=1});
