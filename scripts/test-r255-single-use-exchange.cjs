/* DFL R255 — Offline single-use exchange regression. No network/real Firestore/messages. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
let assertions = 0;
const ok = (value, label) => { assert.ok(value, label); assertions++; };
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); assertions++; };
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
const cloned = v => v === undefined ? undefined : structuredClone(v);
function loaded(filename, mocks) {
  const src = fs.readFileSync(filename, 'utf8');
  const code = ts.transpileModule(src, {fileName: filename,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const mod = {exports:{}};
  const req = id => id === 'server-only' ? {} : Object.hasOwn(mocks,id) ? mocks[id] : require(id);
  new Function('require','module','exports',code)(req,mod,mod.exports);
  return mod.exports;
}
const records = new Map();
let tail = Promise.resolve();
let failNextCommit = false;
const snapshot = (path, value) => ({id:path.split('/').at(-1),exists:value !== undefined,data:()=>cloned(value)});
class Doc {
  constructor(path){this.path=path;this.id=path.split('/').at(-1);}
  async get(){return snapshot(this.path, records.get(this.path));}
  collection(name){return new Collection(this.path+'/'+name);}
}
class Collection {
  constructor(path, sort='at', direction='desc', max=500){this.path=path;this.sort=sort;this.direction=direction;this.max=max;}
  doc(id){return new Doc(this.path+'/'+id);}
  orderBy(name,direction){return new Collection(this.path,name,direction,this.max);}
  limit(n){return new Collection(this.path,this.sort,this.direction,n);}
  async get(){const arr=[];for(const [path,value] of records){
    if(!path.startsWith(this.path+'/') || path.slice(this.path.length+1).includes('/'))continue;
    arr.push(snapshot(path,value));
  }
  arr.sort((a,b)=>String(a.data()?.[this.sort]).localeCompare(String(b.data()?.[this.sort]))*(this.direction==='desc'?-1:1));
  const docs=arr.slice(0,this.max);return {docs,size:docs.length};}
}
const adminDb = {
  collection:name=>new Collection(name),
  runTransaction(fn){
    // Serial, atomic in-memory executor: all writes commit together or none do.
    const previous=tail;
    let done;tail=new Promise(resolve=>{done=resolve;});
    return previous.then(async()=>{
      const staged=[];
      const tx={
        get:async ref=>snapshot(ref.path,records.get(ref.path)),
        set:(ref,data)=>staged.push(['set',ref.path,cloned(data)]),
        update:(ref,data)=>staged.push(['update',ref.path,cloned(data)]),
        create:(ref,data)=>staged.push(['create',ref.path,cloned(data)]),
      };
      const value=await fn(tx);
      if(failNextCommit){failNextCommit=false;throw Error('SIMULATED_FIRESTORE_COMMIT_ABORT');}
      const copy=new Map(records);
      for(const [verb,path,payload] of staged){
        const existing=copy.get(path);
        if(verb==='create' && existing!==undefined)throw Error('already exists');
        if(verb==='update' && existing===undefined)throw Error('update missing');
        copy.set(path,verb==='update'?{...existing,...payload}:payload);
      }
      records.clear();for(const [path,val] of copy)records.set(path,val);
      return value;
    }).finally(done);
  },
};
const core = loaded('lib/tracking/gate1/core.ts',{});
const security = {
  hexSha256:hash, randomSecret:()=>crypto.randomBytes(32).toString('base64url'),
  trackingCodeEnabled:()=>false,trackingCustomerEnabled:()=>false, trackingTenant:()=>null,
};
const storage = loaded('lib/tracking/gate1/storage.ts',{
  '@/lib/integration/server/admin':{adminDb},'./security':security,'./core':core,
});
const tenant='companyAlpha';
const cap={tenant,mode:'OFF',kill_switch:true,public_tracking:false,issue_tracking_link:false,
  show_courier:false,show_position:false,eligible_origins:['dfl_site'],event_modes:{}};
function documentId(grant){return grant.grant_id;}
const day = new Date().toISOString();
for(const id of ['orderA','orderB']){
  records.set('deliveries/'+id,{tenant_id:tenant,source_system:'dfl_site',external_order_id:id,created_at:day,
    site_order_status:'Confirmado',customer_name:'NOME PRIVADO',phone:'34999999999',address_string:'Rua Privada'});
  records.set('tracking_event_ledgers_v1/'+hash(tenant+'|site:'+id)+'/events/e1',{
    id:'e1',event_id:'e1',kind:'confirmed',at:day,revision:1,source:'dfl_site',actor_uid:null,causation_id:null,
  });
}
async function issue(id,key='issue-'+id+'-test'){
  const res=await storage.issueGrant({tenant,deliveryId:id,actorUid:'owner',idempotencyKey:key,ttlMinutes:60,c:cap});
  eq(res.state,'issued','new grant '+id);ok(/^[A-Za-z0-9_-]{43}$/.test(res.token),'one-time token is random 256bit');
  const idx=records.get('tracking_token_index_v1/'+hash(res.token));
  const grant=records.get('tracking_grants_v1/'+documentId(res));
  eq(idx.exchange_policy,'single_use_v1','token requires protocol policy');
  eq(grant.exchange_policy,'single_use_v1','grant requires protocol policy');
  eq(idx.grant_generation,grant.generation,'index bound to grant generation');
  ok(!JSON.stringify([...records.values()]).includes(res.token),'plain token never stored');
  return res;
}
const main=async()=>{
  const a=await issue('orderA');
  const before=records.size;
  eq(await storage.exchangeToken('otherTenant',a.token),null,'wrong tenant cannot consume');
  eq(records.size,before,'wrong tenant does not create records');
  eq(await storage.exchangeToken(tenant,a.token+'x'),null,'tampered token cannot consume');
  const sess=await storage.exchangeToken(tenant,a.token);
  ok(sess&&/^[A-Za-z0-9_-]{43}$/.test(sess.session_token),'exchange returns opaque session');
  const idx=records.get('tracking_token_index_v1/'+hash(a.token));
  ok(typeof idx.consumed_at==='string','consumption persisted');
  eq(await storage.exchangeToken(tenant,a.token),null,'replaying valid token denied');
  const active=await storage.querySession(tenant,sess.session_token,cap);
  ok(active&&core.validatePublicProjection(active),'legitimate session remains readable after replay denied');
  eq(await storage.querySession('otherTenant',sess.session_token,cap),null,'session tenant isolated');
  const revoked=await storage.revokeGrant({tenant,grantId:a.grant_id,actorUid:'owner',reason:'admin_action',idempotencyKey:'r-a'});
  eq(revoked.state,'revoked','grant revoked');
  eq(await storage.querySession(tenant,sess.session_token,cap),null,'revoked active session denied');
  eq(await storage.exchangeToken(tenant,a.token),null,'revoked token still denied');

  const b=await issue('orderB');
  const claims=await Promise.all(Array.from({length:40},()=>storage.exchangeToken(tenant,b.token)));
  eq(claims.filter(Boolean).length,1,'40 concurrent claims yield exactly one session');
  const storedSessions=[...records.keys()].filter(p=>p.startsWith('tracking_sessions_v1/'));
  eq(storedSessions.length,2,'exactly two sessions from two grants');
  ok(claims.find(Boolean).session_token!==sess.session_token,'distinct sessions cannot collide');
  eq(await storage.exchangeToken(tenant,b.token),null,'concurrency result remains consumed');

  const bRevoked=await storage.revokeGrant({tenant,grantId:b.grant_id,actorUid:'owner',reason:'admin_action',idempotencyKey:'r-b'});
  eq(bRevoked.state,'revoked','second grant revocation');
  const bAgain=await issue('orderB','reissued-orderB');
  ok(bAgain.token !== b.token,'reissued grant has a new secret');
  eq(await storage.exchangeToken(tenant,b.token),null,'old token not valid after new generation');
  const beforeCrash=records.size;
  failNextCommit=true;
  eq(await storage.exchangeToken(tenant,bAgain.token),null,'Firestore transaction error never grants access');
  eq(records.size,beforeCrash,'failed transaction does not persist a session');
  const idxAfterError=records.get('tracking_token_index_v1/'+hash(bAgain.token));
  ok(!Object.hasOwn(idxAfterError,'consumed_at'),'failed transaction did not consume token');
  const afterCrash=await storage.exchangeToken(tenant,bAgain.token);
  ok(afterCrash&&afterCrash.session_token,'unconsumed token can be exchanged after transaction abort');
  eq(await storage.exchangeToken(tenant,bAgain.token),null,'atomic recovery still single-use');
  const againRevoked=await storage.revokeGrant({tenant,grantId:bAgain.grant_id,actorUid:'owner',reason:'policy_change',idempotencyKey:'r-b-again'});
  eq(againRevoked.state,'revoked','reissue revoked');
  const legacy=await issue('orderB','legacy-old-format');
  const legacyIndexPath='tracking_token_index_v1/'+hash(legacy.token);
  const legacyIndex={...records.get(legacyIndexPath)};
  delete legacyIndex.exchange_policy;
  records.set(legacyIndexPath,legacyIndex);
  eq(await storage.exchangeToken(tenant,legacy.token),null,'legacy token without single-use proof refused');
  ok(!Object.hasOwn(records.get(legacyIndexPath),'consumed_at'),'legacy refusal does not create false usage');
  const legacyGrantPath='tracking_grants_v1/'+legacy.grant_id;
  const originalGrant=records.get(legacyGrantPath);
  records.set(legacyIndexPath,{...legacyIndex,exchange_policy:'single_use_v1'});
  records.set(legacyGrantPath,{...originalGrant,exchange_policy:'legacy_v0'});
  eq(await storage.exchangeToken(tenant,legacy.token),null,'legacy grant without policy refused');
  records.set(legacyGrantPath,originalGrant);
  const tamperedGeneration={...records.get(legacyIndexPath),grant_generation:999999};
  records.set(legacyIndexPath,tamperedGeneration);
  eq(await storage.exchangeToken(tenant,legacy.token),null,'mismatched grant generation refused');
  // No client access flag is set; tests run against fictitious data only.
};
main().then(()=>console.log(`R255 SINGLE_USE: ${assertions} checks PASS; no network/Firestore/WhatsApp`)).catch(e=>{console.error('R255 BLOQUEADO',e);process.exitCode=1});
