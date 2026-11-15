#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const read=(name)=>fs.readFileSync(name,'utf8');
let total=0;
const eq=(actual,expected,name)=>{assert.equal(actual,expected,name);total++;};
const ok=(value,name)=>{assert.ok(value,name);total++;};
const touched=[
  'types/index.ts','lib/delivery-attempts.ts','lib/route-closure-eligibility.ts','lib/operation/remoteOperationGuards.ts',
  'store/useAppStore.ts','components/home/DeliveryCard.tsx','components/home/RouteAccordion.tsx','app/page.tsx',
  'lib/motoboy-analytics.ts','lib/customer-intelligence.ts','app/clientes/inteligencia/page.tsx',
  'app/motoboys/acerto/page.tsx','app/clientes/duplicados/page.tsx','lib/customer-contact-book.ts',
  'lib/operation/lifecycle-read-model.ts','lib/integration/manualNextStopPolicy.ts','lib/tracking/gate1/core.ts',
  'lib/operation/return-to-store.ts','app/entregas/retornos/page.tsx',
];
for(const file of touched){
  const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  eq(ast.parseDiagnostics.length,0,'TS AST '+file);
}
function load(file,deps={}){
  const js=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  const mod={exports:{}};
  vm.runInNewContext('(function(require,module,exports){'+js+'\n})',{}, {filename:file})((name)=>{if(!(name in deps))throw Error('unexpected dependency: '+name+' in '+file);return deps[name];},mod,mod.exports);
  return mod.exports;
}
const rules=load('lib/operation/return-to-store.ts');
const returned={route_id:'route-a',completed:false,return_to_store:{route_id:'route-a',attempt_id:'visit-a',at:'2026-11-15T10:00:00.000Z',reason:'no_response'}};
ok(rules.isAwaitingRedelivery(returned),'returned is pending retry');
ok(!rules.isAwaitingRedelivery({...returned,completed:true}),'delivered never pending retry');
ok(!rules.isAwaitingRedelivery({...returned,route_id:'route-b'}),'reassigned not stuck on old route');
const attempts=load('lib/delivery-attempts.ts');
const detail={id:'delivery1',route_id:'route-a',origin:'loja',customer_id:'customer1',customer_name:'Cliente A',
  address_string:'Rua 1, 20',completed:false,value:42,payment_method:'pix',is_paid:false,
  delivery_attempts:attempts.appendDeliveryAttempt([],{
    id:'visit-a',reason:'no_response',at:'2026-11-15T10:00:00.000Z',route_id:'route-a',
    motoboy_id:'driver1',motoboy_name:'Joao',operational_date:'2026-11-15',physical_visit_confirmed:true,returned_to_store:true,
  }),return_to_store:returned.return_to_store};
