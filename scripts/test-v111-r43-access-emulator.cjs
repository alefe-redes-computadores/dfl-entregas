#!/usr/bin/env node
'use strict';
/** Somente demo local; requer emulador em execução e Rules candidatas. */
const assert=require('node:assert/strict');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,query,limit}=require('firebase/firestore');
const HOST='127.0.0.1:8093',PROJECT='demo-dfl-entregas-r43';
const OWNER='zIfbMxD1SQNvtlX9y6YUsEz2TXC3';
async function main(){
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,HOST,'Exige Firestore Emulator em 127.0.0.1:8093');
 assert.equal(process.env.GCLOUD_PROJECT,PROJECT,'Projeto exclusivamente demo');
 assert.equal(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '','','Projeto real proibido');
 assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS || '','','Credenciais reais proibidas');
 const env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:8093}});
 const ids={moto:'r43-moto-001',buyer:'r43-buyer-001',ops:'r43-ops-001',custom:'r43-custom-001',unbound:'r43-unbound-001',revoked:'r43-revoked-001'};
 let tested=0;
 const yes=async(p,name)=>{await assertSucceeds(p);tested++;console.log('ALLOW '+name)};
 const no=async(p,name)=>{await assertFails(p);tested++;console.log('DENY '+name)};
 const acct=(db,uid)=>doc(db,'staff_accounts',uid);
 const row=(db,uid,area)=>doc(db,'staff_workspaces',uid,area,'item');
 try{
  await env.withSecurityRulesDisabled(async(ctx)=>{
   const db=ctx.firestore();
   const sets=[
    [ids.moto,'motoboy',['home','routes_read','deliveries_read','stock_read'],'m1'],
    [ids.buyer,'compras',['home','stock_read','purchases_read','routes_read'],null],
    [ids.ops,'operacao',['home','routes_read','deliveries_read','stock_read','purchases_read'],null],
    [ids.custom,'personalizado',['home','routes_read','stock_read'],'m2'],
    [ids.unbound,'personalizado',['home','routes_read','stock_read'],null],
    [ids.revoked,'operacao',['home','stock_read'],null],
   ];
   for(const [uid,role,permissions,linked] of sets){
    await setDoc(acct(db,uid),{uid,role,status:uid===ids.revoked?'suspended':'active',permissions,...(linked?{linkedMotoboyId:linked}:{})});
    for(const area of ['home','routes','deliveries','stock','purchases'])await setDoc(row(db,uid,area),{title:'projecao minima'});
   }
   await setDoc(doc(db,'deliveries','secret'),{phone:'PRIVATE'});
   await setDoc(doc(db,'stock_products','secret'),{cost:999});
  });
  const owner=env.authenticatedContext(OWNER).firestore();await yes(getDoc(doc(owner,'deliveries','secret')),'Owner consulta raiz');
  for(const [uid,allowAreas,denyAreas] of [
   [ids.moto,['home','routes','deliveries'],['stock','purchases']],
   [ids.buyer,['home','stock','purchases'],['routes','deliveries']],
   [ids.ops,['home','routes','deliveries','stock','purchases'],[]],
   [ids.custom,['home','routes','stock'],['deliveries','purchases']],
   [ids.unbound,['home','stock'],['routes','deliveries']],
   [ids.revoked,[],['home','stock','routes']],
  ]){
   const db=env.authenticatedContext(uid).firestore();
   await yes(getDoc(acct(db,uid)),uid+' pode ler proprio estado');
   for(const area of allowAreas)await yes(getDoc(row(db,uid,area)),uid+' read '+area);
   for(const area of denyAreas)await no(getDoc(row(db,uid,area)),uid+' denied '+area);
   await no(getDoc(doc(db,'deliveries','secret')),uid+' sem acesso a entrega raiz');
   await no(getDoc(doc(db,'stock_products','secret')),uid+' sem custo raiz');
   await no(setDoc(acct(db,uid),{status:'active'}),uid+' nao ativa conta');
   await no(setDoc(row(db,uid,'stock'),{stock:100}),uid+' nao altera projecao');
  }
  const moto=env.authenticatedContext(ids.moto).firestore();
  await no(getDoc(acct(moto,ids.buyer)),'nao consulta outra conta');
  await yes(getDocs(query(collection(moto,'staff_workspaces',ids.moto,'routes'),limit(40))),'lista ate 40');
  await no(getDocs(collection(moto,'staff_workspaces',ids.moto,'routes')),'lista sem limite negada');
  await no(getDocs(query(collection(moto,'staff_workspaces',ids.moto,'routes'),limit(41))),'limite >40 negado');
  await env.withSecurityRulesDisabled(async(ctx)=>{await updateDoc(acct(ctx.firestore(),ids.moto),{status:'suspended'})});
  await no(getDoc(row(moto,ids.moto,'routes')),'revogacao bloqueia mesmo token');
  console.log('R43 EMULATOR REAL:',tested,'cenarios; sem contato producao');
 }finally{await env.cleanup()}
}
main().catch(e=>{console.error('R43 EMULATOR FALHOU',e);process.exitCode=1});
