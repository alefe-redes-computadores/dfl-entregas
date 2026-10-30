'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync('lib/delivery-inbox.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const store=new Map();
const localStorage={
 get length(){return store.size},
 key(i){return [...store.keys()][i]??null},
 getItem(k){return store.get(k)??null},
 setItem(k,v){store.set(k,String(v))},
 removeItem(k){store.delete(k)},
};
const sandbox={exports:{},module:{exports:{}},require(name){
 if(name==='@/lib/ifood-parser-quality')return{assessIfoodParseQuality:()=>({issues:[]})};
 throw Error('Dependencia nao permitida: '+name);
},window:{},localStorage,Date,Intl,Math,Number,String,JSON,Map,Set};
vm.runInNewContext(output,sandbox,{timeout:3000});
const api=sandbox.exports;
const parsed={ifoodId:'',orderId:'123456',customerName:'Cliente',address:'Rua X',phone:'',mapsLink:'',observations:[]};
assert.equal(api.inferInboxSource('Pedido via WhatsApp 123456',parsed),'whatsapp');
assert.equal(api.inferInboxSource('Pedido 99 Food 123456',parsed),'food99');
assert.equal(api.inferInboxSource('Pedido iFood 123456',parsed),'ifood');
assert.equal(api.inferInboxSource('Pedido legado 123456',parsed),'ifood');
assert.equal(api.inferInboxSource('Pedido', {...parsed,ifoodId:'765432'}),'ifood');
const prefix='dfl-delivery-inbox-v1:';
const invalid=prefix+'2026-02-30';
const resolved=prefix+'2020-01-01';
const future=prefix+'2099-01-01';
store.set(invalid,JSON.stringify({drafts:[{status:'launched'}]}));
store.set(resolved,JSON.stringify({drafts:[{status:'launched'}]}));
store.set(future,JSON.stringify({drafts:[{status:'launched'}]}));
api.cleanupDeliveryInbox('2026-10-30');
assert.ok(store.has(invalid),'data impossivel preservada');
assert.ok(!store.has(resolved),'antigo resolvido removido');
assert.ok(store.has(future),'futuro preservado');
assert.ok(fs.readFileSync('scripts/pre-apk.cjs','utf8').includes("'scripts/test-r219-final-guard.cjs'"));
console.log('R219: 9 contratos de origem e retencao local aprovados');
