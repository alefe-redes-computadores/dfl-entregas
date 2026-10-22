#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const assert=require('node:assert/strict');const ts=require('typescript');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
const read=p=>fs.readFileSync(p,'utf8');
const files=['lib/access/staffOperationPolicy.ts','lib/access/staffRequestRetry.ts','lib/access/staffOperationsClient.ts','lib/access/staffRoleMatrix.ts','lib/access/staffProjection.ts','components/access/StaffPortal.tsx','app/api/access/operations/route.ts'];
for(const p of files){const result=ts.transpileModule(read(p),{fileName:p,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});ok(!result.diagnostics.some(d=>d.category===1),'TS parse '+p)}
const api=read('app/api/access/operations/route.ts');
for(const part of ['verifyIdToken(header.slice(7),true)',"process.env.DFL_STAFF_OPERATION_REQUESTS_ENABLED !== 'true'",'adminDb.runTransaction','const projected=await tx.get(',"if (!projected.exists) return 'unlisted'",'deliveryEligibleForRequest(delivery, routeSnap.data() || {}, String(account.linkedMotoboyId || \'\'),routeId,account.role)',"effect:'none_owner_review_required'",'tx.create(requests'])ok(api.includes(part),'Protecao da API preservada: '+part);
ok(!/tx\.(?:create|update|set|delete)\(adminDb\.collection\('(deliveries|routes|stock_products|stock_supplies|stock_movements)'/.test(api),'Equipe nunca escreve colecoes canonicas');
const portal=read('components/access/StaffPortal.tsx');
for(const part of ['sendingRef.current=true','sending||sendingRef.current','setPendingOperation(null)','account.role===\'operacao\'','row.status!==\'Cancelada\'','securityEpoch.current'])ok(portal.includes(part),'Portal: '+part);
const preview=read('lib/access/staffRoleMatrix.ts');ok(preview.includes("role === 'operacao' || !!linkedMotoboyId?.trim()"),'Previa acompanha Operacao sem motoboy');
const client=read('lib/access/staffOperationsClient.ts');ok(client.includes('requestIds.reserve(')&&client.includes('auth.currentUser?.uid !== user.uid'),'Retry idempotente e sessao verificada');
const rules=read('security/firestore.v111-r26-candidate.rules');ok(rules.includes('allow create, update, delete: if false;')&&!rules.includes('match /staff_operation_requests'),'Rules candidatas continuam leitura restrita');
const owner=read('security/firestore.v111-r23-owner-only.rules');ok(!owner.includes('match /staff_workspaces'),'Regras owner-only preservadas');
const pre=read('scripts/pre-apk.cjs');const tests=[...pre.matchAll(/^  '(scripts\/[^']+\.cjs)'/gm)].map(m=>m[1]);ok(tests.length>=208,'Preserva >=208 suites');ok(new Set(tests).size===tests.length,'Sem suites duplicadas');for(const t of ['scripts/verify-v111-r63-staff-workflows.cjs','scripts/test-v111-r63-staff-workflows.cjs','scripts/verify-v111-r62-granular-rollback.cjs'])ok(tests.includes(t),`Suite ${t} preservada`);
console.log('R63 STAFF WORKFLOWS:',checks,'checagens estruturais aprovadas');
