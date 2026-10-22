#!/usr/bin/env node
'use strict';
/** R39 — Fast behavioral tests against both API handlers with mocked Firestore/Auth. No network. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
let pass=0;const ok=(x,msg)=>{assert.ok(x,'R39 API: '+msg);pass++};
const transpile=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const budget={};new Function('module','exports',transpile('lib/access/staffReadBudget.ts'))({exports:budget},budget);
let ownerChecked=0,reads=0;let finishRoot=null;
const accountRows=[{id:'user_00000001',data:()=>({uid:'user_00000001'})}];
const db={collection(name){
 if(name==='staff_accounts')return {limit(n){return {async get(){reads++;ok(n===31,'Root accounts bounded');await new Promise(done=>{finishRoot=done});return {docs:accountRows,size:1};}}}};
 if(name==='staff_operation_requests')return {limit(n){return {async get(){reads++;ok(n===101,'Root requests bounded');return {docs:[],size:0};}}}};
 if(name==='staff_workspaces')return {doc(uid){return {collection(area){return {limit(n){return {async get(){reads++;ok(n===1,'Projection bounded');return {docs:[]};}}}}}}}};
 throw Error('UNEXPECTED COLLECTION '+name);
}};
const request=token=>({headers:{get:key=>key==='authorization'?'Bearer '+token:key==='origin'?'https://localhost':''},url:'https://demo.invalid/api/access/readiness'});
const shared={
 'next/server':{NextResponse:{json:(body,opt)=>({body,status:opt.status,headers:opt.headers})}},
 '@/lib/integration/server/admin':{adminDb:db,adminAuth:{verifyIdToken:async(token,revoked)=>{ownerChecked++;ok(revoked,'Revoked-token verified');return {uid:token==='valid'?'owner':'intruder'};}}},
 '@/lib/access/roles':{isSuperadminUid:x=>x==='owner'},
 '@/lib/access/staffReadinessPolicy':{READINESS_SECTIONS:['home','routes','deliveries','stock','purchases'],blankSamples:()=>({home:false,routes:false,deliveries:false,stock:false,purchases:false}),auditStaffAccount:(uid,d,now)=>({uid,name:'',role:'operacao',status:'suspended',sections:['home'],issues:[],lastPreparedAt:new Date(now).toISOString()})},
 '@/lib/access/staffOrigin':{isIsolatedStaffOrigin:()=>true},
 '@/lib/access/staffProjectionGuard':{inspectStaffProjection:()=>({clean:true,risks:[]})},
 '@/lib/access/staffReadBudget':budget,
};
const api={};new Function('module','exports','require',transpile('app/api/access/readiness/route.ts'))({exports:api},api,key=>{if(!(key in shared))throw Error('Unexpected import '+key);return shared[key];});
(async()=>{
 const denied=await api.GET(request('bad'));ok(denied.status===403,'Intruder denied');ok(reads===0,'Intruder causes zero reads');
 const initial=api.GET(request('valid'));
 // Confirm first GET passed token validation and started its two read-only root queries.
 await new Promise(setImmediate);ok(reads===2,'Two bounded initial queries launched');
 const concurrent=await api.GET(request('valid'));ok(concurrent.status===429,'Parallel audit denied');ok(concurrent.headers['retry-after']!=='','Retry-After header emitted');ok(reads===2,'429 causes zero additional Firestore reads');
 finishRoot();const done=await initial;ok(done.status===200&&done.body.ok===true,'First allowed audit completed');ok(done.body.auditGuard?.mode==='instance_only','Limited scope declared, not distributed');ok(done.body.readBudget.queryAttempts===3,'Budget counted correctly');
 const rapid=await api.GET(request('valid'));ok(rapid.status===429,'Rapid repeated audit denied');ok(reads===3,'Cooldown causes no extra reads');
 ok(ownerChecked>=4,'Every HTTP request validates revoked token, including 429');
 // Separate integrity scope, after owner check; 404 response frees permit.
 let infoReads=0;let finishAccount=null;
 const integrityDb={collection:name=>{if(name!=='staff_accounts')throw Error('Unexpected '+name);return {doc:uid=>({get:async()=>{infoReads++;await new Promise(resolve=>{finishAccount=resolve});return {exists:false};}})};}};
 const integrityMocks={...shared,'@/lib/integration/server/admin':{adminDb:integrityDb,adminAuth:shared['@/lib/integration/server/admin'].adminAuth},'@/lib/access/staffReadinessPolicy':{safeUid:uid=>typeof uid==='string'&&uid.startsWith('staff_')},'@/lib/access/staffIntegrityPolicy':{INTEGRITY_AREAS:['home'],INTEGRITY_SAMPLE_LIMIT:12,INTEGRITY_SOURCE_READ_BUDGET:75},'@/lib/access/staffReadBudget':budget};
 const integrity={};new Function('module','exports','require',transpile('app/api/access/integrity/route.ts'))({exports:integrity},integrity,k=>{if(!(k in integrityMocks))throw Error('Unexpected import '+k);return integrityMocks[k];});
 const iq=(token,uid)=>({...request(token),url:'https://demo.invalid/api/access/integrity?uid='+uid});
 const invalid=await integrity.GET(iq('bad','staff_12345678'));ok(invalid.status===403&&infoReads===0,'Integrity rejects nonowner');
 const valid=integrity.GET(iq('valid','staff_12345678'));await new Promise(setImmediate);ok(infoReads===1,'First integrity lookup started');
 const overlap=await integrity.GET(iq('valid','staff_12345678'));ok(overlap.status===429&&infoReads===1,'Second deep inspection rejected without reads');
 finishAccount();const missing=await valid;ok(missing.status===404,'Absent account reported without fake success');
 const cooldown=await integrity.GET(iq('valid','staff_12345678'));ok(cooldown.status===429&&infoReads===1,'Deep audit cooldown applies after 404');
 console.log(`R39 SERVER API: ${pass} behavioral assertions, same-instance duplicate calls cost zero reads.`);
})().catch(e=>{console.error(e);process.exitCode=1});
