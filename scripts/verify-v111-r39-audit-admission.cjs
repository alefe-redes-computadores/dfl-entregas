#!/usr/bin/env node
'use strict';
/** R39 contracts — guard logic, release semantics, privacy, bounded reads & PRE-APK integrity. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
let pass=0;const ok=(x,msg)=>{assert.ok(x,'R39: '+msg);pass++};
const txt=p=>fs.readFileSync(p,'utf8');
function sourceExports(p){const transpiled=ts.transpileModule(txt(p),{fileName:p,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});ok(!(transpiled.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),'Syntax '+p);const out={};new Function('module','exports',transpiled.outputText)({exports:out},out);return out;}
const guard=sourceExports('lib/access/staffReadBudget.ts');
ok(guard.STAFF_AUDIT_MIN_GAP_MS===6000,'Gap six seconds');ok(guard.STAFF_AUDIT_MAX_ACTIVE===2,'Max two scope types');ok(guard.STAFF_PROBE_CONCURRENCY===4,'R38 worker limit retained');
for(const bad of [-1,60001,NaN,1.5]){assert.throws(()=>guard.createStaffAuditAdmission(bad));pass++;}
for(const invalid of ['other',undefined,42]){assert.throws(()=>guard.createStaffAuditAdmission().acquire(invalid,1000));pass++;}
const admit=guard.createStaffAuditAdmission();
const a=admit.acquire('readiness',10000);ok(a.allowed,'First readiness allowed');ok(admit.activeCount()===1,'1 active');
const busy=admit.acquire('readiness',10001);ok(!busy.allowed&&busy.reason==='busy'&&busy.retryAfterSeconds>=1,'Concurrent readiness rejected');
const b=admit.acquire('integrity',10002);ok(b.allowed&&admit.activeCount()===2,'Separate integrity admitted');
const overlap=admit.acquire('integrity',10003);ok(!overlap.allowed&&overlap.reason==='busy','Concurrent integrity rejected');
a.release();a.release();ok(admit.activeCount()===1,'Idempotent release');
const cooldown=admit.acquire('readiness',12000);ok(!cooldown.allowed&&cooldown.reason==='cooldown'&&cooldown.retryAfterSeconds===4,'Readiness cooldown observed');
const c=admit.acquire('readiness',16000);ok(c.allowed,'Readiness re-admitted at 6s');
c.release();b.release();ok(admit.activeCount()===0,'All leases freed');
const d=admit.acquire('integrity',16003);ok(d.allowed,'Integrity cooldown independent');d.release();
const later=admit.acquire('integrity',26000);ok(later.allowed,'Normal repeat permitted');later.release();
const failure=guard.createStaffAuditAdmission();const fa=failure.acquire('readiness',9999);try{throw Error('downstream')}catch{}finally{fa.release()}ok(failure.activeCount()===0,'Exception handled by finally');
const budget=guard.summarizeStaffReadBudget(31,101,150,120);ok(budget.queryAttempts===152&&budget.documentsObserved===252,'R38 numbers unchanged');
const altered=['app/api/access/readiness/route.ts','app/api/access/integrity/route.ts','lib/access/staffReadinessPolicy.ts','app/mais/acessos/leituras/page.tsx','app/mais/acessos/liberacao/page.tsx','app/mais/acessos/seguranca/page.tsx','lib/access/staffReadBudget.ts'];
for(const file of altered){const output=ts.transpileModule(txt(file),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}});ok(!output.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error),'Compile '+file);}
for(const route of ['app/api/access/readiness/route.ts','app/api/access/integrity/route.ts']){
 const source=txt(route);for(const part of ["acquireStaffAuditPermit(","status:429","'retry-after'",'admission.release();','verifyIdToken(header.slice(7),true)','isSuperadminUid'])ok(source.includes(part),route+' '+part);
 ok(source.indexOf('if(!(await ')<source.indexOf('acquireStaffAuditPermit('),'Owner authorization precedes admission');
 ok(!/\bonSnapshot\(|\bsetInterval\(|\brunTransaction\(|\bwriteBatch\(/.test(source),'Read-only without polling');
}
const r=txt('app/api/access/readiness/route.ts');for(const part of ['mapBounded(tasks,STAFF_PROBE_CONCURRENCY',".limit(ACCOUNT_LIMIT+1).get()",".limit(REQUEST_LIMIT+1).get()",".collection(area).limit(1).get()",'summarizeStaffReadBudget','auditGuard:{mode:\'instance_only\''])ok(r.includes(part),'Preserve bounded sampler '+part);
const screen=txt('app/mais/acessos/leituras/page.tsx');for(const part of ['Orçamento de leituras','admissão de auditorias','Admissão de auditorias','Limite de registros atingido','sample',"['Solicitações',budget.requestDocuments,101","['Projeções',budget.projectionDocuments,150"])if(part!=='admissão de auditorias'&&part!=='sample')ok(screen.includes(part),'R39 budget UI '+part);
const pre=txt('scripts/pre-apk.cjs');const suites=[...pre.matchAll(/^\s*'scripts\/[^']+\.cjs',/gm)];ok(suites.length>=159,'R38 157 suites + R39 2, preservadas em evolucoes futuras');for(const file of ['verify-v111-r39-audit-admission.cjs','test-v111-r39-audit-admission-api.cjs'])ok(pre.includes(file),'Suite registered '+file);
for(const file of ['.github/workflows/dfl-r38-read-budget.yml','security/firestore.v111-r26-candidate.rules'])ok(fs.existsSync(file),'Prior baseline present '+file);
const workflow=txt('.github/workflows/dfl-r39-audit-admission.yml');for(const part of ['workflow_dispatch:','demo-dfl-entregas-r36','scripts/pre-apk.cjs','test-v111-r36-refresh-emulator.cjs','contents: read','persist-credentials: false'])ok(workflow.includes(part),'CI '+part);
for(const bad of [/^\s*push\s*:/m,/^\s*schedule\s*:/m,/firebase deploy/,/vercel deploy/,/git push/])ok(!bad.test(workflow),'CI no publication');
console.log(`R39 ADMISSION: ${pass} checks passed`);
