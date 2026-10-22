#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');let checks=0;
const ok=(x,why)=>{assert.ok(x,'R60: '+why);checks++;};
function source(file){const txt=fs.readFileSync(file,'utf8');const ast=ts.createSourceFile(file,txt,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(ast.parseDiagnostics.length===0,'typescript syntax '+file);return txt;}
const tasks=source('lib/motoboy-settlement-tasks.ts');
const analytics=source('lib/motoboy-analytics.ts');
const ledger=source('lib/motoboy-ledger.ts');
const page=source('app/motoboys/acerto/page.tsx');
const pre=source('scripts/pre-apk.cjs');
for(const part of ['activeRouteDeliveries(input.deliveries)','activeByRoute.get(route.id)','!dayDeliveries.length','dayDeliveries.some((delivery)=>!delivery.completed)','settledSources.has(sourceId)','linkedRoutes.some((route)=>route.status!==\'fechada\')'])ok(tasks.includes(part),'settlement prompt '+part);
ok(!tasks.includes('input.deliveries.filter((delivery)=>routeIds.has'),'no per-motoboy full history scan');
for(const part of ['activeRouteDeliveries(deliveries).filter','completedByRoute.get(delivery.route_id)','completedByRoute.get(route.id)||[]','groupDeliveriesByStop','cashDeliveries=completedDeliveries.filter','routeBreakdown=dayRoutes.map'])ok(analytics.includes(part),'daily financial '+part);
ok(!analytics.includes('completedDeliveries.filter(delivery=>delivery.route_id===route.id)'),'no per-route full deliveries scan');
for(const part of ['const routesById = new Map','const route = routesById.get(delivery.route_id)','completedDeliveries: activeRouteDeliveries(linkedDeliveries).filter'])ok(ledger.includes(part),'ledger '+part);
ok(!ledger.includes('linkedRoutes.find((item) => item.id === delivery.route_id)'),'no per-delivery route find');
ok(page.includes('const pending=activeRouteDeliveries(deliveries).filter'),'manual settlement excludes cancelled site order');
ok(page.includes('if(settlementInFlight.current)return;'),'settlement double-click lock preserved');
const suites=[...pre.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map(x=>x[1]);
ok(suites.length>=202,'at least 202 suites found '+suites.length);ok(new Set(suites).size===suites.length,'no duplicated suites');
for(const suite of suites)ok(fs.existsSync(suite),'suite present '+suite);
for(const name of ['scripts/verify-v111-r60-settlement-integrity.cjs','scripts/test-v111-r60-settlement-integrity.cjs'])ok(suites.includes(name),'registered '+name);
ok(fs.readFileSync('security/firestore.v111-r23-owner-only.rules','utf8').includes('if superadmin();'),'production rules unchanged');
console.log(`R60 SETTLEMENT INTEGRITY: ${checks} checks OK; ${suites.length} suites`);
