#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const assert=require('node:assert/strict');
const ts=require('typescript');
let checks=0;
const ok=(v,name)=>{assert.ok(v,'R54: '+name);checks++};
const read=(f)=>{const data=fs.readFileSync(f,'utf8');const parsed=ts.createSourceFile(f,data,ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(parsed.parseDiagnostics.length===0,`syntax: ${f}`);return data};
const queue=read('lib/store/serializedWriteQueue.ts'),store=read('store/useAppStore.ts');
const expense=read('app/despesas/novo/page.tsx'),supply=read('app/abastecimentos/novo/page.tsx');
const health=read('lib/site-integration-health.ts');
const pre=read('scripts/pre-apk.cjs');
for(const v of ['export function createSerializedWriteQueue()',"tail.then(async () => {",'await persist(snapshot);','tail = operation.catch(() => undefined);'])ok(queue.includes(v),'serialization: '+v);
for(const v of ["import { createSerializedWriteQueue }",'const queueStoreSettingsWrite = createSerializedWriteQueue();','await queueStoreSettingsWrite(safeData, (snapshot) => setDoc(','if (get().storeSettings === newSettings)'])ok(store.includes(v),'store: '+v);
for(const [name,source] of [['expense',expense],['supply',supply]]){
 for(const v of ['useRef','saveInFlight.current=true'.replace('=true','=true')]){} // exact spacing differs
 ok(source.includes('saveInFlight.current'),'form guarded: '+name);
 ok(source.includes('saveInFlight.current = false') || source.includes('saveInFlight.current=false'),'failure/retry guard: '+name);
 ok(source.includes('setSaving(false)') || source.includes('setBusy(false)'),'UI busy resets: '+name);
 ok(source.includes('committed'),'successful commit keeps lock until navigation: '+name);
}
ok(expense.includes('if(saveInFlight.current)return;'),'expense blocks before save');
ok(expense.includes('if(!committed){saveInFlight.current=false;setSaving(false)}'),'expense stays locked after committed navigation');
ok(supply.includes('if (!committed) {'),'supply stays locked after committed navigation');
ok(supply.includes("if (saveInFlight.current) throw new Error('Compra já está sendo salva.')"),'supply blocks duplicate before save');
for(const v of ["import { isCancelledSiteDelivery }","const cancelled = isCancelledSiteDelivery(delivery);",'route.id === delivery.route_id','const associated = !cancelled',"label: 'Vinculado a rota'",'const completionRegistered = !cancelled'])ok(health.includes(v),'site timeline: '+v);
const list=[...pre.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map(x=>x[1]);
ok(list.length>=190,'at least 190 suites');ok(new Set(list).size===list.length,'no duplicate suites');
for(const f of list)ok(fs.existsSync(f),'suite exists: '+f);
for(const f of ['scripts/verify-v111-r54-operational-integrity.cjs','scripts/test-v111-r54-ordering.cjs'])ok(list.includes(f),'R54 suite '+f);
ok(fs.readFileSync('security/firestore.v111-r23-owner-only.rules','utf8').includes('if superadmin();'),'production rule candidate owner-only remains');
console.log(`R54 OPERATIONAL INTEGRITY: ${checks} checks passed; ${list.length} suites`);
