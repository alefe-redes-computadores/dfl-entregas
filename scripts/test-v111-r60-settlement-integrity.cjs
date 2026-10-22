#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');let checks=0;
const same=(a,b,label)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),label);checks++;};
const check=(a,label)=>{assert.ok(a,label);checks++;};
const canceled=(d)=>d.source_system==='dfl_site'&&['cancelado','cancelada','cancelled','canceled'].includes(String(d.site_order_status||'').toLowerCase());
const active=(values)=>values.filter(d=>!canceled(d));
const normalize=(s)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const belongs=(r,m)=>r.motoboy_id?r.motoboy_id===m.id:normalize(r.motoboy_name)===normalize(m.name);
const dateKey=(r)=>r.operational_date||'2026-10-21';
const groups=(ds)=>{const map=new Map();for(const item of ds){const key=item.address_string||item.id; if(!map.has(key))map.set(key,[]);map.get(key).push(item);}return [...map.values()];};
function load(file,bindings){const code=fs.readFileSync(file,'utf8');const compiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const mod={exports:{}};const require=(name)=>{if(!Object.prototype.hasOwnProperty.call(bindings,name))throw Error('unknown import '+name);return bindings[name];};vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require,Date,Intl,Number,Math,Set,Map,Array,String},{timeout:8000});return mod.exports;}
const ready=load('lib/motoboy-settlement-tasks.ts',{
 '@/lib/motoboy-analytics':{operationalDateKey:()=> '2026-10-21',routeBelongsToMotoboy:belongs},
 '@/lib/operational-exclusions':{isInternalOperationalMotoboy:()=>false},
 '@/lib/operational-time':{routeOperationalDateKey:dateKey},
 '@/lib/route-closure-eligibility':{activeRouteDeliveries:active},
}).buildPendingMotoboySettlements;
const analytics=load('lib/motoboy-analytics.ts',{
 '@/lib/route-stops':{groupDeliveriesByStop:groups},
 '@/lib/route-closure-eligibility':{activeRouteDeliveries:active},
});
const make=(id,rid,more={})=>({id,route_id:rid,completed:true,address_string:id,payment_method:'dinheiro',value:25,change_for:30,is_paid:false,...more});
const route=(id,mid='m1',status='fechada')=>({id,motoboy_id:mid,status,operational_date:'2026-10-21'});
const m={id:'m1',name:'Teste',active:true,payment_rule:{type:'per_delivery',delivery_fee:8}};
function pending(deliveries,routes=[route('r1')],expenses=[]){return ready({motoboys:[m],deliveries,routes,expenses,dateKey:'2026-10-21'});}
same(pending([make('x','r1',{completed:false,source_system:'dfl_site',site_order_status:'cancelado'}),make('y','r1')]).length,1,'cancelled cannot block settlement');
same(pending([make('x','r1',{completed:false,source_system:'dfl_site',site_order_status:'cancelado'})]).length,0,'only cancellations do not create settlement');
same(pending([make('x','r1',{completed:false,source_system:'ifood',site_order_status:'cancelado'})]).length,0,'ifood status alone does not cancel');
same(pending([make('x','r1',{completed:false}),make('y','r1')]).length,0,'active incomplete blocks settlement');
same(pending([make('x','r1')],[route('r1','m1','aberta')]).length,0,'open route blocks settlement');
same(pending([make('x','r1')],[route('r1')],[{source_id:'motoboy:m1:2026-10-21'}]).length,0,'existing settlement does not prompt again');
const setData=(deliveries,routes=[route('r1')])=>analytics.getMotoboyDayData(m,'2026-10-21',routes,deliveries);
const withCancel=[make('x','r1'),make('c','r1',{source_system:'dfl_site',site_order_status:'cancelado',value:150}),make('z','r1',{completed:false})];
const got=setData(withCancel);same(got.orderCount,1,'canceled completed ignored for fee');same(got.physicalDeliveryCount,1,'canceled completed ignored for stop');same(got.fee.amount,8,'canceled completed ignored for daily fee');same(got.cashCollected,25,'canceled completed ignored for cash');same(got.cashInHand,30,'canceled completed ignored for cash tendered');
const double=setData([make('x','r1',{address_string:'Rua A'}),make('y','r1',{address_string:'Rua A'}),make('z','r2',{address_string:'Rua A'})],[route('r1'),route('r2')]);
same(double.physicalDeliveryCount,2,'same address on two routes counts separately');same(double.orderCount,3,'all valid orders retained');
let seed=19345;const rand=(n)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
function legacyDay(motoboy,date,routes,deliveries){const dayRoutes=routes.filter(r=>belongs(r,motoboy)&&dateKey(r)===date);const ids=new Set(dayRoutes.map(r=>r.id));const completed=deliveries.filter(d=>ids.has(d.route_id)&&d.completed);const stops=dayRoutes.flatMap(r=>groups(completed.filter(d=>d.route_id===r.id)));return {orderCount:completed.length,physicalDeliveryCount:stops.length,routeBreakdown:dayRoutes.map((r,i)=>{const ds=completed.filter(d=>d.route_id===r.id);return {routeId:r.id,label:r.name?.trim()||`Rota ${i+1}`,orderCount:ds.length,physicalDeliveryCount:groups(ds).length,groupedOrderCount:Math.max(0,ds.length-groups(ds).length)}}).filter(v=>v.orderCount>0)};}
for(let i=0;i<220;i++){
 const rs=Array.from({length:rand(32)},(_,j)=>route('r'+j,j%3?'m1':'m2'));
 const ds=Array.from({length:rand(210)},(_,j)=>make('d'+j,'r'+rand(rs.length+4),{address_string:'addr'+rand(35),completed:rand(3)!==0,source_system:'ifood'}));
 const before=legacyDay(m,'2026-10-21',rs,ds),after=setData(ds,rs);
 for(const field of ['orderCount','physicalDeliveryCount','routeBreakdown'])same(after[field],before[field],'original financial grouping '+i+' '+field);
}
const largeRoutes=Array.from({length:260},(_,i)=>route('r'+i));
const largeDeliveries=Array.from({length:13000},(_,i)=>make('d'+i,'r'+(i%260),{completed:i%6!==0,source_system:i%17===0?'dfl_site':'ifood',site_order_status:i%17===0?'cancelado':'confirmado'}));
const large=ready({motoboys:[m],routes:largeRoutes,deliveries:largeDeliveries,expenses:[],dateKey:'2026-10-21'});
same(large.length,0,'unfinished valid orders prevent settlement across large history');
const ledger=load('lib/motoboy-ledger.ts',{
 '@/lib/route-closure-eligibility':{activeRouteDeliveries:active},
 '@/lib/motoboy-analytics':{getMotoboyRoutes:(motoboy,routes)=>routes.filter(r=>belongs(r,motoboy)),operationalDateKey:()=> '2026-10-21',routeOperationalDate:r=>r.created_at||'2026-10-21T12:00:00-03:00'},
}).buildMotoboyLedger;
const ledgerRoutes=Array.from({length:150},(_,i)=>({...route('r'+i),created_at:'2026-10-21T12:00:00-03:00'}));
const ledgerDeliveries=Array.from({length:1800},(_,i)=>make('d'+i,'r'+(i%150),{source_system:i%13===0?'dfl_site':'ifood',site_order_status:i%13===0?'cancelado':'ready'}));
const ledgerData=ledger({motoboy:m,routes:ledgerRoutes,deliveries:ledgerDeliveries,expenses:[]});
same(ledgerData.linkedDeliveries.length,1800,'ledger retains cancelled records for historical audit');
same(ledgerData.completedDeliveries.length,ledgerDeliveries.filter(d=>!canceled(d)).length,'ledger completed deliveries exclude commercial cancellations');
same(ledgerData.days[0].deliveries.length,1800,'ledger historical day preserves all records');
const ledgerSrc=fs.readFileSync('lib/motoboy-ledger.ts','utf8');check(ledgerSrc.includes('routesById.get(delivery.route_id)'),'ledger uses id index');
console.log(`R60 SETTLEMENT BEHAVIOR: ${checks} comparisons OK`);
