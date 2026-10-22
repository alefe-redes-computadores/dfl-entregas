#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync('lib/operation/optimisticRollback.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const sandboxModule={exports:{}};vm.runInNewContext(js,{module:sandboxModule,exports:sandboxModule.exports});
const {rollbackAddedEntity:add,rollbackUpdatedEntity:update,rollbackDeletedEntity:remove}=sandboxModule.exports;
let checks=0;const eq=(a,b,n)=>{assert.equal(JSON.stringify(a),JSON.stringify(b),n);checks++;};
const a={id:'a',q:1},b={id:'b',q:2},c={id:'c',q:3},d={id:'d',q:4};
eq(add([a,b,c],c),[a,b],'failed new record removed only');
eq(add([a,b,{...c}],c),[a,b,{...c}],'changed target not deleted');
eq(add([a,b,d],c),[a,b,d],'unrelated items preserved');
const newer={id:'a',q:50},updated={id:'a',q:11};
eq(update([updated,b,c],a,updated),[a,b,c],'failed update restored');
eq(update([newer,b,c],a,updated),[newer,b,c],'newer update preserved');
eq(update([b,c,d],a,updated),[b,c,d],'unrelated entities preserved');
eq(remove([a,c,d],b,1),[a,b,c,d],'delete failure restored position');
eq(remove([a,b,d],b,1),[a,b,d],'already restored not duplicated');
eq(remove([a,d],null,1),[a,d],'unknown deletion does not invent record');
// Randomized interleavings: a failed mutation may affect its exact optimistic
// object, but never a concurrent object with a different id or reference.
for(let seed=0;seed<2000;seed++){
 const other={id:'other-'+seed,q:seed};const prior={id:'target',q:seed};const optim={id:'target',q:seed+1};
 const current=[other,optim,{id:'new',q:seed}];
 const rolled=update(current,prior,optim);
 assert.strictEqual(rolled[0],other);assert.strictEqual(rolled[1],prior);assert.strictEqual(rolled[2],current[2]);checks+=3;
 const overwritten={id:'target',q:seed+2};
 const preserved=update([other,overwritten],prior,optim);
 assert.strictEqual(preserved[1],overwritten);checks++;
 const deletion=remove([other],prior,1);
 assert.strictEqual(deletion[0],other);assert.strictEqual(deletion[1],prior);checks+=2;
 const failure=add([other,optim],optim);
 assert.strictEqual(failure[0],other);assert.equal(failure.length,1);checks+=2;
}
// Concurrent async fetch completes after a second unrelated optimistic mutation.
async function simulate(){let state=[a,b];const target={id:'a',q:9};state=state.map(x=>x.id==='a'?target:x);const third={id:'third',q:100};state=[...state,third];state=update(state,a,target);eq(state,[a,b,third],'async failure retained third record');}
simulate().then(()=>console.log(`R61 BEHAVIOR: ${checks} checks OK`)).catch(e=>{console.error(e);process.exitCode=1;});
