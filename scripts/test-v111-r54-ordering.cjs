#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
const ts=require('typescript');
function load(file,mocks={}){const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;const exports={};vm.runInNewContext(js,{exports,require:(id)=>{if(id in mocks)return mocks[id];throw new Error(`Unexpected import ${id}`)},Promise,Set,Map,Date,Math,Number,Object,Boolean,String}, {filename:file});return exports;}
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
async function run(){
 const {createSerializedWriteQueue}=load('lib/store/serializedWriteQueue.ts');
 for(let n=0;n<64;n++){
  const serial=createSerializedWriteQueue();const first=deferred();const history=[];
  const a=serial('old',async x=>{history.push(`start-${x}`);await first.promise;history.push(`end-${x}`)});
  const b=serial('new',async x=>{history.push(`start-${x}`);history.push(`end-${x}`)});
  await Promise.resolve();await Promise.resolve();ok(!history.includes('start-new'),'new write never starts before old finishes');
  first.resolve();await Promise.all([a,b]);ok(history.join('|')==='start-old|end-old|start-new|end-new','writes ordered under inverted latency');
 }
 for(let n=0;n<40;n++){
  const serial=createSerializedWriteQueue();let writes=[];
  const first=serial('broken', async x=>{writes.push(x);throw new Error('offline')});
  const second=serial('recovered', async x=>{writes.push(x)});
  await assert.rejects(first,/offline/);await second;
  ok(writes.join('|')==='broken|recovered','failure does not poison future writes');
 }
 const {siteIntegrationStages}=load('lib/site-integration-health.ts',{'@/lib/integration/site-order':{isCancelledSiteDelivery:(d)=>d.site_order_status==='cancelado'}});
 const route={id:'route-1',started_at:null,departure_time:null};
 const delivery={route_id:'route-1',completed:false,site_order_status:'pendente'};
 const phases=siteIntegrationStages(delivery,route);ok(phases[1].done===true && phases[2].done===false,'assigned is not departed');
 const departed=siteIntegrationStages(delivery,{...route,started_at:'2026-10-21T17:00:00Z'});ok(departed[2].done===true,'departure timestamp governs route stage');
 const missing=siteIntegrationStages(delivery);ok(missing[1].done===false && missing[2].done===false,'orphaned route ID not considered delivered');
 const mismatch=siteIntegrationStages(delivery,{...route,id:'other-route',started_at:'now'});ok(mismatch[1].done===false && mismatch[2].done===false,'wrong route cannot prove status');
 const canceled=siteIntegrationStages({...delivery,site_order_status:'cancelado',completed:true}, {...route,started_at:'now'});ok(canceled[1].done===false&&canceled[2].done===false&&canceled[3].done===false,'canceled not marked operational completion');
 const completed=siteIntegrationStages({...delivery,completed:true,completed_at:'2026-10-21T17:20:00Z'}, {...route,started_at:'now'});ok(completed[3].done===true && completed[3].at==='2026-10-21T17:20:00Z','actual completion stays recorded');
 console.log(`R54 BEHAVIOR: ${checks} assertions passed`);
}
run().catch(error=>{console.error(error);process.exitCode=1});
