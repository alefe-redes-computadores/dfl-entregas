#!/usr/bin/env node
'use strict';
/** Run ONLY with real Firebase Firestore Emulator, project ID prefixed demo-. */
const assert=require('node:assert/strict');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,deleteDoc,updateDoc,query,limit}=require('firebase/firestore');
const HOST='127.0.0.1:8093',PROJECT='demo-dfl-entregas-r43';
const OWNER='zIfbMxD1SQNvtlX9y6YUsEz2TXC3';
async function main(){
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,HOST);
 assert.equal(process.env.GCLOUD_PROJECT,PROJECT);
 for(const name of ['NEXT_PUBLIC_FIREBASE_PROJECT_ID','FIREBASE_PROJECT_ID','GOOGLE_APPLICATION_CREDENTIALS'])assert.equal(process.env[name]||'','',`Production credential/env forbidden: ${name}`);
 const env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:8093}});
 const uid='r64-moto-uid', uid2='r64-purchases-uid';let checks=0;
 const yes=async(p,label)=>{await assertSucceeds(p);checks++;console.log('ALLOW',label)};
 const no=async(p,label)=>{await assertFails(p);checks++;console.log('DENY',label)};
 const account=(db,id)=>doc(db,'staff_accounts',id);
 const area=(db,id,section)=>doc(db,'staff_workspaces',id,section,'demo');
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await setDoc(account(db,uid),{uid,displayName:'Moto',role:'motoboy',status:'active',permissions:['home','routes_read','deliveries_read','stock_read','staff_admin','finance'],linkedMotoboyId:'moto1'});
   await setDoc(account(db,uid2),{uid:uid2,displayName:'Compras',role:'compras',status:'active',permissions:['home','stock_read','purchases_read','routes_read']});
   for(const id of [uid,uid2])for(const section of ['home','routes','deliveries','stock','purchases'])await setDoc(area(db,id,section),{title:'Projeção mínima'});
   await setDoc(doc(db,'routes','private'),{amount:999});
   await setDoc(doc(db,'stock_products','private'),{cost:99});
  });
  const owner=env.authenticatedContext(OWNER).firestore();
  const moto=env.authenticatedContext(uid).firestore();
  const buying=env.authenticatedContext(uid2).firestore();
  const guest=env.unauthenticatedContext().firestore();
  await yes(getDoc(account(moto,uid)),'own account status');
  await no(getDoc(account(moto,uid2)),'other account private');
  await no(getDoc(account(guest,uid)),'anonymous private');
  await yes(getDoc(area(moto,uid,'routes')),'assigned route projection');
  await no(getDoc(area(moto,uid,'stock')),'malicious stock permission still blocked by motoboy role');
  await no(getDoc(area(moto,uid,'purchases')),'motoboy purchases forbidden');
  await yes(getDoc(area(buying,uid2,'stock')),'purchasing stock projection');
  await no(getDoc(area(buying,uid2,'routes')),'purchasing routes forbidden even with permission token');
  await no(getDoc(area(buying,uid2,'deliveries')),'purchasing deliveries forbidden');
  for(const db of [moto,buying,guest]){
   await no(getDoc(doc(db,'routes','private')),'root route forbidden');
   await no(getDoc(doc(db,'stock_products','private')),'root stock forbidden');
  }
  await no(setDoc(account(moto,uid),{uid,status:'active'}),'staff may not activate itself');
  await no(updateDoc(account(buying,uid2),{role:'operacao'}),'staff may not raise its role');
  await no(setDoc(area(buying,uid2,'stock'),{title:'forged'}),'projection tampering forbidden');
  await no(deleteDoc(area(moto,uid,'routes')),'projection deletion forbidden');
  await no(getDocs(collection(moto,'staff_workspaces',uid,'routes')),'unbounded query forbidden');
  await no(getDocs(query(collection(moto,'staff_workspaces',uid,'routes'),limit(41))),'limit greater than 40 forbidden');
  await yes(getDocs(query(collection(moto,'staff_workspaces',uid,'routes'),limit(40))),'bounded query allowed');
  await env.withSecurityRulesDisabled(async ctx=>{await updateDoc(account(ctx.firestore(),uid),{status:'suspended'})});
  await no(getDoc(area(moto,uid,'routes')),'suspension immediately revokes projection');
  await yes(getDoc(account(moto,uid)),'suspended account can see own status');
  await no(getDocs(query(collection(moto,'staff_workspaces',uid,'routes'),limit(40))),'suspended account cannot list projection');
  await yes(getDoc(doc(owner,'routes','private')),'owner root access unchanged');
  console.log('R64 EMULATOR REAL:',checks,'checks, demo project only');
 }finally{await env.cleanup()}
}
main().catch(err=>{console.error('R64 EMULATOR FAIL',err);process.exitCode=1});
