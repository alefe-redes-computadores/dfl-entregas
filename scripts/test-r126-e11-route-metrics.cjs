'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const file='lib/operation/route-card-metrics.ts';
const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};vm.runInNewContext(code,{module:mod,exports:mod.exports},{filename:file});
const metric=mod.exports.routeCardMetrics;
let count=0;const ok=(name,cond)=>{assert.ok(cond,name);count++};
for(let n=0;n<=300;n++){
 const deliveries=Array.from({length:n},(_,i)=>({completed:i%3===0}));
 const done=deliveries.filter(x=>x.completed).length;
 const actual=metric(deliveries,Math.ceil(n/2),Math.floor(n/2));
 ok('total '+n,actual.totalDeliveries===n);
 ok('pendentes '+n,actual.pendingDeliveriesCount===n-done);
 ok('percentual '+n,actual.progressPercent===(n?done/n*100:0));
 ok('paradas '+n,actual.totalStops===Math.ceil(n/2)&&actual.pendingStopsCount===Math.floor(n/2));
}
const mixed=[{completed:false},{completed:true},{completed:undefined},{completed:null},{completed:1}];
const out=metric(mixed,3,2);
ok('semantica legada de valores truthy',out.pendingDeliveriesCount===3);
const jsx='components/home/RouteAccordion.tsx',s=fs.readFileSync(jsx,'utf8');
ok('chamada memoizada',s.includes('routeCardMetrics(deliveries, totalStops, pendingStopsCount)'));
ok('sem array auxiliar de pendentes KPI',!s.includes('const pending = deliveries.filter((delivery) => !delivery.completed)'));
for(const q of ['onClick={toggleRouteOpen}','groupDeliveriesByStop','hasPhysicalCashForRoute','deliveryEconomicValue','isCancelledSiteDelivery','rememberOpenRouteId(route.id)'])ok('fluxo preservado '+q,s.includes(q));
const parsed=ts.createSourceFile(jsx,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
ok('JSX valido',parsed.parseDiagnostics.length===0);
ok('gate no preapk',fs.readFileSync('scripts/pre-apk.cjs','utf8').includes("'scripts/test-r126-e11-route-metrics.cjs'"));
console.log('R126 E11: '+count+' contratos OK');
