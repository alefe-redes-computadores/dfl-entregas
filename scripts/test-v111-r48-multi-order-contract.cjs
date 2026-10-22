#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript'),vm=require('vm');
const source=fs.readFileSync('lib/operation/multiOrderDraft.ts','utf8');
const compiled=ts.transpileModule(source,{fileName:'multiOrderDraft.ts',compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const moduleExports={};vm.runInNewContext(compiled.outputText,{exports:moduleExports,require},{timeout:1500});
const {firstMultiOrderIssue}=moduleExports;
let checks=0;const base=(n)=>({id:'draft-'+n,orderId:String(1000+n),ifoodId:String(10000000+n),confirmationCode:String(5000+n),customerCharge:'20,00'});
function equal(actual,expected,label){assert.equal(actual,expected,label);checks++}
for(let n=1;n<=140;n++){const drafts=Array.from({length:n},(_,i)=>base(i+1));equal(firstMultiOrderIssue(drafts),null,'válidos '+n);}
for(let n=2;n<=80;n++){
 const drafts=Array.from({length:n},(_,i)=>base(i+1));
 drafts[n-1]={...drafts[n-1],orderId:drafts[0].orderId};equal(firstMultiOrderIssue(drafts).kind,'duplicate_order','numero repetido '+n);
 drafts[n-1]={...drafts[n-1],orderId:String(9000+n),ifoodId:drafts[0].ifoodId};equal(firstMultiOrderIssue(drafts).kind,'duplicate_ifood_id','id repetido '+n);
}
for(const [patch,kind] of [[{orderId:''},'order_required'],[{ifoodId:'12'},'invalid_ifood_id'],[{confirmationCode:'123'},'invalid_confirmation'],[{customerCharge:''},'charge_required']]){
 const row={...base(1),...patch};equal(firstMultiOrderIssue([row]).kind,kind,kind);
}
const separate=[{...base(1),confirmationCode:'1234',customerCharge:'10,00'},{...base(2),confirmationCode:'5678',customerCharge:'85,00'}];equal(firstMultiOrderIssue(separate),null,'códigos distintos válidos');
const blankCode=[{...base(1),confirmationCode:''}];equal(firstMultiOrderIssue(blankCode),null,'sem confirmação ainda válida');
console.log('R48 MULTIPEDIDOS: '+checks+' cenários de validação sem mutar rascunhos');
