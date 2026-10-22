#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');let n=0;
function check(x,msg){assert.ok(x,'R49 behavior: '+msg);n++;}
const gate=fs.readFileSync('lib/operation/submissionGate.ts','utf8');const js=ts.transpileModule(gate,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exported={exports:{}};vm.runInNewContext(js,{module:exported,exports:exported.exports});const {claimSubmission,releaseSubmission}=exported.exports;
const lock={current:false};check(claimSubmission(lock),'primeiro toque reivindica a gravação');for(let i=0;i<250;i++)check(!claimSubmission(lock),'toque repetido bloqueado '+i);
releaseSubmission(lock);check(claimSubmission(lock),'retry após falha é possível');check(!claimSubmission(lock),'retry não duplica');
const code=fs.readFileSync('app/rotas/page.tsx','utf8'),sf=ts.createSourceFile('app/rotas/page.tsx',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function getCallback(varName){let callback;function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(sf)===varName){const call=node.initializer;check(ts.isCallExpression(call)&&call.arguments.length>=1,varName+' useMemo');callback=call.arguments[0].getText(sf);}ts.forEachChild(node,visit)}visit(sf);check(Boolean(callback),varName+' encontrado');return callback;}
const callbacks={rows:getCallback('rows'),render:getCallback('renderedRows')};
let stopCalls=0,moneyCalls=0,chargeCalls=0,paymentCalls=0;
const rCount=260;
const searchedDayRoutes=Array.from({length:rCount},(_,i)=>({id:`route-${i}`,name:`Rota ${i}`,motoboy_name:'Motoboy',status:i%5===0?'fechada':'aberta',day:i}));
const deliveriesByRoute=new Map(searchedDayRoutes.map((r,i)=>[r.id,[{id:`${i}-a`,completed:i%3===0,value:10},{id:`${i}-b`,completed:true,value:20}]]));
const env={searchedDayRoutes,deliveriesByRoute,filter:'todas',Date,Number,Boolean,Math,Map,Array,Set,console,
 canonicalRouteStartedAt:r=>r.day%7===0?null:'2026-10-21T12:00:00Z',canonicalRouteDate:r=>new Date(2026,9,21,10,r.day).toISOString(),
 groupDeliveriesByStop:linked=>{stopCalls++;return linked.map(d=>[d.id])},
 deliveryEconomicValue:d=>{moneyCalls++;return d.value},deliveryCustomerCharge:d=>{chargeCalls++;return d.value},
 routeOutstandingPayment:d=>{paymentCalls++;return {pending:!d.completed,amount:d.value}},
 progressiveCount:(length,visible)=>Math.min(length,visible),visibleLimit:40};
function run(name){const src=ts.transpileModule('module.exports = '+callbacks[name]+';', {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;const obj={exports:null};vm.runInNewContext(src,{...env,module:obj});return obj.exports()}
const rows=run('rows');check(rows.length===rCount,'filtro todas mantém 260 rotas');check(stopCalls===0&&moneyCalls===0&&paymentCalls===0,'sem cálculo financeiro/paradas fora da janela');
env.rows=rows;let visible=run('render');check(visible.length===40,'somente 40 cards preparados');check(stopCalls===40,'40 cálculos de paradas');check(moneyCalls===80&&chargeCalls===80&&paymentCalls===80,'somente 80 pedidos financeiros');
check(visible[0].amount===30&&visible[0].customerCharge===30,'total financeiro intacto');check(visible[0].pendingCharge===0&&visible[0].pendingPayments===0,'pagamentos concluídos não ficam a receber');
check(visible[1].pendingCharge===10&&visible[1].pendingPayments===1,'pagamento pendente por pedido');
env.visibleLimit=80;visible=run('render');check(visible.length===80,'carregar mais sem perder pedidos');check(stopCalls===120&&moneyCalls===240,'mais cálculos só ao expandir');
env.filter='finalizadas';const filtered=run('rows');check(filtered.length===52,'filtro finalizadas completo');check(stopCalls===120,'filtrar não calcula paradas');
console.log('R49 COMPORTAMENTO:',n,'checagens OK');
