#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let checked=0;
function ok(condition,why){assert.ok(condition,'R59: '+why);checked++;}
const read=f=>{const code=fs.readFileSync(f,'utf8');const tree=ts.createSourceFile(f,code,ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(tree.parseDiagnostics.length===0,'parse '+f);return code;};
const page=read('app/estoque/contagem/page.tsx');
const helper=read('lib/operation/stockCountDraft.ts');
const reports=read('app/estoque/relatorios/page.tsx');
const prices=read('app/estoque/precos/page.tsx');
const duplicates=read('app/clientes/duplicados/page.tsx');
const pre=read('scripts/pre-apk.cjs');
for(const marker of ['reviewStockCountDraft(products,values,baseline)', 'if(latest.conflicts.length)', 'if(latest.changed.length>200)', 'stockCountDraftState(p.current_quantity,values[p.id],baseline[p.id]).display','expected_quantity:draft.expectedQuantity','if(savingRef.current)return','savingRef.current=false','disabled={busy||conflicts.length>0}'])ok(page.includes(marker),'stock count screen '+marker);
for(const marker of ['const validReference =','const touched = raw !== undefined && quantity !== reference;', 'changed: touched && quantity !== current','conflict: touched && (!validReference || current !== reference)','expectedQuantity = touched ? reference : current','display: touched ? raw! : String(current)'])ok(helper.includes(marker),'draft helper '+marker);
ok(!page.includes('parseStockQuantityInput(values[p.id]??String(p.current_quantity))!==p.current_quantity'),'no fake stock edits caused by remote sync');
for(const marker of ['const start = useMemo(() => asOf - days * DAY, [asOf, days]);','const stockTotal = useMemo(() => stockValue(products), [products]);','analytics.ranking.slice(0, visibleCount)','displayedRanking.map(','setVisibleCount((count) => count + 40)'])ok(reports.includes(marker),'reports '+marker);
for(const marker of ['filtered.slice(0,visibleCount).map','setVisibleCount(v=>v+40)','normalizedCostDisplay(i.product,i.latest).label'])ok(prices.includes(marker),'prices '+marker);
for(const marker of ['const mergeInFlight = useRef(false)','mergeInFlight.current = true','mergeInFlight.current = false','candidates.slice(0, visibleCount).map','setVisibleCount((count) => count + 30)'])ok(duplicates.includes(marker),'duplicates '+marker);
const suites=[...pre.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map(x=>x[1]);
ok(suites.length>=200, '200+ suites');ok(new Set(suites).size===suites.length,'unique suites');
for(const script of suites)ok(fs.existsSync(script),'existing suite '+script);
for(const name of ['scripts/verify-v111-r59-stock-session.cjs','scripts/test-v111-r59-stock-session.cjs'])ok(suites.includes(name),'new suite '+name);
ok(fs.readFileSync('security/firestore.v111-r23-owner-only.rules','utf8').includes('if superadmin();'),'owner-only unchanged');
console.log(`R59 STOCK SESSION: ${checked} verificações aprovadas; ${suites.length} suítes preservadas`);
