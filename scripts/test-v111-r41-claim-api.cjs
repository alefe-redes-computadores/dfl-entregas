#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const assert=require('node:assert/strict');
const api=fs.readFileSync('app/api/access/claim/route.ts','utf8');
const js=ts.transpileModule(api,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const ownerUid='zIfbMxD1SQNvtlX9y6YUsEz2TXC3',userUid='test-motoboy-2026';
let reads=0,writes=0;const claims=new Map(),db={status:'rascunho',activation:'not_enabled',email:'moto@example.com',role:'motoboy',linkedMotoboyId:'moto12345'};
let verified=true,validOrigin=true,tokenUid=userUid,registered=true;
const account={exists:false,data:()=>({})};
let claimStatus='pending',staleOnCommit=false,transactionCalls=0, authProvider='google.com';
const auth={verifyIdToken:async(_token,checkRevoked)=>{assert.equal(checkRevoked,true);return {uid:tokenUid,email:'moto@example.com',email_verified:verified,firebase:{sign_in_provider:authProvider}};},getUser:async(uid)=>({uid,email:'moto@example.com',emailVerified:verified,disabled:false,providerData:[{providerId:'google.com'}]})};
const draftRef={kind:'draft',id:'staff-test1234',get:async()=>({exists:true,data:()=>db})};
const accountRef={kind:'account',id:userUid};
const claimRef={kind:'claim',id:userUid};
const docs={
 runTransaction: async callback=>{
  transactionCalls++;
  const staged=[];
  const tx={
   get:async(ref)=>{
    if(ref.kind==='draft')return {exists:true,data:()=>({...db,...(staleOnCommit?{status:'revogado'}:{})})};
    if(ref.kind==='account')return account;
    if(ref.kind==='claim')return {exists:claims.has(ref.id),data:()=>claims.get(ref.id)};
    throw new Error('UNKNOWN TX REF '+ref.kind);
   },
   create:(ref,value)=>staged.push([ref.id,value]),
  };
  const result=await callback(tx);
  for(const [id,value] of staged){assert.ok(!claims.has(id),'tx create must not overwrite');claims.set(id,value);writes++;}
  return result;
 },
 collection:(name)=>{
  if(name==='staff_access_drafts')return {
   where:(_key,_eq,email)=>({limit:(n)=>({get:async()=>{reads++;assert.equal(n,2);return{docs:registered&&email==='moto@example.com'?[{id:'staff-test1234',data:()=>db}]:[]}}})}),
   doc:()=>draftRef,
  };
  if(name==='staff_accounts')return {doc:()=>accountRef};
  if(name==='staff_link_requests')return {
    doc:()=>claimRef,
    where:(_key,_eq,email)=>({limit:(n)=>({get:async()=>{assert.equal(n,10);return{docs:[...claims.entries()].filter(([,v])=>v.email===email).map(([id,value])=>({id,data:()=>value}))}}})}),
  };
  throw new Error('UNEXPECTED COLLECTION '+name);
 }};

const mod={exports:{}};
const stubs={
 'next/server':{NextResponse:{json:(data,opts)=>({body:data,status:opts?.status||200,headers:opts?.headers||{}})}},
 '@/lib/integration/server/admin':{adminAuth:auth,adminDb:docs},
 '@/lib/access/roles':{isSuperadminUid:(uid)=>uid===ownerUid},
 '@/lib/access/staffClaimPolicy':{claimableDraft:(draft,email)=>draft.email===email&&draft.status==='rascunho'&&draft.activation==='not_enabled'&&!!draft.linkedMotoboyId,
 claimableIdentity:(uid,email,verified,disabled)=>uid!==ownerUid&&verified&&!disabled&&!!email,
 claimOriginAllowed:(origin,request)=>validOrigin&&origin==='https://staff.dfl.example'&&request===origin},
};
vm.runInNewContext(js,{module:mod,exports:mod.exports,require:(m)=>{if(!stubs[m])throw new Error('MODULE '+m);return stubs[m]},process:{env:{DFL_STAFF_LINK_REQUESTS_ENABLED:'true'}},console,Date,URL,Set,Number,String,Error},{filename:'claim-route.js'});
const apiFns=mod.exports;const req=(origin='https://staff.dfl.example',url='https://staff.dfl.example/api/access/claim?draftId=staff-test1234')=>({headers:{get:(k)=>k==='authorization'?'Bearer token':k==='origin'?origin:''},nextUrl:Object.assign(new URL(url),{ }),json:async()=>({role:'superadmin',targetUid:ownerUid})});
let total=0;const check=(v,msg)=>{assert.ok(v,msg);total++};
(async()=>{
 let result=await apiFns.POST(req('https://admin.dfl.example'));check(result.status===403,'Admin origin must not submit');check(writes===0,'No writes on bad origin');
 validOrigin=false;result=await apiFns.POST(req());check(result.status===403,'Configured origin required');validOrigin=true;
 tokenUid=ownerUid;result=await apiFns.POST(req());check(result.status===403,'Owner not allowed to claim');tokenUid=userUid;
 verified=false;result=await apiFns.POST(req());check(result.status===403,'Unverified email denied');verified=true;
 registered=false;result=await apiFns.POST(req());check(result.status===403,'No invitation denied');registered=true;
 result=await apiFns.POST(req());check(result.status===200 && result.body.state==='pending','Invitation creates pending claim');check(writes===1,'Exactly one write');
 check(claims.get(userUid).uid===userUid&&claims.get(userUid).draftId==='staff-test1234','Server determines UID and draft');
 check(!JSON.stringify(claims.get(userUid)).includes('permissions'),'Do not copy permissions');
 result=await apiFns.POST(req());check(result.status===200&&writes===1,'Repeat pending request idempotent, no write');
 check(transactionCalls===2,'Transaction rereads draft, account and existing claim');
 claims.get(userUid).status='reviewed';result=await apiFns.POST(req());check(result.status===409&&writes===1,'Reviewed request never becomes pending again');
 claims.get(userUid).status='pending';staleOnCommit=true;claims.delete(userUid);result=await apiFns.POST(req());check(result.status===409&&writes===1,'Revoked draft between lookup and commit blocked');staleOnCommit=false;
 result=await apiFns.POST(req());check(result.status===200&&writes===2,'Valid fresh invitation allowed');
 authProvider='password';result=await apiFns.POST(req());check(result.status===403&&writes===2,'Non Google provider denied');authProvider='google.com';
 tokenUid=userUid;result=await apiFns.GET(req());check(result.status===403,'Staff cannot list claims');
 tokenUid=ownerUid;result=await apiFns.GET(req('https://admin.dfl.example','https://admin.dfl.example/api/access/claim?draftId=staff-test1234'));
 check(result.status===200&&result.body.claims.length===1,'Owner only matching bounded claim');
 result=await apiFns.GET(req('https://admin.dfl.example','https://admin.dfl.example/api/access/claim?draftId=../bad'));
 check(result.status===400,'Invalid ID denied');
 check(writes===2,'GET never writes');
 console.log('R41 CLAIM API:',total,'behavioral contracts OK');
})().catch(error=>{console.error(error);process.exitCode=1});
