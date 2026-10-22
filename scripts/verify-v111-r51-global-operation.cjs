#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');let checks=0;
function check(value,description){assert.ok(value,'R51: '+description);checks++;}
function source(path){const s=fs.readFileSync(path,'utf8');const parsed=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);check(parsed.parseDiagnostics.length===0,'valid syntax '+path+': '+parsed.parseDiagnostics.map(d=>d.messageText).join(','));return s;}
const page=source('app/motoboys/page.tsx');
const index=source('lib/motoboy-overview.ts');
const dates=source('lib/motoboy-analytics.ts');
const report=source('app/relatorios/page.tsx');
const loja=source('app/loja/page.tsx');
const pre=source('scripts/pre-apk.cjs');
for(const marker of ['buildMotoboyOverview(motoboys, routes, deliveries)','[motoboys, routes, deliveries]','routeCount','completed','normalizedQuery','filter === \'ativos\'','filter === \'inativos\'','/motoboys/details?id=','aria-pressed={filter === value}','focus-visible:outline'])check(page.includes(marker),'team page '+marker);
check(!page.includes('deliveries.filter(delivery => routeIds.has'),'N² delivery scanning removed');
for(const marker of ['route.motoboy_id','rowsById.get(route.motoboy_id)','rowsByLegacyName.get(normalizeName(route.motoboy_name))','deliveryOwners.get(delivery.route_id)','new Set<number>()','if (delivery.completed)','rows[index].routeCount++','rows[index].deliveryCount++'])check(index.includes(marker),'motoboy index '+marker);
check(!index.includes('getDocs(') && !index.includes('onSnapshot('),'overview in-memory only');
check(dates.includes('const operationalDateFormatter = new Intl.DateTimeFormat('),'formatter shared');
check(dates.includes('operationalDateFormatter.format(new Date(value))'),'date formatting semantics preserved');
check(report.includes("if (activeTab !== 'geral' && activeTab !== 'operacao') return null"),'heavy report skipped outside consuming tabs');
check(report.includes("activeTab === 'geral' && intelligence &&")&&report.includes("activeTab === 'operacao' && intelligence &&"),'report tabs only consume non-null model');
check(report.includes('    activeTab,\n    customers,'),'tab dependency invalidates heavy memo');
check(!report.includes('[...model.hours].sort('),'largest hour no sorting');
check(loja.includes('const activeMotoboys = useMemo(')&&loja.includes('[motoboys]);'),'active motoboys reusable');
check(loja.includes('const activeScheduleDays = useMemo(')&&loja.includes('[schedule]);'),'schedule reusable');
const list=[...pre.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map(x=>x[1]);
check(list.length>=184,`184+ registered suites (found ${list.length})`);
check(new Set(list).size===list.length,'no duplicate suites');
check(list.includes('scripts/test-v111-r51-motoboy-overview.cjs'),'behavior test registered');
check(list.includes('scripts/verify-v111-r51-global-operation.cjs'),'global test registered');
for(const path of list)check(fs.existsSync(path),'suite present '+path);
check(fs.readFileSync('security/firestore.v111-r23-owner-only.rules','utf8').includes('if superadmin();'),'production rule unmodified');
console.log(`R51 GLOBAL OPERATION: ${checks} checks OK; ${list.length} suites`);
