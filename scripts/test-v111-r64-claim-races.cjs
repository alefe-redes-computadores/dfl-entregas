#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('app/api/access/claim/route.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const owner='zIfbMxD1SQNvtlX9y6YUsEz2TXC3',uid='r64-unique-user-01',draftId='r64-draft-original';
const draft={email:'staff@example.com',status:'rascunho',activation:'not_enabled',role:'compras'};
let accountData=null,invited=true,identityProvider='google.com',beforeCommit=null,writeCount=0,txCount=0,readCount=0;
const claim=new Map();let turn=Promise.resolve();
const docs={
 collection:(name)=>{
  if(name==='staff_access_drafts')return {
   where:(key,op,email)=>({limit:n=>({get:async()=>{assert.equal(n,2);assert.equal(email,draft.email);return{docs:invited?[{id:draftId,data:()=>draft}]:[]}}})}),
   doc:id=>({kind:'draft',id,get:async()=>({exists:true,data:()=>draft})})
  };
  if(name==='staff_accounts')return {doc:id=>({kind:'account',id})};
  if(name==='staff_link_requests')return {
   doc:id=>({kind:'claim',id}),
   where:()=>({limit:n=>({get:async()=>({docs:[...claim.entries()].map(([id,value])=>({id,data:()=>value}))})})})
  };
  throw new Error('Unexpected collection '+name);
 },
 runTransaction:callback=>{
  // Serialize mock transactions; writes commit only after all reads, like Firestore concurrency semantics.
  const execute=async()=>{
   txCount++;
   if(beforeCommit){const action=beforeCommit;beforeCommit=null;action();}
   const prepared=[];
   const tx={get:async ref=>{
    readCount++;
    if(ref.kind==='draft')return{exists:invited,data:()=>({...draft})};
    if(ref.kind==='account')return{exists:accountData!==null,data:()=>accountData};
    if(ref.kind==='claim')return{exists:claim.has(ref.id),data:()=>claim.get(ref.id)};
    throw new Error('Bad ref');
   },create:(ref,value)=>prepared.push([ref.id,value])};
   const result=await callback(tx);
   for(const [key,value] of prepared){assert.ok(!claim.has(key),'transaction cannot overwrite');claim.set(key,value);writeCount++;}
   return result;
  };
  const current=turn.then(execute);turn=current.catch(()=>{});return current;
 }
};
const auth={verifyIdToken:async(value,checkRevoked)=>{assert.equal(checkRevoked,true);return{uid,email:draft.email,email_verified:true,firebase:{sign_in_provider:identityProvider}}},getUser:async id=>({uid:id,email:draft.email,emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]})};
const stubs={
 'next/server':{NextResponse:{json:(body,options)=>({body,status:options.status})}},
 '@/lib/integration/server/admin':{adminAuth:auth,adminDb:docs},
 '@/lib/access/roles':{isSuperadminUid:x=>x===owner},
 '@/lib/access/staffClaimPolicy':{
   claimableDraft:(value,email)=>value.status==='rascunho'&&value.activation==='not_enabled'&&value.email===email,
   claimableIdentity:(id,email,verified,disabled)=>id!==owner&&verified&&!disabled&&!!email,
   claimOriginAllowed:(from,to)=>from===to&&from==='https://team.dfl.example'
 }
};
const mod={exports:{}};vm.runInNewContext(code,{exports:mod.exports,module:mod,require:key=>{assert.ok(stubs[key],key);return stubs[key]},process:{env:{DFL_STAFF_LINK_REQUESTS_ENABLED:'true'}},Date,console,Set,URL},{filename:'r64-claim-route.js'});
const api=mod.exports,request=()=>({headers:{get:key=>key==='origin'?'https://team.dfl.example':key==='authorization'?'Bearer test':''},nextUrl:new URL('https://team.dfl.example/api/access/claim')});
let n=0;const check=(v,name)=>{assert.ok(v,name);n++};
(async()=>{
 const [one,two]=await Promise.all([api.POST(request()),api.POST(request())]);
 check(one.status===200&&two.status===200,'Concurrent same-user requests idempotently succeed');
 check(writeCount===1,'Concurrent claims create exactly once');
 check(txCount===2&&readCount===6,'Every attempt reads fresh draft, account, and claim transactionally');
 check(claim.get(uid).uid===uid&&claim.get(uid).draftId===draftId,'Authoritative UID/draft bound, never from body');
 claim.get(uid).status='reviewed';
 check((await api.POST(request())).status===409,'Reviewed claim never reopened');
 check(writeCount===1,'No re-open write');
 claim.delete(uid);beforeCommit=()=>{draft.status='revogado'};
 check((await api.POST(request())).status===409,'Revocation between query and transaction denied');
 check(!claim.has(uid),'Revocation leaves no pending claim');draft.status='rascunho';
 beforeCommit=()=>{accountData={draftId,status:'active'}};
 check((await api.POST(request())).status===409,'Active account created between query and commit denied');
 check(!claim.has(uid),'Existing active account never causes pending write');accountData=null;
 identityProvider='password';check((await api.POST(request())).status===403,'Non-Google login denied');identityProvider='google.com';
 invited=false;check((await api.POST(request())).status===403,'Uninvited account denied');invited=true;
 check((await api.POST(request())).status===200,'Valid claim still works after conflicts');
 check(writeCount===2,'Exactly two valid claim writes total');
 const before=writeCount;check((await api.POST(request())).status===200&&writeCount===before,'Pending retry remains stable');
 console.log('R64 CLAIM RACES:',n,'behavioral assertions OK');
})().catch(error=>{console.error(error);process.exitCode=1});
