#!/usr/bin/env node
'use strict';
/** Teste real de transacoes no EMULADOR, nunca no banco de producao. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const HOST='127.0.0.1:8087',PROJECT='demo-dfl-entregas-r26';
const OWNER='zIfbMxD1SQNvtlX9y6YUsEz2TXC3';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,HOST,'R203: Firestore real proibido; host do emulador inesperado.');
assert.equal(process.env.GCLOUD_PROJECT,PROJECT,'R203: project precisa ser demo-dfl-entregas-r26.');
for(const key of ['GOOGLE_APPLICATION_CREDENTIALS','NEXT_PUBLIC_FIREBASE_PROJECT_ID','FIREBASE_PROJECT_ID','DFL_R203_ACCESS_TOKEN'])
 assert.equal(process.env[key]||'','',`R203: ambiente deve estar isolado de ${key}.`);
const ts=require('typescript');
const source=fs.readFileSync(path.join(process.cwd(),'lib/operation/delivery-import-identity.ts'),'utf8');
const output=ts.transpileModule(source,{fileName:'delivery-import-identity.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod=new Module(path.join(process.cwd(),'lib/operation/delivery-import-identity.ts'),module);mod.filename='r203-helper';mod.paths=module.paths;mod._compile(output,mod.filename);
const {deliveryImportDocumentId,assertFreshRemoteImportIds}=mod.exports;
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const {doc,getDoc,runTransaction,collection,getDocs}=require('firebase/firestore');
async function main(){
 const env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:8087}});
 let checks=0;
 try{
  const a=env.authenticatedContext(OWNER).firestore();
  const b=env.authenticatedContext(OWNER).firestore();
  const base={origin:'food99',order_id:'239812',created_at:'2026-10-30T14:10:00.000Z'};
  const canonical=deliveryImportDocumentId(base);
  assert.ok(canonical && canonical.startsWith('dfl-import-v1-food99-'));
  const sameId=deliveryImportDocumentId({...base});assert.equal(canonical,sameId);checks++;
  const save=async(db,marker)=>runTransaction(db,async(tx)=>{
   const ref=doc(db,'deliveries',canonical);
   const prior=await tx.get(ref);
   assertFreshRemoteImportIds([canonical],prior.exists()?[prior.id]:[]);
   tx.set(ref,{id:canonical,origin:'food99',order_id:'239812',testMarker:marker,created_at:base.created_at});
  });
  const results=await Promise.allSettled([save(a,'DEVICE_A'),save(b,'DEVICE_B')]);
  assert.equal(results.filter(item=>item.status==='fulfilled').length,1,'somente um aparelho pode confirmar');checks++;
  assert.equal(results.filter(item=>item.status==='rejected').length,1,'segunda gravacao recusada');checks++;
  const snap=await getDoc(doc(a,'deliveries',canonical));
  assert.ok(snap.exists());assert.ok(['DEVICE_A','DEVICE_B'].includes(snap.data().testMarker));checks++;
  const orders=await getDocs(collection(a,'deliveries'));
  assert.equal(orders.size,1,'somente um documento remoto permanece');checks++;
  const otherChannel=deliveryImportDocumentId({...base,origin:'ifood',ifood_id:'99559955',order_id:'239812'});
  assert.notEqual(canonical,otherChannel,'origem distinta nao colide');checks++;
  const anotherDay=deliveryImportDocumentId({...base,created_at:'2026-10-31T14:10:00.000Z'});
  assert.notEqual(canonical,anotherDay,'99Food pode reutilizar ID no dia seguinte');checks++;
  console.log(`R203 EMULATOR: ${checks} verificacoes reais; duas sessoes, um documento, sem sobrescrita.`);
 } finally{await env.cleanup();}
}
main().catch(e=>{console.error('R203 EMULATOR: bloqueado:',e.message);process.exitCode=1});
