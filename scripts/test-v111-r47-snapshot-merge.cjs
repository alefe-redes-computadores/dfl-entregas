#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const input=fs.readFileSync('lib/operation/snapshotMerge.ts','utf8');
const js=ts.transpileModule(input,{fileName:'snapshotMerge.ts',compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const out={};new Function('exports',js)(out);
const {mergeCloudFirstById:merge,mergeDeliveriesPreservingExpansion:deliveryMerge}=out;
let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
function legacy(cloud,local){const merged=[...cloud];for(const item of local){if(!merged.some(x=>x.id===item.id))merged.push(item);}return merged;}
function legacyDelivery(cloud,local){const merged=cloud.map(d=>{const x=local.find(l=>l.id===d.id);return {...d,is_expanded:x?x.is_expanded:false};});for(const l of local){if(!merged.some(x=>x.id===l.id))merged.push(l);}return merged;}
for(let n=0;n<320;n++){
  const cloud=Array.from({length:n%47},(_,i)=>({id:String(i%39),source:'cloud',value:i, is_expanded:(i%2===0)}));
  const local=Array.from({length:(n*7)%49},(_,i)=>({id:String((i*13)%53),source:'local',value:i,is_expanded:i%3===0}));
  const cloudBefore=JSON.stringify(cloud),localBefore=JSON.stringify(local);
  eq(merge(cloud,local),legacy(cloud,local),'merge cloud-first mirrors existing algorithm case '+n);
  eq(deliveryMerge(cloud,local),legacyDelivery(cloud,local),'expansion mirrors existing algorithm case '+n);
  eq(JSON.stringify(cloud),cloudBefore,'cloud untouched '+n);
  eq(JSON.stringify(local),localBefore,'local untouched '+n);
}
const largeCloud=Array.from({length:20000},(_,i)=>({id:`doc${i}`,amount:i,source:'remote'}));
const largeLocal=Array.from({length:20000},(_,i)=>({id:`doc${i+9000}`,amount:i,source:'local'}));
const result=merge(largeCloud,largeLocal);
eq(result.length,29000,'20k + 20k overlap deduped to 29k');
eq(result[10000],largeCloud[10000],'remote authority on overlap');
eq(result[20000],largeLocal[11000],'new local tail order stable');
const expanded=deliveryMerge([{id:'1',remote:true},{id:'2',remote:true}],[{id:'1',remote:false,is_expanded:true},{id:'3',is_expanded:true}]);
eq(expanded,[{id:'1',remote:true,is_expanded:true},{id:'2',remote:true,is_expanded:false},{id:'3',is_expanded:true}],'delivery cloud authority and local visual state');
console.log('R47 MERGE BEHAVIOR: '+checks+' comparisons OK (40k input stress, no network I/O)');
