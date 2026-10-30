'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const file='lib/delivery-inbox.ts';
const source=fs.readFileSync(file,'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const storage=new Map();
const localStorage={
 get length(){return storage.size},
 key(i){return [...storage.keys()][i]??null},
 getItem(k){return storage.has(k)?storage.get(k):null},
 setItem(k,v){storage.set(k,String(v))},
 removeItem(k){storage.delete(k)}
};
const sandbox={exports:{},module:{exports:{}},require(name){
 if(name==='@/lib/ifood-parser-quality')return{assessIfoodParseQuality:()=>({issues:[]})};
 throw Error('Import inesperado no contrato R218: '+name);
},localStorage,window:{},console,Date,Intl,Math,Number,String,JSON,Set,Map};
vm.runInNewContext(output,sandbox,{timeout:3000,filename:file});
const api=sandbox.exports;
assert.equal(typeof api.findInboxDuplicate,'function');
assert.equal(typeof api.cleanupDeliveryInbox,'function');
const parsed={ifoodId:'',orderId:'',customerName:'Cliente Teste',address:'Rua Um, 10',customerCharge:'25,00'};
const delivery={id:'d-1',ifood_id:'',order_id:'',customer_name:'Cliente Teste',address_string:'Rua Um, 10',created_at:'DATA-INVALIDA',customer_charge:25};
assert.equal(api.findInboxDuplicate(parsed,[delivery],'whatsapp'),null,'data invalida nao derruba a Caixa');
assert.equal(api.findInboxDuplicate({...parsed,orderId:'123456'},[{...delivery,order_id:'123456'}],'food99'),null,'ID forte com data invalida nao derruba Caixa');
const key='dfl-delivery-inbox-v1:2020-01-01';
localStorage.setItem(key,'{JSON-CORROMPIDO');
api.cleanupDeliveryInbox('2026-10-30');
assert.equal(localStorage.getItem(key),'{JSON-CORROMPIDO','registro corrompido preservado');
const old='dfl-delivery-inbox-v1:2020-01-02';
localStorage.setItem(old,JSON.stringify({version:1,dayKey:'2020-01-02',drafts:[{status:'launched'}]}));
api.cleanupDeliveryInbox('2026-10-30');
assert.equal(localStorage.getItem(old),null,'registro antigo resolvido ainda e limpo');
const pending='dfl-delivery-inbox-v1:2020-01-03';
localStorage.setItem(pending,JSON.stringify({version:1,dayKey:'2020-01-03',drafts:[{status:'review'}]}));
api.cleanupDeliveryInbox('2026-10-30');
assert.ok(localStorage.getItem(pending),'pendencia antiga preservada');
assert.ok(fs.readFileSync('scripts/pre-apk.cjs','utf8').includes("'scripts/test-r218-premium-closeout.cjs'"),'suite incorporada ao pre-apk');
console.log('R218: 7 contratos comportamentais de integridade offline aprovados');
