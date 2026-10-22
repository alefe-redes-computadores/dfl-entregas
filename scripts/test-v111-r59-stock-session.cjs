#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const code=fs.readFileSync('lib/operation/stockCountDraft.ts','utf8');
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,strict:true}}).outputText;
const mod={exports:{}};
const parse=(raw)=>{const value=raw.trim().replace(/\s+/g,'');if(!value)return 0;const cleaned=value.replace(/[^0-9.,-]/g,'');const sign=cleaned.startsWith('-')?-1:1;const unsigned=cleaned.replace(/-/g,'');if(!unsigned)return 0;const c=unsigned.lastIndexOf(','), d=unsigned.lastIndexOf('.');const ix=Math.max(c,d);if(ix<0)return sign*(Number(unsigned)||0);return sign*(Number(unsigned.slice(0,ix).replace(/[.,]/g,'')+'.'+unsigned.slice(ix+1).replace(/[.,]/g,''))||0)};
vm.runInNewContext(js,{exports:mod.exports,require:(name)=>{assert.equal(name,'@/lib/stock-quantity');return {parseStockQuantityInput:parse};}},{filename:'stockCountDraft.js',timeout:2000});
const {stockCountDraftState:state,reviewStockCountDraft:review}=mod.exports;
let assertions=0;
function check(test,description){assert.ok(test,'R59: '+description);assertions++}
for(const [current,raw,baseline,touched,changed,conflict,display,expected] of [
 [11,'10',10,false,false,false,'11',11],
 [11,'12',10,true,true,true,'12',10],
 [10,'12',10,true,true,false,'12',10],
 [10,'10',10,false,false,false,'10',10],
 [10,undefined,undefined,false,false,false,'10',10],
 [15,'15',12,true,false,true,'15',12],
 [10,'12',undefined,true,true,true,'12',10],
 [10,'9,5',10,true,true,false,'9,5',10],
]){
 const v=state(current,raw,baseline);
 check(v.touched===touched,'touched');check(v.changed===changed,'changed');check(v.conflict===conflict,'conflict');check(v.display===display,'display');check(v.expectedQuantity===expected,'expected');
}
const testProducts=[{id:'A',current_quantity:11},{id:'B',current_quantity:10},{id:'C',current_quantity:12}];
const r=review(testProducts,{A:'10',B:'8',C:'14'},{A:10,B:10,C:10});
check(r.changed.map(p=>p.id).join(',')==='B,C','only genuinely edited stock is changed');
check(r.conflicts.map(p=>p.id).join(',')==='C','conflict detected for edited product');
for(let i=0;i<2000;i++){
 const base=i%97,current=(i%4===0?base+1:base),entered=(i%5===0?base+2:base);
 const s=state(current,String(entered),base);
 const touched=entered!==base;
 check(s.touched===touched,'random touched');
 check(s.changed===(touched&&entered!==current),'random changed');
 check(s.conflict===(touched&&current!==base),'random conflict');
 check(s.expectedQuantity===(touched?base:current),'random baseline');
}
console.log(`R59 STOCK COUNT: ${assertions} cenários aprovados`);
