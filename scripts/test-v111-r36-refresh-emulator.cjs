'use strict';
/** Firestore REAL emulator (Admin SDK), isolado; nunca conectar a um projeto Firebase de produção. */
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const ts=require('typescript');
if(!process.env.FIRESTORE_EMULATOR_HOST||!/^demo-dfl-entregas-r36$/.test(process.env.GCLOUD_PROJECT||'')){
 console.error('R36 BLOQUEADO: exige FIRESTORE_EMULATOR_HOST e GCLOUD_PROJECT=demo-dfl-entregas-r36');process.exit(2);
}
const root=path.resolve(__dirname,'..');const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...rest){return resolve.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,parent,...rest);};
require.extensions['.ts']=function(mod,filename){const src=fs.readFileSync(filename,'utf8');const js=ts.transpileModule(src,{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;mod._compile(js,filename);};
const admin=require('firebase-admin');const app=admin.initializeApp({projectId:'demo-dfl-entregas-r36'},'r36-tests');const db=admin.firestore(app);
const {buildFreshStaffSnapshot,readCurrentStaffSnapshot}=require('../lib/access/staffRefreshSnapshot.ts');
const {staffRefreshProof,staffDraftFingerprint,staffAccountFingerprint}=require('../lib/access/staffRefreshProof.ts');
const {commitSuspendedStaffRefresh}=require('../lib/access/staffRefreshCommit.ts');
let passed=0;function ok(b,msg){assert.ok(b,msg);passed++;}
const uid='staff-00000001',accountRef=db.collection('staff_accounts').doc(uid),draftRef=db.collection('staff_access_drafts').doc('draft-000001');
const freshAccount=()=>({uid,status:'suspended',role:'motoboy',permissions:['home','routes_read','deliveries_read'],linkedMotoboyId:'moto-r36',draftId:'draft-000001',updatedAt:'2026-10-20T20:00:00.000Z'});
const freshDraft=()=>({status:'rascunho',activation:'not_enabled',role:'motoboy',email:'worker@example.invalid',permissions:['home','routes_read','deliveries_read'],linkedMotoboyId:'moto-r36'});
async function preview(){const [a,d]=await Promise.all([accountRef.get(),draftRef.get()]);const account=a.data();const [before,next]=await Promise.all([readCurrentStaffSnapshot(db,uid),buildFreshStaffSnapshot(db,account)]);return {uid,expectedUpdatedAt:account.updatedAt,expectedDigest:staffRefreshProof(uid,account.updatedAt,before,next),expectedAccountFingerprint:staffAccountFingerprint(account),expectedDraftFingerprint:staffDraftFingerprint(d.data())};}
async function shouldReject(request,pattern){await assert.rejects(commitSuspendedStaffRefresh(db,request),pattern);passed++;}
async function main(){
 await accountRef.set(freshAccount());await draftRef.set(freshDraft());
 await db.collection('routes').doc('route-r36').set({name:'Rota Exemplo',motoboy_id:'moto-r36',status:'em_andamento',date:'2026-10-20',customerPhone:'34999999999'});
 await db.collection('deliveries').doc('delivery-r36').set({route_id:'route-r36',completed:false,client_phone:'34999999999',total:56.75});
 await db.collection('staff_workspaces').doc('foreign-uid').collection('routes').doc('sentinel').set({title:'Não tocar',subtitle:'Teste',status:'OK'});
 const request=await preview();await db.collection('routes').doc('route-r36').update({name:'Rota Alterada'});
 await shouldReject(request,/R36_PREVIEW_STALE/);ok(!(await db.collection('staff_workspaces').doc(uid).collection('routes').doc('route-r36').get()).exists,'Sem escrita após origem divergente');
 const current=await preview();const result=await commitSuspendedStaffRefresh(db,current);
 ok(result.applied&&result.totalChanges>0,'Primeiro commit aplicou delta');ok((await accountRef.get()).data().status==='suspended','Conta permanece suspensa');
 const projected=(await db.collection('staff_workspaces').doc(uid).collection('routes').doc('route-r36').get()).data();
 ok(projected?.title==='Rota Alterada'&&Object.keys(projected).sort().join(',')==='status,subtitle,title','Projeção contém apenas whitelist');
 ok(!JSON.stringify(projected).includes('34999999999'),'Telefone não vazou');
 const repeated=await commitSuspendedStaffRefresh(db,await preview());ok(repeated.applied===false&&repeated.totalChanges===0,'Repetição sem escrita');
 const audits=await db.collection('staff_access_audit').where('targetUid','==',uid).get();ok(audits.size===1,'No-op sem novo audit');
 const stale=await preview();await db.collection('staff_workspaces').doc(uid).collection('routes').doc('route-r36').update({subtitle:'Atualizado por outro fluxo'});
 await shouldReject(stale,/R36_PREVIEW_STALE/);
 const draftStale=await preview();await draftRef.update({linkedMotoboyId:'motoboy-trocado'});await shouldReject(draftStale,/R36_DRAFT_CHANGED/);await draftRef.set(freshDraft());
 const accountStale=await preview();await accountRef.update({permissions:['home']});await shouldReject(accountStale,/R36_ACCOUNT_CHANGED/);await accountRef.update({permissions:freshAccount().permissions});
 ok((await db.collection('staff_workspaces').doc('foreign-uid').collection('routes').doc('sentinel').get()).exists,'UID alheio intacto');
 const second=await preview();await db.collection('deliveries').doc('delivery-r36').update({completed:true});await shouldReject(second,/R36_PREVIEW_STALE/);
 const final=await commitSuspendedStaffRefresh(db,await preview());ok(final.applied,'Sincroniza novamente após revalidar');
 ok((await db.collection('stock_products').limit(1).get()).empty,'Estoque não alterado');
 console.log(`R36 Firebase Emulator: ${passed} verificações executadas no projeto DEMO; sem produção.`);
}
main().catch(err=>{console.error('R36 emulator FALHOU:',err);process.exitCode=1;}).finally(async()=>{await app.delete();});
