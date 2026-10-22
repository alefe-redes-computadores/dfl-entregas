#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
let checks=0;
function verify(value,message){assert.ok(value,message);checks++}
const date=(delivery)=>delivery.created_at||delivery.createdAt||undefined;
const charge=(delivery)=>Number(delivery.customer_charge??delivery.value??0);
const readModule=(file,stubs)=>{
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{}, {filename:file})((id)=>{
   if(!(id in stubs))throw new Error(`stub ausente: ${id}`);
   return stubs[id];
 },module,module.exports);
 return module.exports;
};
const customers=readModule('lib/customer-analytics.ts',{'@/lib/delivery-finance':{deliveryCustomerCharge:charge},'@/lib/operational-time':{deliveryDate:date}});
const c=[{id:'m1',name:'Maria',origin:'loja'},{id:'m2',name:'Maria',origin:'loja'},{id:'j1',name:'José',origin:'ifood'},{id:'t1',name:'Teste'}];
const d=[
 {id:'a',customer_id:'m1',customer_name:'Maria',value:24,created_at:'2026-10-21T11:00:00Z',completed:true},
 {id:'b',customer_name:'MÁRIA',value:13,customer_charge:10,created_at:'2026-10-20T11:00:00Z',completed:false},
 {id:'c',customer_id:'m2',customer_name:'Maria',value:55,created_at:'2026-10-22T11:00:00Z',completed:true},
 {id:'d',customer_id:'missing',customer_name:'José',value:99},
 {id:'e',customer_name:'Jose',value:18,created_at:'2026-10-20T11:00:00Z'},
 {id:'f',customer_id:'j1',value:777,developer_test:true},
 {id:'g',customer_id:'j1',value:777,exclude_customer_metrics:true},
];
for(let seed=0;seed<12;seed++){
 const index=customers.buildCustomerStatsIndex(c,d.slice(0,seed%8));
 verify(index.size===c.length,'Todos os clientes indexados');
 for(const customer of c){
  const a=customers.getCustomerStats(customer,d.slice(0,seed%8));
  const b=index.get(customer.id);
  verify(JSON.stringify({ids:a.deliveries.map(x=>x.id),count:a.orderCount,done:a.completedCount,total:a.totalValue,last:a.lastOrderAt}) === JSON.stringify({ids:b.deliveries.map(x=>x.id),count:b.orderCount,done:b.completedCount,total:b.totalValue,last:b.lastOrderAt}),`Índice preserva contrato de ${customer.id}`);
 }
}
const inbox=readModule('lib/delivery-inbox.ts',{
 '@/lib/ifood-parser-quality':{assessIfoodParseQuality:()=>({issues:[]})},
});
const mk=(id,ifoodId,orderId,source='ifood')=>({id,source,rawText:'texto',parsed:{ifoodId,orderId,customerName:'M',address:'Rua A'}});
let x=inbox.dedupeInboxImport([mk('1','123','321'),mk('2','123','321'),mk('3','124','322')],[]);
verify(x.unique.length===2&&x.skipped===1,'Mesmo iFood ID dentro do lote é removido');
x=inbox.dedupeInboxImport([mk('1','123','321')],[mk('0','123','321')]);
verify(x.unique.length===0&&x.skipped===1,'Mesmo iFood ID da caixa anterior é ignorado');
x=inbox.dedupeInboxImport([mk('1','',''),mk('2','','')],[]);
verify(x.unique.length===2&&x.skipped===0,'Sem ID: dois pedidos parecidos não são fundidos automaticamente');
x=inbox.dedupeInboxImport([mk('1','','')],[mk('0','','')]);
verify(x.unique.length===0&&x.skipped===1,'Rascunho sem ID reimportado preserva barreira legada');
x=inbox.dedupeInboxImport([mk('1','','345'),mk('2','','345')],[]);
verify(x.unique.length===1&&x.skipped===1,'Pedido com número repetido dentro do lote é deduplicado');
verify(typeof inbox.loadInboxDay==='function'&&typeof inbox.saveInboxDay==='function','Persistência intacta');
console.log(`R40 BUSINESS: ${checks} comparações reais e regressões de importação OK`);
