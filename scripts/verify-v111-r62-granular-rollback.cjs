#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const read=(f)=>{const src=fs.readFileSync(f,'utf8');const ast=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true);assert.equal(ast.parseDiagnostics.length,0,`parse ${f}`);return src};
const source=read('store/useAppStore.ts');
const helper=read('lib/operation/optimisticRollback.ts');
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
const names=['updateRoute','startRoute','deleteRoute','updateMotoboy','deleteMotoboy','updateFueling','deleteFueling','updateDelivery','deleteDelivery','addDeliveries','addOperationalExpense','deleteIfoodPendingConfirmation','updateCustomer','mergeCustomers'];
let count=0;
const ok=(value,why)=>{assert.ok(value,'R62 '+why);count++};
for(const name of names){
 const anchor=`      ${name}: async `;
 const a=source.indexOf(anchor);
 ok(a>=0,`${name} exists`);
 const b=source.indexOf('\n      },',a);
 ok(b>a,`${name} bounded`);
 const part=source.slice(a,b);
 ok(part.includes('rollbackUpdatedEntity(')||part.includes('rollbackDeletedEntity(')||part.includes('rollbackAddedEntity(')||part.includes('rollbackAddedEntities(')||part.includes('rollbackUpdatedEntities('),`${name} granular rollback`);
 ok(!/set\(\{\s*(routes|deliveries|customers|motoboys|fuelings|operationalExpenses|ifoodPendingConfirmations):\s*previous/.test(part),`${name} no whole-array rewind`);
}
for(const name of ['addRoute','addMotoboy','addFueling','addDelivery','addCustomer']){
 const a=source.indexOf(`      ${name}: async `),b=source.indexOf('\n      },',a);
 ok(source.slice(a,b).includes('rollbackAddedEntity('),`${name} guarded optimistic add`);
}
for(const name of ['rollbackAddedEntity','rollbackUpdatedEntity','rollbackDeletedEntity','rollbackAddedEntities','rollbackUpdatedEntities']){
 ok(helper.includes(`export function ${name}`),`helper ${name}`);
}
ok(source.includes('if (deliveryCommitCompleted)'),'committed delivery post-action guard preserved');
ok(source.includes('if (deletionCommitted)'),'committed deletion post-action guard preserved');
ok(source.includes('const snapshot = await transaction.get(ref)'),'transactional authority preserved');
ok(source.includes('transaction.set(settlementRef'),'settlement atomicity preserved');
const suites=[...pre.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map(x=>x[1]);
ok(suites.length>=206,`at least 206 suites found ${suites.length}`);
ok(new Set(suites).size===suites.length,'unique suites');
for(const file of suites)ok(fs.existsSync(file),`exists ${file}`);
for(const file of ['scripts/verify-v111-r62-granular-rollback.cjs','scripts/test-v111-r62-rollback-concurrency.cjs'])ok(suites.includes(file),`registered ${file}`);
ok(fs.readFileSync('security/firestore.v111-r23-owner-only.rules','utf8').includes('if superadmin();'),'owner-only rules remain');
console.log(`R62 GRANULAR ROLLBACK: ${count} structural checks OK`);
