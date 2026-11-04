'use strict';
/** Hermetic R256: a fictional test UID is NEVER authorized outside isolated project+opt-in. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript') ;
const source=fs.readFileSync('lib/tracking/gate1/security.ts','utf8');
const compiled=ts.transpileModule(source,{fileName:'security.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const testModule={exports:{}};let requestedChecks=[];
const mock={
 '@/lib/integration/server/admin':{adminAuth:{verifyIdToken:async (token,check)=>{requestedChecks.push(check);if(token==='revoked')throw Error('revoked');return{uid:token}}},adminDb:{}},
 '@/lib/access/roles':{isSuperadminUid:uid=>uid==='productionAdminFixture'},
};
new Function('require','module','exports',compiled)((id)=>id==='server-only'?{}:Object.hasOwn(mock,id)?mock[id]:require(id),testModule,testModule.exports);
const s=testModule.exports;let checks=0;const eq=(a,b,msg)=>{assert.equal(a,b,msg);checks++};
const original={...process.env};
const uid='testFictitiousOwner001',req=token=>({headers:{get:key=>key==='authorization'?'Bearer '+token:null}});
(async()=>{
 Object.assign(process.env,{DFL_TRACKING_HML_OWNER_UID:uid,DFL_TRACKING_TENANT_ID:'DFL_HML_A',DFL_TRACKING_HML_OWNER_OPT_IN:'0',FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'dfl-finance'})});
 eq(await s.authorizedOwner(req(uid)),null,'default deny');
 process.env.DFL_TRACKING_HML_OWNER_OPT_IN='1';
 eq(await s.authorizedOwner(req(uid)),uid,'opt-in isolated owner');
 eq(await s.authorizedOwner(req('other-user-123456')),null,'other user denied');
 eq(await s.authorizedOwner(req('revoked')),null,'revoked token denied');
 process.env.DFL_TRACKING_TENANT_ID='PROD';eq(await s.authorizedOwner(req(uid)),null,'wrong tenant blocked');
 process.env.DFL_TRACKING_TENANT_ID='DFL_HML_A';
 process.env.FIREBASE_SERVICE_ACCOUNT_JSON=JSON.stringify({project_id:'dfl-painel'});
 eq(await s.authorizedOwner(req(uid)),null,'operational Firestore credentials rejected');
 process.env.FIREBASE_SERVICE_ACCOUNT_JSON='corrupt';eq(await s.authorizedOwner(req(uid)),null,'corrupt credentials blocked');
 delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;eq(await s.authorizedOwner(req(uid)),null,'no credential blocked');
 process.env.FIREBASE_SERVICE_ACCOUNT_JSON=JSON.stringify({project_id:'dfl-finance'});
 eq(await s.authorizedOwner(req('productionAdminFixture')),'productionAdminFixture','operational superadmin invariant');
 eq(requestedChecks.every(Boolean),true,'all owner tokens checked for revocation');
 console.log(`R256 Entregas test-only owner: ${checks} checks PASS; no network/Firestore/WhatsApp`);
})().catch(e=>{console.error('R256 ENTREGAS BLOQUEADO',e);process.exitCode=1}).finally(()=>{process.env=original});
