#!/usr/bin/env node
'use strict';
/** R44 — teste REAL da regra owner-only, somente no Firestore Emulator demo. */
const assert=require('node:assert/strict');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,query,limit}=require('firebase/firestore');
const HOST='127.0.0.1:8094',PROJECT='demo-dfl-entregas-r44-owner';
const OWNER='zIfbMxD1SQNvtlX9y6YUsEz2TXC3';
async function main(){
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,HOST,'Exige porta 8094 do emulator demo');
 assert.equal(process.env.GCLOUD_PROJECT,PROJECT,'Exige projeto demo');
 for(const name of ['NEXT_PUBLIC_FIREBASE_PROJECT_ID','FIREBASE_PROJECT_ID','GOOGLE_APPLICATION_CREDENTIALS'])assert.equal(process.env[name]||'','',name+' deve estar vazio');
 const env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:8094}});
 let checks=0;
 const allow=async(p,label)=>{await assertSucceeds(p);checks++;console.log('ALLOW',label)};
 const deny=async(p,label)=>{await assertFails(p);checks++;console.log('DENY',label)};
 try{
  await env.withSecurityRulesDisabled(async(ctx)=>{
   const db=ctx.firestore();
   await setDoc(doc(db,'staff_accounts','motoboy_test_01'),{status:'active',role:'motoboy',permissions:['home','routes_read'],uid:'motoboy_test_01',linkedMotoboyId:'moto1'});
   await setDoc(doc(db,'staff_workspaces','motoboy_test_01','home','item'),{title:'teste'});
   await setDoc(doc(db,'stock_products','internal'),{cost:25});
  });
  const own=env.authenticatedContext(OWNER).firestore();
  const staff=env.authenticatedContext('motoboy_test_01').firestore();
  const guest=env.unauthenticatedContext().firestore();
  const paths=[['staff_accounts','motoboy_test_01'],['staff_workspaces','motoboy_test_01','home','item'],['stock_products','internal']];
  for(const path of paths){
   await allow(getDoc(doc(own,...path)),'Owner lê '+path.join('/'));
   await deny(getDoc(doc(staff,...path)),'Staff negado '+path.join('/'));
   await deny(getDoc(doc(guest,...path)),'Anon negado '+path.join('/'));
  }
  await deny(getDocs(query(collection(staff,'staff_workspaces','motoboy_test_01','home'),limit(40))),'Mesmo lista <=40 bloqueada');
  await deny(getDocs(query(collection(staff,'staff_accounts'),limit(1))),'Listar contas negado');
  await deny(setDoc(doc(staff,'staff_accounts','motoboy_test_01'),{status:'active'}),'Staff não altera conta');
  await deny(updateDoc(doc(staff,'stock_products','internal'),{cost:0}),'Staff não altera estoque');
  await deny(deleteDoc(doc(staff,'staff_workspaces','motoboy_test_01','home','item')),'Staff não apaga projeção');
  await allow(updateDoc(doc(own,'stock_products','internal'),{cost:26}),'Owner escreve raiz');
  console.log('R44 OWNER-ONLY EMULATOR:',checks,'casos; projeto demo isolado');
 }finally{await env.cleanup()}
}
main().catch(err=>{console.error('R44 OWNER-ONLY EMULATOR FAIL',err);process.exitCode=1});
