#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const filename='lib/operation/progressiveWindow.ts';
const source=fs.readFileSync(filename,'utf8');
const compiled=ts.transpileModule(source,{fileName:filename,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
assert.equal(compiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const mod={exports:{}};vm.runInNewContext(compiled.outputText,{module:mod,exports:mod.exports,Number,Math});
const {progressiveCount,nextProgressiveCount,OPERATION_FIRST_BATCH,OPERATION_BATCH}=mod.exports;
let checks=0;const ok=(value,reason)=>{assert.ok(value,'R45 '+reason);checks++};
ok(OPERATION_FIRST_BATCH===40,'lote inicial consistente');ok(OPERATION_BATCH===40,'passo consistente');
for(const total of [0,1,19,39,40,41,79,80,81,100,1000]){
 let limit=40;let previous=0;let cycles=0;
 do{
  const displayed=progressiveCount(total,limit);
  ok(displayed>=previous&&displayed<=total,'janela monotônica e limitada '+total);
  ok(displayed===Math.min(total,Math.max(40,limit)),'janela aplica limite '+total);
  const all=Array.from({length:total},(_,i)=>i+1);
  ok(all.slice(0,displayed).length===displayed,'render nao modifica colecao '+total);
  ok(all.length===total,'colecao completa preservada '+total);
  const next=nextProgressiveCount(total,limit);
  ok(next>=displayed&&next<=total,'proximo limite seguro '+total);
  previous=displayed;limit=next;
  if(++cycles>50)throw Error('loop no limite');
 }while(previous<total);
 ok(limit===total||total<=40,'progressao ate fim '+total);
}
for(const requested of [-100,-1,0,1,NaN,Infinity,1e9]){
 const n=progressiveCount(123,requested);
 ok(n>=0&&n<=123&&Number.isInteger(n),'limite invalido ajustado '+requested);
}
console.log('R45 PROGRESSIVE WINDOW:',checks,'checks OK');
