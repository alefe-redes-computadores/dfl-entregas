#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const path='components/home/OperationalCommandCenter.tsx';const s=fs.readFileSync(path,'utf8');
const ast=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length,0,'JSX sem erros de parse');
for(const needle of [
  'line-clamp-2 break-words', 'aria-label={`${item.label}: ${item.count} pendência',
  'focus-visible:outline-amber-400','min-h-14','tabular-nums',
  'siteInboxProjection(allDeliveries)', 'siteInbox.rows.length === 1',
  'isCancelledSiteDelivery(delivery)','classifyHomeExceptions(',
  'routeIfoodCodeProgress(', 'buildPendingMotoboySettlements(',
  'deliveryActionHref(firstMissingIfoodCode)',
  'showAllActions ? visibleActionRows : visibleActionRows.slice(0, 2)',
])assert.ok(s.includes(needle),'Contrato ausente: '+needle);
assert.ok(!s.includes('onSnapshot('),'Sem listener Firestore novo');
assert.ok(!s.includes('setInterval('),'Sem polling novo');
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
assert.ok(pre.includes("'scripts/test-r126-e9-home-actions.cjs'"));
const all=[...pre.matchAll(/'scripts\/[^']+\.cjs'/g)].map(x=>x[0]);
assert.equal(new Set(all).size,all.length,'Nenhum gate repetido');
console.log('R126 E9 HOME PREMIUM — 17 contratos aprovados');
