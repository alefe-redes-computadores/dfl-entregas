#!/usr/bin/env node
'use strict';
/** R299 P1 — testes comportamentais locais, sem Firebase, WhatsApp ou rede. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
let n=0;
function check(value,label) { assert.ok(value,`R299 P1: ${label}`); n++; }
function eq(value,expected,label) {assert.deepEqual(value,expected,`R299 P1: ${label}`);n++;}
const read=p=>fs.readFileSync(p,'utf8');
function load(p,mocks={}) {
 const source=read(p);
 const ast=ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 eq(ast.parseDiagnostics.length,0,'AST '+p+': '+ast.parseDiagnostics.map(x=>x.messageText).join(' / '));
 const output=ts.transpileModule(source,{fileName:p,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 eq((output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,'transpile '+p);
 const mod=new Module(path.resolve(p),module);mod.filename=path.resolve(p);mod.paths=module.paths;
 const orig=mod.require.bind(mod);mod.require=key=>Object.hasOwn(mocks,key)?mocks[key]:orig(key);
 mod._compile(output.outputText,mod.filename);return mod.exports;
}
const parser=load('lib/ifood-order-parser.ts',{'@/lib/operational-address':{canonicalizeOperationalAddress:(v)=>({address:String(v||''),observations:[]})}});
const cases=[
 ['Ana P. 2255 75400962', '2255','75400962','Ana P.'],
 ['Ana P. 75400962 2255','2255','75400962','Ana P.'],
 ['Ana P.\n75400962\n2255','2255','75400962','Ana P.'],
 ['Ana P.\n2255 75400962','2255','75400962','Ana P.'],
 ['2255 75400962\nAna P.','2255','75400962','Ana P.'],
];
for(const [raw,orderId,ifoodId,customerName] of cases) {
 const got=parser.parseIfoodOrderText(raw);
 eq(got.orderId,orderId,'pedido em '+JSON.stringify(raw));
 eq(got.ifoodId,ifoodId,'ID em '+JSON.stringify(raw));
 eq(got.customerName,customerName,'nome em '+JSON.stringify(raw));
 eq(got.confirmationCode,'','nunca inferir codigo de confirmacao de numero do pedido');
}
for(const raw of ['Rua Afonso Pena 2255 75400962','Telefone 2255 75400962','Total 2255 75400962']){
 const got=parser.parseIfoodOrderText(raw);
 check(!got.customerName,'endereco/telefone/total nao viram nome de cliente');
}
const finance=load('lib/delivery-finance.ts');
const cancelled={isCancelledSiteDelivery:()=>false};
const cash=load('lib/route-cash-flow.ts',{
 '@/lib/delivery-finance':finance,
 '@/lib/integration/site-order':cancelled,
});
const plan=load('lib/route-change-plan.ts',{
 '@/lib/route-cash-flow':cash,
 '@/lib/route-stops':{deliveryStopKey:d=>d.id,stopNumberMap:ds=>new Map(ds.map((d,i)=>[d.id,i+1]))},
});
const make=(id,value,changeFor)=>({id,route_id:'r',customer_name:id,customer_charge:value,value,payment_method:'dinheiro',payment_state:'collect_on_delivery',is_paid:false,change_for:changeFor});
const route=[make('primeiro',50,50),make('segundo',49,50)];
const forecast=cash.routeCashFlow(route,0);
eq([forecast.plannedCashChange,forecast.plannedPixChange,forecast.expectedPhysicalReturn],[1,0,99],'troco reaproveitado da parada anterior');
const planResult=plan.buildRouteChangePlan(route,0,()=>undefined);
eq(planResult.lines.map(x=>[x.cashChange,x.pixChange]),[[0,0],[1,0]],'detalhamento por parada e simulacao coerentes');
const reverse=cash.routeCashFlow([route[1],route[0]],0);
eq([reverse.plannedCashChange,reverse.plannedPixChange],[0,1],'ordem importa: dinheiro futuro nao faz troco retroativo');
const partial=cash.routeCashFlow([make('um',64,100),make('dois',15,20)],30);
eq([partial.plannedCashChange,partial.plannedPixChange,partial.expectedPhysicalReturn],[35,6,115],'troco em dinheiro e pix sem dupla contagem');
for(const file of ['app/clientes/page.tsx','app/clientes/details/page.tsx','components/home/RouteAccordion.tsx','components/home/DeliveryCard.tsx']){
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 eq(ast.parseDiagnostics.length,0,'JSX '+file);
}
const clients=read('app/clientes/page.tsx');
check(clients.includes("['keeta','Keeta']")&&clients.includes("customerOrigin==='keeta'"),'clientes com filtro e identidade Keeta');
const detail=read('app/clientes/details/page.tsx');
check(detail.includes("customer.origin==='keeta'?'Keeta':'Loja'"),'ficha de cliente identifica Keeta corretamente');
const card=read('components/home/DeliveryCard.tsx');
check(!card.includes('Vizinha {neighborPosition'),'card nao confunde pedido agrupado com endereco proximo');
const routeCard=read('components/home/RouteAccordion.tsx');
check(routeCard.includes('isNeighbor={Boolean(nearby)}'),'proximidade visual somente por metadado espacial');
for(const file of ['lib/ifood-order-parser.ts','lib/route-cash-flow.ts','lib/route-change-plan.ts']) {
 for(const forbidden of ['fetch(', 'getDocs(', 'onSnapshot(', 'runTransaction(', 'setDoc('])check(!read(file).includes(forbidden),file+' permanece sem I/O '+forbidden);
}
console.log(`R299 P1: ${n} cenarios e contratos aprovados; nenhuma rede e nenhuma alteracao de dados.`);