const driver={id:'driver1',name:'Joao',payment_rule:{type:'per_delivery',delivery_fee:6}};
eq(rules.confirmedAttemptVisits([detail],new Set(['route-a']),'2026-11-15',driver).length,1,'one confirmed visit');
eq(rules.confirmedAttemptVisits([detail],new Set(['route-a']),'2026-11-16',driver).length,0,'visit not paid on wrong date');
eq(rules.confirmedAttemptVisits([detail],new Set(['route-a']),'2026-11-15',{id:'driver2',name:'Joao'}).length,0,'visit not paid to different driver');
eq(rules.confirmedAttemptVisits([{...detail,route_id:'route-b'}],new Set(['route-a']),'2026-11-15',driver).length,1,'visit survives order rerouting');
eq(rules.confirmedAttemptVisits([{...detail,delivery_attempts:[{...detail.delivery_attempts[0],physical_visit_confirmed:false}]}],new Set(['route-a']),'2026-11-15',driver).length,0,'no speculative visit');
const close=load('lib/route-closure-eligibility.ts',{
  '@/lib/integration/site-order':{isCancelledSiteDelivery:()=>false},
  '@/lib/operational-time':{routeStartedAt:r=>r.started_at||''},
  '@/lib/operation/return-to-store':rules,
});
const route={id:'route-a',motoboy_id:'driver1',motoboy_name:'Joao',status:'aberta',started_at:'2026-11-15T09:00:00.000Z',operational_date:'2026-11-15'};
ok(close.canAutoCloseRoute(route,[detail]),'return frees route closure without delivery completion');
ok(!close.canAutoCloseRoute(route,[{...detail,return_to_store:null}]),'unfinished stop prevents close');
ok(!close.canAutoCloseRoute({...route,started_at:null},[detail]),'route must actually start');
const done={id:'delivery2',route_id:'route-a',completed:true,origin:'loja',customer_id:'customer1',customer_name:'Cliente A',address_string:'Rua 2, 30',is_paid:true,payment_method:'pix',value:32};
const analytics=load('lib/motoboy-analytics.ts',{
  '@/lib/route-stops':{groupDeliveriesByStop:rows=>rows.map(x=>({deliveries:[x]}))},
  '@/lib/route-closure-eligibility':{activeRouteDeliveries:rows=>rows},
  '@/lib/route-cash-flow':{routeCashFlow:()=>({customerCharges:0,cashOrders:[],tenderedCash:0})},
  '@/lib/operation/return-to-store':rules,
});
const pay=analytics.getMotoboyDayData(driver,'2026-11-15',[route],[done,detail]);
eq(pay.orderCount,1,'only concluded sale counted');
eq(pay.attemptVisitCount,1,'physical attempt counted');
eq(pay.physicalDeliveryCount,2,'one completion plus one attempted visit');
eq(pay.fee.amount,12,'per-visit compensation computed exactly');
eq(pay.cashCollected,0,'no speculative customer cash');
const fixed=analytics.getMotoboyDayData({...driver,payment_rule:{type:'fixed',fixed_amount:65}},'2026-11-15',[route],[done,detail]);
eq(fixed.fee.amount,65,'fixed daily fee not multiplied');
const intelligence=load('lib/customer-intelligence.ts',{
  '@/lib/customer-relationship-score':{customerRelationshipScore:()=>({completedOrders:1,score:80,tier:'frequente'})},
  '@/lib/delivery-finance':{deliveryCustomerCharge:()=>32},
});
const insight=intelligence.buildCustomerIntelligence({id:'customer1',name:'Cliente A'},[done,detail]);
eq(insight.completed,1,'intelligence keeps confirmed sales separate');
eq(insight.attemptCount,1,'intelligence observes attempts');
eq(insight.returnCount,1,'intelligence observes returns');
eq(detail.delivery_attempts[0].id,detail.return_to_store.attempt_id,'return refers to recorded attempt');
    ok(detail.delivery_attempts[0].physical_visit_confirmed===true && detail.delivery_attempts[0].returned_to_store===true,'return is explicitly recorded as physical');
    const noReturnFlag={...detail,delivery_attempts:[{...detail.delivery_attempts[0],returned_to_store:false}]};
    eq(intelligence.buildCustomerIntelligence({id:'customer1',name:'Cliente A'},[done,noReturnFlag]).returnCount,0,'unconfirmed return flag never counts');
    const reassignedHistory={...detail,route_id:'route-b',return_to_store:null};
    eq(intelligence.buildCustomerIntelligence({id:'customer1',name:'Cliente A'},[done,reassignedHistory]).returnCount,1,'historical confirmed return preserved after reassignment');
ok(insight.latestAttempt?.reason==='no_response','intelligence preserves factual reason');
const store=read('store/useAppStore.ts'),card=read('components/home/DeliveryCard.tsx'),acerto=read('app/motoboys/acerto/page.tsx');
ok(store.includes('isReturning')&&store.includes('return_to_store:null')&&store.includes('canAutoCloseRoute(route, routeDeliveries)'),'remote guarded lifecycle and auto-close');
ok(read('lib/operation/remoteOperationGuards.ts').includes('Retorno fisico nao comprovado no servidor'),'return guard at transactional boundary');
ok(card.includes('Registrar tentativa (sem dar baixa)')&&card.includes('delivery_attempts: appendDeliveryAttempt'),'old history-only contract preserved');
ok(card.includes('Motoboy retornou à loja')&&read('app/entregas/retornos/page.tsx').includes('Reinserir na rota selecionada'),'new explicit return workflow');
ok(acerto.includes('data.attemptVisits')&&acerto.includes('data.attemptVisitCount'),'reports and detailed image share same snapshot');
ok(read('app/clientes/duplicados/page.tsx').includes('directDuplicateEvidence(group,target.id,row.customer.id)'),'batch only for directly verified duplicates');
ok(read('lib/integration/manualNextStopPolicy.ts').includes('item.return_to_store?.route_id === route.id'),'next-stop excludes a returned customer');
ok(read('lib/tracking/gate1/core.ts').includes('!isReturnedToStore(x)'),'public route progress excludes returned stop');
ok(!/fetch\s*\(|onSnapshot\s*\(/.test(read('lib/operation/return-to-store.ts')),'pure computation no network');
console.log('R72_P1_OPERATION_PASS:',total,'invariants + AST checks; zero real Firestore/WhatsApp');
