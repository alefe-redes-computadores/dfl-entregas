#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let checks=0;function ok(value,label){assert.ok(value,'R46 behavior: '+label);checks++}
function load(file,stubs={}){
 const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}});
 ok(!result.diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error),'parse '+file);
 const mod={exports:{}};vm.runInNewContext(result.outputText,{module:mod,exports:mod.exports,Array,Map,Set,Number,Math,Boolean,String,Object,Promise,Error,RegExp,console,require:(id)=>{if(Object.prototype.hasOwnProperty.call(stubs,id))return stubs[id];throw Error('Unexpected import '+id+' @ '+file)}});
 return mod.exports;
}
const inbox=load('lib/operation/inboxPresentation.ts');
const list=['ready','review','launching','ready','discarded','launched','review','discarded'].map((status,id)=>({id,status}));
const saved=JSON.stringify(list),groups=inbox.classifyInboxDrafts(list);
ok(groups.active.length===5,'active has ready, review, launching');ok(groups.ready.length===2,'ready');ok(groups.review.length===2,'review');ok(groups.launched.length===1,'launched');ok(groups.discarded.length===2,'discarded');ok(groups.active.some(x=>x.status==='launching'),'launching preserved');
for(const [view,n] of [['todos',5],['revisar',2],['prontos',2]])ok(inbox.inboxViewDrafts(groups,view).length===n,'tab '+view);
ok(JSON.stringify(list)===saved,'no mutation of persisted draft array');ok(list.length===8,'no deletion/dedup side effects');
const big=Array.from({length:121},(_,i)=>({id:i,status:i%2===0?'ready':'review'}));
const bigGroups=inbox.classifyInboxDrafts(big);ok(bigGroups.active.length===121,'all draft indexes retained');ok(bigGroups.ready.length===61&&bigGroups.review.length===60,'view counts from all 121 items');
const win=load('lib/operation/progressiveWindow.ts');let count=win.progressiveCount(bigGroups.active.length,40);ok(count===40,'first 40');count=win.nextProgressiveCount(bigGroups.active.length,count);ok(count===80,'next 80');count=win.nextProgressiveCount(bigGroups.active.length,count);ok(count===120,'next 120');count=win.nextProgressiveCount(bigGroups.active.length,count);ok(count===121,'final 121');
const finance=load('lib/delivery-finance.ts');
const pending=load('lib/operation/routeCollection.ts',{
 '@/lib/delivery-finance':finance,
 '@/lib/integration/site-order':{isCancelledSiteDelivery:(d)=>d.source_system==='dfl_site'&&d.site_order_status==='cancelado'},
});
const make=(d={})=>({value:125,customer_charge:91,payment_method:'dinheiro',is_paid:false,source_system:'manual',site_order_status:'',...d});
for(const [name,input,expectedPending,expectedAmount] of [
 ['unpaid cash',make(),true,91],['paid cash',make({is_paid:true}),false,0],
 ['paid state',make({payment_state:'paid'}),false,0],
 ['unpaid pix',make({payment_method:'pix',payment_state:'pending'}),true,91],
 ['card collect',make({payment_method:'cartao_credito',payment_state:'collect_on_delivery'}),true,91],
 ['cancelled',make({source_system:'dfl_site',site_order_status:'cancelado'}),false,0],
 ['missing customer charge',make({customer_charge:undefined}),true,125],
 ['invalid charge',make({customer_charge:NaN}),true,0],
 ['negative charge',make({customer_charge:-100}),true,0],
 ['paid via bool despite stale state',make({is_paid:true,payment_state:'pending'}),false,0],
 ]){const got=pending.routeOutstandingPayment(input);ok(got.pending===expectedPending&&got.amount===expectedAmount,name)}
const testOrders=[make(),make({is_paid:true,value:180}),make({payment_method:'pix',customer_charge:34}),make({source_system:'dfl_site',site_order_status:'cancelado'})];
const total=testOrders.reduce((acc,d)=>acc+pending.routeOutstandingPayment(d).amount,0);ok(total===125,'Rota deve somar 91 + 34, excluindo pago/cancelado');
console.log(`R46 BEHAVIOR: ${checks} tests passed`);
