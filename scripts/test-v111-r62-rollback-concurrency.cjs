#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const vm=require('node:vm');
const content=fs.readFileSync('lib/operation/optimisticRollback.ts','utf8');
const code=ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const moduleObject={exports:{}};
vm.runInNewContext(code,{module:moduleObject,exports:moduleObject.exports});
const {rollbackAddedEntity:add,rollbackUpdatedEntity:update,rollbackDeletedEntity:remove,rollbackAddedEntities:addMany,rollbackUpdatedEntities:updateMany}=moduleObject.exports;
let checks=0;
function same(actual,expected,label){assert.deepEqual(JSON.stringify(actual),JSON.stringify(expected),label);checks++;}
function sameRef(actual,expected,label){assert.strictEqual(actual,expected,label);checks++;}
const original={id:'a',total:10}, optim={id:'a',total:15}, newA={id:'a',total:20}, other={id:'b',total:42};
same(update([optim,other],original,optim),[original,other],'isolated update reverted');
sameRef(update([newA,other],original,optim)[0],newA,'newer update is not lost');
same(add([optim,other],optim),[other],'optimistic create removed');
same(add([newA,other],optim),[newA,other],'create changed by sync is preserved');
same(remove([other],original,0),[original,other],'deleted restored at old index');
same(remove([newA,other],original,0),[newA,other],'recreated entity is preserved');
const old2={id:'x',total:1},old3={id:'y',total:2}, opt2={id:'x',total:11},opt3={id:'y',total:22}, new3={id:'y',total:99};
same(addMany([opt2,new3,other],[opt2,opt3]),[new3,other],'batch rollback never loses overwritten entity');
same(updateMany([opt2,new3,other],[old2,old3],[opt2,opt3]),[old2,new3,other],'batch rollback keeps concurrent update');
same(updateMany([other],[old2],[opt2]),[other],'batch rollback does not recreate absent entity');
// Every randomized case models two writes overlapping, or a sync response arriving
// between an optimistic write and its rejection. The unaffected objects must retain
// both identity and value. This tests the actual TS module, not a reimplementation.
for(let seed=0;seed<6000;seed++){
 const original={id:'id'+seed,version:0};
 const optimistic={id:'id'+seed,version:1};
 const newer={id:'id'+seed,version:2};
 const stranger={id:'stranger'+seed,version:seed};
 const inserted={id:'fresh'+seed,version:1};
 const updated=update([stranger,seed%2?optimistic:newer,inserted],original,optimistic);
 sameRef(updated[0],stranger,'unrelated identity');
 sameRef(updated[1],seed%2?original:newer,'correct version');
 sameRef(updated[2],inserted,'inserted identity');
 const batch=updateMany([stranger,seed%2?optimistic:newer],[original],[optimistic]);
 sameRef(batch[0],stranger,'batch unrelated identity');
 sameRef(batch[1],seed%2?original:newer,'batch version');
 const afterAdd=addMany([stranger,seed%2?inserted:{...inserted}], [inserted]);
 sameRef(afterAdd[0],stranger,'batch create unrelated');
 assert.equal(afterAdd.length,seed%2?1:2);checks++;
 const afterDelete=remove([stranger],original,1);
 sameRef(afterDelete[0],stranger,'deletion unaffected');
 sameRef(afterDelete[1],original,'deletion restored');
}
// Simulates a real delayed failed call after another screen wrote new records.
async function asyncInterleaving(){
 let state=[original,other];
 state=state.map(x=>x.id==='a'?optim:x);
 const extra={id:'after',total:500};state=[...state,extra];
 await Promise.resolve();
 state=update(state,original,optim);
 same(state,[original,other,extra],'concurrent insert remains after failed update');
}
asyncInterleaving().then(()=>console.log(`R62 ROLLBACK CONCURRENCY: ${checks} checks OK`)).catch(e=>{console.error(e);process.exitCode=1});
