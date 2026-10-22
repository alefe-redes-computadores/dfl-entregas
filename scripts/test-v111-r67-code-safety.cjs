#!/usr/bin/env node
'use strict';
const fs=require('node:fs'), assert=require('node:assert/strict'), Module=require('node:module'), ts=require('typescript');
const file='lib/operation/ifoodOrderCode.ts';
const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;mod._compile(output,file);
const {orderConfirmationCode}=mod.exports;
let checks=0;
for(let i=0;i<10000;i++){
 const valid=String(i).padStart(4,'0');
 assert.equal(orderConfirmationCode(valid),valid);checks++;
 assert.equal(orderConfirmationCode(' '+valid.slice(0,2)+'-'+valid.slice(2)+' '),valid);checks++;
 assert.equal(orderConfirmationCode(valid+'5'),'');checks++;
 assert.equal(orderConfirmationCode('9'+valid),'');checks++;
}
for(const invalid of ['',null,undefined,'abc','123','12345678','1 2 3 4 5','12a','1.2']){
 assert.equal(orderConfirmationCode(invalid),'');checks++;
}
const card=fs.readFileSync('components/home/DeliveryCard.tsx','utf8');
assert(card.includes('groupedDeliveries.every('));checks++;
assert(card.includes("item.origin === 'ifood'"));checks++;
assert(card.includes('orderConfirmationCode(item.confirmation_code)'));checks++;
console.log('R67 CODIGO IFOOD: '+checks+' cenarios, sem truncar 5 digitos');
