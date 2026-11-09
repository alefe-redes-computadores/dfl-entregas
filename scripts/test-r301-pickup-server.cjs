'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');const transpile=p=>ts.transpileModule(read(p),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const now=Date.now(),iso=n=>new Date(n).toISOString();const id='dfl-12345678-1234-1234-1234-123456789abc';
const records=new Map([[id,{id,origin:'loja',fulfillment_mode:'pickup',notify_whatsapp:true,
  manual_messaging_opt_in_v1:true,phone:'34999999999',customer_name:'Cliente Canario',created_at:iso(now-3000),customer_charge:25}]]);
const ledger=new Map();let sends=[];let shouldThrow=false;
const db={collection:(name)=>({doc:(key)=>{
  if(name==='deliveries')return {get:async()=>({exists:records.has(key),id:key,data:()=>records.get(key)})};
  assert.equal(name,'manual_pickup_events_v2');return {
    create:async data=>{if(ledger.has(key))throw Object.assign(Error('duplicate'),{code:6});ledger.set(key,{...data});},
    update:async data=>{ledger.set(key,{...ledger.get(key),...data});},
  };
}})};
const phone={normalizeManualMessagePhone:v=>{const n=String(v||'').replace(/\D/g,'');return /^\d{10,11}$/.test(n)?'55'+n:null}};
const load=(p,deps,context={})=>{const exports={};vm.runInNewContext(transpile(p),{exports,require:x=>{if(x in deps)return deps[x];throw Error('import nao previsto '+x)},Date,Math,Number,String,Set,Map,RegExp,console,process:{env},URL,AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{
  sends.push({url,options});if(shouldThrow)throw Error('network unknown');return {ok:true,status:200,json:async()=>({ok:true,queued:true})};},...context},{filename:p,timeout:4500});return exports;};
const env={DFL_MANUAL_PICKUP_ENABLED:'true',DFL_MANUAL_PICKUP_KILL_SWITCH:'false',DFL_MANUAL_PICKUP_SCOPE:'canary',
 DFL_MANUAL_MESSAGING_ENABLED:'true',DFL_MANUAL_MESSAGING_KILL_SWITCH:'false',DFL_MANUAL_MESSAGING_SCOPE:'canary',
 DFL_MESSAGING_PILOT_PHONE_E164:'5534999999999',DFL_MANUAL_MESSAGING_ACTIVATED_AT:iso(now-60_000),
 DFL_SITE_INTEGRATION_URL:'https://dafamilialanches.com.br',DFL_INTEGRATION_SIGNING_SECRET:'R301_TEST_ONLY_SECRET'};
const policy=load('lib/integration/manualPickupPolicy.ts',{'./manualMessagingPolicy':phone});
const server=load('lib/integration/server/manualPickup.ts',{'server-only':{},'node:crypto':crypto,'./admin':{adminDb:db},'../manualPickupPolicy':policy});
const verify=(item,kind)=>{const body=item.options.body,data=JSON.parse(body),h=item.options.headers;
 assert.equal(item.url,'https://dafamilialanches.com.br/api/integration/manual-messaging');
 assert.equal(h['x-dfl-event-id'],data.event_id);
 assert.equal(h['x-dfl-signature'],crypto.createHmac('sha256',env.DFL_INTEGRATION_SIGNING_SECRET).update(`${h['x-dfl-timestamp']}.${body}`,'utf8').digest('hex'));
 assert.equal(data.event_type,kind);assert.equal(data.payload.fulfillment_mode,'pickup');
 assert.equal(data.source,'manual');assert.match(data.payload.transition_key,/^[a-f0-9]{64}$/);
 assert.equal(data.event_id,`manual-msg-v2__${kind}__${id}__${data.payload.transition_key}`);
 assert.equal(data.occurred_at,kind==='order.created'?data.payload.created_at:data.payload.pickup_ready_at);
 return data;};
(async()=>{let c=0;let r=await server.notifyManualPickup(id,'created');assert.equal(r.status,'queued');assert.equal(sends.length,1);verify(sends[0],'order.created');c+=4;
 r=await server.notifyManualPickup(id,'created');assert.equal(r.status,'duplicate');assert.equal(sends.length,1);c+=2;
 records.get(id).pickup_ready_at=iso(now-1000);
 r=await server.notifyManualPickup(id,'ready');assert.equal(r.status,'queued');assert.equal(sends.length,2);verify(sends[1],'order.ready');c+=3;
 r=await server.notifyManualPickup(id,'ready');assert.equal(r.status,'duplicate');assert.equal(sends.length,2);c+=2;
 env.DFL_MANUAL_PICKUP_KILL_SWITCH='true';r=await server.notifyManualPickup(id,'ready');assert.equal(r.status,'off');assert.equal(sends.length,2);c+=2;
 env.DFL_MANUAL_PICKUP_KILL_SWITCH='false';env.DFL_MANUAL_PICKUP_SCOPE='all';r=await server.notifyManualPickup(id,'ready');assert.equal(r.status,'off');c++;
 env.DFL_MANUAL_PICKUP_SCOPE='canary';
 const id2='dfl-87654321-1234-1234-1234-123456789abc';records.set(id2,{...records.get(id),id:id2,pickup_ready_at:undefined});
 shouldThrow=true;r=await server.notifyManualPickup(id2,'created');assert.equal(r.status,'failed');assert.equal(sends.length,3);c+=2;
 shouldThrow=false;r=await server.notifyManualPickup(id2,'created');assert.equal(r.status,'duplicate');assert.equal(sends.length,3);c+=2;
 const id3='dfl-aaaaaaaa-1234-1234-1234-123456789abc';records.set(id3,{...records.get(id),id:id3,pickup_ready_at:undefined});
 const both=await Promise.all([server.notifyManualPickup(id3,'created'),server.notifyManualPickup(id3,'created')]);
 assert.equal(both.filter(x=>x.status==='queued').length,1);assert.equal(both.filter(x=>x.status==='duplicate').length,1);assert.equal(sends.length,4);c+=3;
 const id4='dfl-bbbbbbbb-1234-1234-1234-123456789abc';records.set(id4,{...records.get(id),id:id4,pickup_ready_at:undefined,origin:'keeta'});
 r=await server.notifyManualPickup(id4,'created');assert.equal(r.status,'skipped');assert.equal(sends.length,4);c+=2;
 console.log(`R301 SERVER: ${c} verificacoes de duas fases, HMAC, concorrencia, timeout e kill switch OK. Sem rede real.`);
})().catch(e=>{console.error(e);process.exitCode=1});
