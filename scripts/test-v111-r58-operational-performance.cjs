#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
let checks = 0;
const equal=(actual,expected,label)=>{assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(expected)),`R58 ${label}`);checks++;};
function loadFunction(file,name,bindings={}){
 const source=fs.readFileSync(file,'utf8');
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const fn=tree.statements.find(node=>ts.isFunctionDeclaration(node) && node.name?.text===name);
 assert.ok(fn,'R58 missing '+name);
 const fragment=source.slice(fn.getStart(tree),fn.end)+`\nexports.${name} = ${name};`;
 const transformed=ts.transpileModule(fragment,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
 const errors=(transformed.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,'R58 syntax '+name);
 const exports={}; vm.runInNewContext(transformed.outputText,{exports,Date,Map,Set,Number,...bindings},{timeout:5000});
 return exports[name];
}
const routeTimings=loadFunction('lib/reports/buildReportModel.ts','buildRouteTimings',{
 trustedRouteDurationMinutes:route=>route.durationMinutes==null?null:route.durationMinutes,
});
function beforeTimings(routes,deliveries){
 const routeIds=new Set(deliveries.map(d=>d.route_id));const trusted=[];let suspicious=0;
 routes.forEach(route=>{
  if(!routeIds.has(route.id) || route.status!=='fechada')return;
  if(route.durationMinutes==null){suspicious++;return;}
  trusted.push({routeId:route.id,routeName:route.name||route.id,motoboyName:route.motoboy_name||'Não atribuído',durationMinutes:Number(route.durationMinutes.toFixed(1)),deliveryCount:deliveries.filter(d=>d.route_id===route.id).length});
 }); return {trusted,suspicious};
}
let seed=0x789abcde;
const rand=(n)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
for(let iteration=0;iteration<280;iteration++){
 const n=rand(115), m=rand(400);
 const routes=Array.from({length:n},(_,i)=>({id:'r'+i,name:i%4===0?'':'Rota '+i,motoboy_name:i%5===0?'':'M '+i,status:i%3?'fechada':'aberta',durationMinutes:i%6===0?null:(12+i/9)}));
 const deliveries=Array.from({length:m},()=>({route_id:rand(10)===0?'desconhecida':'r'+rand(n+7)}));
 equal(routeTimings(routes,deliveries),beforeTimings(routes,deliveries),'timings '+iteration);
}
// Grande histórico: a função indexada deve continuar preservando multiplicidade.
const bigRoutes=Array.from({length:2500},(_,i)=>({id:'r'+i,name:'Rota '+i,status:'fechada',durationMinutes:i%11?22:null}));
const bigDeliveries=Array.from({length:19000},(_,i)=>({route_id:'r'+(i%2500)}));
const large=routeTimings(bigRoutes,bigDeliveries);
assert.equal(large.trusted.length,2500-Math.ceil(2500/11));checks++;
assert.equal(large.suspicious,Math.ceil(2500/11));checks++;
assert.ok(large.trusted.every(x=>x.deliveryCount===7||x.deliveryCount===8));checks++;
const firstDate=(data)=>data.map(x=>x.reportDateKey).filter(Boolean).sort((a,b)=>a.localeCompare(b))[0]||null;
const indexedDate=(data)=>{let first=null;for(const item of data){const key=item.reportDateKey;if(key&&(!first||key.localeCompare(first)<0))first=key;}return first;};
for(let i=0;i<650;i++){
 const data=Array.from({length:rand(75)},()=>({reportDateKey:rand(5)===0?null:`2026-${String(rand(12)+1).padStart(2,'0')}-${String(rand(28)+1).padStart(2,'0')}`}));
 equal(indexedDate(data),firstDate(data),'period min '+i);
}
const within=loadFunction('lib/reports/buildReportModel.ts','inPeriod',{compareDateKeys:(a,b)=>a.localeCompare(b)});
for(let i=0;i<420;i++){
 const start=`2026-10-${String(rand(18)+1).padStart(2,'0')}`;
 const end='2026-10-31';
 const item={reportDateKey:i%9===0?null:`2026-10-${String(rand(31)+1).padStart(2,'0')}`};
 const expected=!item.reportDateKey?false:(i%7===0?true:item.reportDateKey>=start&&item.reportDateKey<=end);
 equal(within(item,i%7===0?null:start,end),expected,'date window '+i);
}
const parseTimestamp=loadFunction('lib/reports/time.ts','parseTimestamp');
equal(parseTimestamp({toDate:()=>{throw new Error('invalid legacy timestamp');}}),null,'invalid firestore timestamp');
equal(parseTimestamp({toDate:()=>({})}),null,'non-Date return');
equal(parseTimestamp({toDate:()=>new Date(NaN)}),null,'invalid Date return');
equal(parseTimestamp({seconds:NaN}),null,'invalid seconds');
equal(parseTimestamp(new Date('2026-10-21T12:00:00Z')).toISOString(),'2026-10-21T12:00:00.000Z','valid Date');
equal(parseTimestamp({seconds:1}).toISOString(),'1970-01-01T00:00:01.000Z','Firestore seconds');
// Memo de datas da Home continua equivalente ao parse anterior, com IDs repetidos.
for(let scenario=0;scenario<190;scenario++){
 const records=Array.from({length:rand(120)+1},(_,i)=>({id:'r'+(i%9),created_at:new Date(Date.UTC(2026,9,1,rand(24),rand(60))).toISOString()}));
 const old=[...records].sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
 const times=new Map(records.map(x=>[x,new Date(x.created_at).getTime()]));
 const fresh=[...records].sort((a,b)=>times.get(a)-times.get(b));
 equal(fresh.map(x=>x.created_at),old.map(x=>x.created_at),'home sort '+scenario);
}
console.log(`R58 REPORT/HOME REGRESSION: ${checks} behavioral comparisons OK`);
