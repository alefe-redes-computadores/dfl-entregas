#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
let cases = 0;
function loadTs(file, dependencies = {}) {
  const input = fs.readFileSync(file,'utf8');
  const result = ts.transpileModule(input, {
    fileName:file,
    compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022},
    reportDiagnostics:true,
  });
  assert.equal(result.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length||0,0,`transpile ${file}`);
  const m = new Module(process.cwd()+'/'+file,module);
  m.filename = process.cwd()+'/'+file;
  m.paths = module.paths;
  m.require = function(request) {
    if (Object.hasOwn(dependencies,request)) return dependencies[request];
    throw Error(`Unexpected dependency: ${request}`);
  };
  m._compile(result.outputText,m.filename);
  return m.exports;
}
const codeApi = loadTs('lib/operation/ifoodOrderCode.ts');
const code = codeApi.orderConfirmationCode;
for(const [value, expected] of [[undefined,''],[null,''],['',''],['7',''],['123',''],['1234','1234'],['12 34','1234'],['12-34','1234'],['abcd',''],['12345',''],['0000','0000'],['1234 5',''],['a01b23','0123']]) {
  assert.equal(code(value),expected,`code ${String(value)}`); cases++;
}
for(let i=0;i<1000;i++){
  const raw = String(i).padStart(4,'0');
  assert.equal(code(raw),raw); cases++;
  assert.equal(code(raw+'9'),''); cases++;
}
let stopCalls=0;
const stopKey=d=>{stopCalls++;return d.address_string||d.id;};
const group=ds=>{
  const grouped=new Map();
  for(const d of ds){const key=stopKey(d);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(d);}
  return [...grouped].map(([key,items])=>({key,deliveries:items,representative:items[0]}));
};
const dependencies={
 '@/lib/maps':{resolveStopLocation:d=>d.address_string,buildGoogleMapsRouteUrl:()=> 'https://maps.example/',cleanAddressForMaps:s=>s},
 '@/lib/operational-time':{routeStartedAt:r=>r.start_time},
 '@/lib/reports/time':{firstValidTimestamp:v=>{const d=new Date(v||'');return Number.isFinite(d.getTime())?d:null;}},
 '@/lib/operational-address':{canonicalizeOperationalAddress:s=>({address:s||'Rua 10, 1',neighborhood:'Centro'}),bestOperationalAddress:(a,b)=>a||b||'',hasHouseNumber:()=>true},
 '@/lib/route-stops':{deliveryStopKey:stopKey,stopNumberMap:ds=>new Map(ds.map((d,i)=>[stopKey(d),i+1])),groupDeliveriesByStop:group},
 '@/lib/route-cash-flow':{routeCashFlow:()=>({cashOrders:[],initialCash:0})},
 '@/lib/route-change-plan':{buildRouteChangePlan:()=>({lines:[],flow:{initialCash:0,tenderedCash:0,plannedCashChange:0,plannedPixChange:0,expectedPhysicalReturn:0}})},
 '@/lib/delivery-finance':{deriveDeliveryPaymentState:d=>d.is_paid?'paid':'pending'},
 '@/lib/operation/ifoodOrderCode':codeApi,
};
const whatsapp=loadTs('lib/whatsapp.ts',dependencies);
const customer={id:'c1',name:'Cliente A',phone:'34999999999',address:'Rua 10, 1',last_confirmation_code:'9999'};
const getCustomer=()=>customer;
const route={id:'r1',name:'Rota 1',motoboy_name:'João',start_time:'2026-10-21T18:00:00.000Z',change_money:0};
const make=(id,c)=>({id,customer_id:'c1',customer_name:'Cliente '+id,address_string:'Rua 10, 1',origin:'ifood',ifood_id:'12345678',order_id:id,confirmation_code:c,customer_charge:20,payment_method:'pix',route_id:'r1'});
(async()=>{
  const oldCode=make('d1',undefined);
  const one=await whatsapp.generateRouteMessages(route,[oldCode],'Rua 20',getCustomer);
  assert.equal(one.success,true); cases++;
  assert.ok(one.messages.join('\n').includes('PEGAR CÓDIGO')); cases++;
  assert.ok(!/🔑[^\n]*9999/.test(one.messages.join('\n')),'customer historical code must never be displayed'); cases++;
  const all=[make('d1','1234'),make('d2',undefined)];
  const grouped=await whatsapp.generateRouteMessages(route,all,'Rua 20',getCustomer);
  assert.equal(grouped.success,true); cases++;
  const groupText=grouped.messages.join('\n');
  assert.ok(groupText.includes('1234'),'one order retains its code'); cases++;
  assert.ok(!/🔑[^\n]*9999/.test(groupText),'sibling order cannot inherit customer code'); cases++;
  assert.ok(groupText.includes('pedir código'),'missing code identified for second order'); cases++;
  assert.ok(groupText.includes('Confirmações necessárias'),'checklist includes missing group'); cases++;
  assert.equal((grouped.messages[1].match(/pedir código/g)||[]).length,1,'only sibling is missing'); cases++;
  let captured='';
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async value=>{captured=value;}}}});
  assert.equal(await whatsapp.copyDeliveryToClipboard(oldCode,customer.name,'9999'),true);cases++;
  assert.ok(captured.includes('PEGAR O CÓDIGO')&&!/🔑[^\n]*9999/.test(captured),'individual copy never copies legacy customer code');cases++;
  assert.equal(await whatsapp.copyDeliveryToClipboard(all[0],customer.name,'9999',all),true);cases++;
  assert.ok(captured.includes('1234')&&!/🔑[^\n]*9999/.test(captured)&&captured.includes('PEDIR O CÓDIGO'),'group copy keeps codes per order');cases++;
  const many=Array.from({length:600},(_,i)=>({...make('id'+i,i%2===0?'1234':undefined),address_string:'Rua 10, '+(Math.floor(i/3)+1)}));
  stopCalls=0;
  const manyMessages=await whatsapp.generateRouteMessages(route,many,'Rua 20',getCustomer);
  assert.equal(manyMessages.success,true);cases++;
  assert.ok(stopCalls < 12000,`grouping should scale linearly in code lookups, got ${stopCalls}`); cases++;
  assert.ok(manyMessages.messages[0].includes('200 paradas'),'600 orders / 3 per stop'); cases++;
  console.log(`R53 IFOOD CODE + WHATSAPP BEHAVIOR: ${cases} testes aprovados`);
})().catch(e=>{console.error(e);process.exitCode=1;});
