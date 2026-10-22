#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let checks=0;
const check=(value,description)=>{assert.ok(value,'R58 '+description);checks++;};
const parse=(path)=>{
 const value=fs.readFileSync(path,'utf8');
 const root=ts.createSourceFile(path,value,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 check(root.parseDiagnostics.length===0,'parse '+path);
 return value;
};
const report=parse('lib/reports/buildReportModel.ts');
const home=parse('app/page.tsx');
const date=parse('lib/reports/time.ts');
const pre=parse('scripts/pre-apk.cjs');
for(const marker of [
 'const deliveryCountByRoute = new Map<string, number>();',
 'for (const delivery of deliveries)',
 'deliveryCountByRoute.set(',
 'if (!deliveryCountByRoute.has(route.id)) return;',
 'deliveryCount: deliveryCountByRoute.get(route.id) ?? 0',
 'let firstDateKey: string | null = null;',
 'if (key && (!firstDateKey || compareDateKeys(key, firstDateKey) < 0))',
 'const periodStartKey = period.start ? saoPauloDateKey(period.start) : null;',
 'const periodEndKey = saoPauloDateKey(period.end);',
 'const previousStartKey = period.previousStart ? saoPauloDateKey(period.previousStart) : null;',
 'const previousEndKey = period.previousEnd ? saoPauloDateKey(period.previousEnd) : null;',
])check(report.includes(marker),'report '+marker);
check(!report.includes('deliveries.filter(\n        (delivery) => delivery.route_id === route.id'),'no quadratic route filter');
check(!report.includes('const validKeys = normalized\n    .map('),'all-time range without nlogn sort');
for(const marker of [
 'const routeTimes = new Map<Route, number>();',
 'routeTimes.set(route, routeTimestamp!.getTime())',
 'routesDoDia.sort((a, b) =>',
 'routeTimes.get(a) ?? Number.MAX_SAFE_INTEGER',
 'const deliveriesCreatedOnDay = new Set(ordersDoDia);',
 'deliveriesCreatedOnDay.has(delivery) &&',
 'isCancelledSiteDelivery(delivery)',
 'isFutureScheduledDelivery(delivery)',
 'isSiteOrderAwaitingHomeReview(delivery)',
 'deliveryEconomicValue(order)',
])check(home.includes(marker),'home '+marker);
check(!home.includes('const deliveryKey = operationalKey('),'home avoids redundant date conversion');
check(date.includes('date instanceof Date && Number.isFinite(date.getTime())'),'toDate checked for valid Date');
check(date.includes('      } catch {\n        return null;'),'toDate failure degraded safely');
const suites=[...pre.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map(x=>x[1]);
check(suites.length >= 198,'198+ suites');
check(new Set(suites).size===suites.length,'suites never duplicated');
for (const script of suites) check(fs.existsSync(script),'existing suite '+script);
for (const f of ['scripts/verify-v111-r58-operational-performance.cjs','scripts/test-v111-r58-operational-performance.cjs'])check(suites.includes(f),'R58 suite registered '+f);
check(fs.readFileSync('security/firestore.v111-r23-owner-only.rules','utf8').includes('if superadmin();'),'owner-only preserved');
console.log(`R58 OPERATIONAL PERFORMANCE: ${checks} contracts OK; ${suites.length} suites`);
