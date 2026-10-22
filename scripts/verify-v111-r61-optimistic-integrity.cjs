#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
let checks=0;
const ok=(c,m)=>{assert.ok(c,'R61: '+m);checks++;};
const file=(p)=>{const s=fs.readFileSync(p,'utf8');const ast=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(ast.parseDiagnostics.length===0,'valid TS/TSX '+p);return s;};
const store=file('store/useAppStore.ts');
const helper=file('lib/operation/optimisticRollback.ts');
const supplier=file('app/estoque/fornecedores/page.tsx');
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
for(const name of ['rollbackAddedEntity','rollbackUpdatedEntity','rollbackDeletedEntity'])ok(store.includes(name),'integrated '+name);
for(const name of ['addStockSupplier','updateStockSupplier','addTeamMember','updateTeamMember','addStockProduct','updateStockProduct','deleteStockSupply']){
 const start=store.indexOf('      '+name+': async ');ok(start>=0,'operation '+name);
 const segment=store.slice(start,store.indexOf('\n      },',start)+9);
 ok(segment.includes('set((state) => ({'),'state-preserving local mutation '+name);
 ok(segment.includes('catch (error)'),'rollback '+name);
 ok(!/set\(\{\s*(stockProducts|stockMovements|stockSuppliers|stockSupplies|teamMembers): previous/.test(segment),'no list-wide rollback '+name);
}
for(const part of ['item.id === previous.id','item === optimistic','current.some((item) => item.id === previous.id)','item !== optimistic'])ok(helper.includes(part),'guarded operation '+part);
for(const part of ['useRef','claimSubmission(saveLock.current)','archiveLocks.current.has(supplier.id)','archiveLocks.current.delete(supplier.id)','disabled={busy || archiving}','if (!saved) releaseSubmission(saveLock.current)','aria-modal="true"'])ok(supplier.includes(part),'supplier protection '+part);
ok(supplier.includes('Arquivar fornecedor')&&supplier.includes('Reativar fornecedor'),'archiving preserved');
ok(supplier.includes('Editar fornecedor')&&supplier.includes('Salvar fornecedor'),'editing preserved');
const suites=[...pre.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map((m)=>m[1]);
ok(suites.length>=204,'R61 suites '+suites.length);ok(new Set(suites).size===suites.length,'no duplicate suites');
for(const name of ['scripts/verify-v111-r61-optimistic-integrity.cjs','scripts/test-v111-r61-optimistic-rollback.cjs'])ok(suites.includes(name),'new suite '+name);
ok(fs.readFileSync('security/firestore.v111-r23-owner-only.rules','utf8').includes('if superadmin();'),'owner rules unchanged');
console.log(`R61 STRUCTURAL: ${checks} checks OK`);
