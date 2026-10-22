'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path'),ts=require('typescript');
const docs=new Map();let reads=0,updates=0,checks=0;
const check=(label,fn)=>{fn();checks++;};
const D=Symbol('delete');
const fakeDb={
 collection(name){check('Somente coleção outbox',()=>assert.equal(name,'integration_outbox'));
  return {
    doc(id){return {id,collection:name};},
    where(field,op,value){return {limit(){return {async get(){return {docs:[]}}}}};},
  };
 },
 async runTransaction(callback){
  const pending=[];
  const tx={
   async get(ref){reads++;const d=docs.get(ref.id);return {exists:!!d,data(){return d&&{...d}}};},
   update(ref,patch){pending.push([ref.id,patch]);},
  };
  const result=await callback(tx);
  for(const [id,patch] of pending){
   const d={...docs.get(id)};
   for (const [k,v] of Object.entries(patch)){if(v===D) delete d[k];else d[k]=v;}
   docs.set(id,d);updates++;
  }
  return result;
 },
};
const modulePath=path.resolve('lib/integration/server/reverseOutboxRepository.ts');
const output=ts.transpileModule(fs.readFileSync(modulePath,'utf8'),{fileName:modulePath,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal((output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const m=new Module(modulePath,module);m.filename=modulePath;m.paths=module.paths;const orig=m.require.bind(m);
m.require=(name)=>name==='server-only'?{}:name==='firebase-admin/firestore'?{FieldValue:{delete:()=>D}}:name==='./admin'?{adminDb:fakeDb}:orig(name);
m._compile(output.outputText,modulePath);
const repo=m.exports;
const sample=(id)=>({event_id:id,event_type:'delivery.completed',source_system:'dfl_entregas',entity_type:'delivery',entity_id:id,schema_version:1,payload:{},status:'pending',attempts:0,created_at:'2026-10-21T12:00:00.000Z'});
const lockMs=10_000;
async function claim(id,who){const result=await repo.claimReverseOutboxByEventId({eventId:id,workerId:who,lockMs,allowFailedBeforeNextAttempt:true});assert.equal(result.kind,'claimed');return result.item;}
(async()=>{
 docs.set('evt-A',sample('evt-A'));
 const a=await claim('evt-A','worker-A');
 check('Worker A mantém identidade',()=>assert.equal(a.workerId,'worker-A'));
 check('Claim A grava processing',()=>assert.equal(docs.get('evt-A').status,'processing'));
 check('Claim A contador',()=>assert.equal(a.attempts,1));
 check('Worker errado não finaliza',()=>assert.equal(typeof repo.markReverseOutboxSent,'function'));
 let ok=await repo.markReverseOutboxSent(a.refId,{workerId:'wrong',attempts:a.attempts});check('Worker errado bloqueado',()=>assert.equal(ok,false));
 ok=await repo.markReverseOutboxFailed({refId:a.refId,workerId:'wrong',attempts:a.attempts,error:'bad',maxAttempts:5});check('Worker errado não falha evento',()=>assert.equal(ok,false));
 const snapA={...docs.get('evt-A')};check('Nenhuma mutação após erro de ownership',()=>assert.deepEqual(docs.get('evt-A'),snapA));
 // Simula expiração do lock e reclaim por outro worker.
 docs.get('evt-A').locked_at='2025-01-01T00:00:00.000Z';
 const b=await claim('evt-A','worker-B');
 check('Reclaim tem nova tentativa',()=>assert.equal(b.attempts,2));
 check('Reclaim pertence B',()=>assert.equal(docs.get('evt-A').locked_by,'worker-B'));
 const stateBeforeStale={...docs.get('evt-A')};
 ok=await repo.markReverseOutboxSent(a.refId,a);check('ACK obsoleto recusado',()=>assert.equal(ok,false));
 ok=await repo.markReverseOutboxFailed({refId:a.refId,workerId:a.workerId,attempts:a.attempts,error:'timeout do A',maxAttempts:5});check('Falha obsoleta recusada',()=>assert.equal(ok,false));
 check('B permanece processing',()=>assert.deepEqual(docs.get('evt-A'),stateBeforeStale));
 ok=await repo.markReverseOutboxSent(b.refId,b);check('B conclui o evento',()=>assert.equal(ok,true));
 check('Sent remove o lock',()=>assert.equal(docs.get('evt-A').locked_by,undefined));
 ok=await repo.markReverseOutboxFailed({refId:b.refId,workerId:b.workerId,attempts:b.attempts,error:'late',maxAttempts:5});check('Falha após sent recusada',()=>assert.equal(ok,false));
 check('Sent continua sent',()=>assert.equal(docs.get('evt-A').status,'sent'));
 docs.set('evt-B',sample('evt-B'));
 const c=await claim('evt-B','worker-C');
 ok=await repo.markReverseOutboxFailed({refId:c.refId,workerId:c.workerId,attempts:c.attempts,error:'HTTP 500',maxAttempts:5});
 check('Falha legítima registrada',()=>assert.equal(ok,true));
 check('Falha tem retry agendado',()=>assert.ok(Date.parse(docs.get('evt-B').next_attempt_at)>Date.now()));
 check('Falha libera lock',()=>assert.equal(docs.get('evt-B').locked_by,undefined));
 const d=await claim('evt-B','worker-D');
 check('Reclaim de failed incrementa tentativa',()=>assert.equal(d.attempts,2));
 ok=await repo.markReverseOutboxFailed({refId:d.refId,workerId:d.workerId,attempts:d.attempts,error:'sem rede',maxAttempts:2});
 check('Limite de tentativas vira dead_letter',()=>assert.equal(docs.get('evt-B').status,'dead_letter'));
 check('Dead letter remove retry',()=>assert.equal(docs.get('evt-B').next_attempt_at,undefined));
 ok=await repo.markReverseOutboxSent('missing',{workerId:'worker-M',attempts:1});check('Ausente não finaliza',()=>assert.equal(ok,false));
 ok=await repo.markReverseOutboxSent('evt-B',{workerId:'worker-D',attempts:2});check('Dead letter não vira sent tardio',()=>assert.equal(ok,false));
 docs.set('evt-C',sample('evt-C'));
 const e=await claim('evt-C','worker-E');
 ok=await repo.markReverseOutboxSent(e.refId,{workerId:'worker-E',attempts:999});check('Tentativa errada recusada',()=>assert.equal(ok,false));
 ok=await repo.markReverseOutboxSent(e.refId,{workerId:'worker-E',attempts:0});check('Tentativa zero recusada',()=>assert.equal(ok,false));
 ok=await repo.markReverseOutboxSent(e.refId,{workerId:'worker-E',attempts:1.2});check('Tentativa não inteira recusada',()=>assert.equal(ok,false));
 ok=await repo.markReverseOutboxSent(e.refId,e);check('Lease correto finaliza',()=>assert.equal(ok,true));
 console.log('R56 REVERSE LEASE: '+checks+' asserções; '+reads+' leituras transacionais; '+updates+' commits; sem varreduras novas');
})().catch(e=>{console.error(e);process.exit(1)});
