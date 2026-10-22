#!/usr/bin/env node
'use strict';
/** R37: cobertura comportamental do gate + orçamentos estáticos; sem rede nem credenciais. */
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
let passed=0;const ok=(x,msg)=>{assert.ok(x,`R37: ${msg}`);passed++;};
const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const parse=(file)=>{const result=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}});ok(!result.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),`Sintaxe ${file}`);return result.outputText;};
const policy='lib/access/staffTechnicalGate.ts';const report='app/mais/acessos/liberacao/page.tsx';
for(const f of [policy,report,'app/mais/acessos/seguranca/page.tsx','app/mais/acessos/evidencias/page.tsx','app/mais/acessos/prontidao/page.tsx','lib/access/staffReadinessPolicy.ts','lib/access/staffReleasePolicy.ts','components/access/StaffPremium.tsx','app/api/access/readiness/route.ts'])parse(f);
const loaded={};new Function('module','exports','require',parse(policy))({exports:loaded},loaded,()=>{throw Error('Import inesperado')});
const {assessTechnicalGate,safeTechnicalGateReport}=loaded;
const blank=assessTechnicalGate(null);
ok(blank.technicalStatus==='preparation_only'&&blank.staffActivation==='blocked'&&blank.readyForRelease===false,'Sem diagnóstico bloqueado');
ok(blank.publication==='requires_explicit_owner_action','Publicação exige autorização');
ok(blank.checks.length===8&&blank.checks.some(x=>x.id==='emulator'&&x.state==='pending'),'Emulator não presumido');
const base={ok:true,checkedAt:new Date().toISOString(),accounts:[{uid:'PRIVATE-1234',name:'SEGREDO DA PESSOA',status:'suspended',issues:[],projectionRisks:{}}],accountsTruncated:false,requestsTruncated:false,projectionHealth:{sampled:3,unsafe:0,unknown:0},requests:{pending:0,inFlight:0},flags:{staffPortal:false,staffRequests:false,canonicalApply:false,projectionRefresh:false,originsSeparated:true}};
const clean=assessTechnicalGate(base);
ok(clean.flagsEnabled===0&&clean.sampleDocuments===3,'Contagem apenas agregada');
ok(clean.checks.find(x=>x.id==='flags').state==='observed','Flags desligadas são observação e não liberação');
ok(clean.checks.find(x=>x.id==='sample').state==='observed','Amostra limitada nunca certifica cobertura global');
ok(clean.checks.some(x=>x.id==='rules'&&x.state==='pending'),'Rules sempre pendentes');
ok(clean.readyForRelease===false,'Mesmo com leitura limpa, sem liberação');
for(const flag of ['staffPortal','staffRequests','canonicalApply','projectionRefresh']){
 const r=assessTechnicalGate({...base,flags:{...base.flags,[flag]:true}});
 ok(r.flagsEnabled===1&&r.checks.find(x=>x.id==='flags').state==='blocked',`Flag ${flag} sinalizada`);
}
for(const patch of [{accounts:[]},{accountsTruncated:true},{requestsTruncated:true},{projectionHealth:{sampled:3,unsafe:1,unknown:0}},{requests:{pending:1,inFlight:0}},{accounts:[{...base.accounts[0],status:'active'}]}]){
 const r=assessTechnicalGate({...base,...patch});ok(r.checks.find(x=>x.id==='sample').state==='blocked','Divergência/truncamento bloqueia');
}
const output=safeTechnicalGateReport(clean,'2026-10-21T09:00:00Z');
for(const item of ['PRIVATE-1234','SEGREDO DA PESSOA','@example','34999999999'])ok(!output.includes(item),'Sem vazamento: '+item);
ok(output.includes('BLOQUEADA')&&output.includes('AUTORIZACAO EXPLICITA'),'Relatório não concede autorização');
const page=read(report);
for(const token of ['isSuperadminUid','StaffPageHeader','StaffPanel','StaffNavRow','StaffMetric','safeTechnicalGateReport','inspectStaffReadiness','staffTouch','toast.success','router.push',"setReport(null)","request.current++"] )ok(page.includes(token),'Experiência premium e leitura segura: '+token);
for(const x of [/onSnapshot\s*\(/,/setInterval\s*\(/,/writeBatch\s*\(/,/runTransaction\s*\(/,/localStorage\./,/sessionStorage\./,/window\.alert\s*\(/,/window\.confirm\s*\(/])ok(!x.test(page),`Página sem efeito perigoso ${x}`);
const readiness=read('app/api/access/readiness/route.ts');
for(const token of ["verifyIdToken(header.slice(7),true)",'.limit(ACCOUNT_LIMIT+1)', '.limit(REQUEST_LIMIT+1)', '.limit(1).get()', "projectionRefresh:process.env.DFL_STAFF_PROJECTION_REFRESH_ENABLED==='true'"])ok(readiness.includes(token),`API limita consulta: ${token}`);
const release=read('lib/access/staffReleasePolicy.ts');ok(release.includes('readiness.flags.projectionRefresh'),'Liberação antiga cobre quarta flag');
const readinessPage=read('app/mais/acessos/prontidao/page.tsx');ok(readinessPage.includes("['Sincronização de projeções','projectionRefresh']"),'Prontidão mostra quarta flag');
// Conservatively inspect the sensitive R27-R36 surface only, not the standalone staff portal listener.
const dirs=['app/mais/acessos','app/api/access','lib/access'];
for(const dir of dirs){const entries=fs.readdirSync(dir,{withFileTypes:true});let files=[];
 const recur=(p)=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){if(e.isDirectory())recur(path.join(p,e.name));else if(/\.(tsx?|jsx?)$/.test(e.name))files.push(path.join(p,e.name));}};recur(dir);
 for(const f of files){const s=fs.readFileSync(f,'utf8');ok(!/\bonSnapshot\s*\(|\bsetInterval\s*\(/.test(s),`Sem polling/listener permanente: ${f}`);}
}
const common=read('components/access/StaffPremium.tsx');ok(common.includes('focus-visible:outline')&&common.includes('p-3.5 sm:p-4')&&common.includes('px-4 py-6'),'Componentes premium globais mais compactos e acessíveis');
const pre=read('scripts/pre-apk.cjs');const suites=[...pre.matchAll(/^\s*'scripts\/[^']+\.cjs',/gm)].map(x=>x[0]);
ok(suites.length>=155,'154 suítes R36 preservadas e uma nova R37');ok(suites.some(line=>line.includes('r37-release-gate')),'R37 permanece registrada no PRE-APK');
for(const id of ['r36-refresh-atomicity','r35-synchronization','r34-release-evidence','r33-integrity','r32-projection-inspection','r31-premium-identity','r30-premium-access','r29-readiness','r28-canonical-operations','r27-safe-operations'])ok(pre.includes('verify-v111-'+id+'.cjs'),`Contrato ${id} presente`);
const ci=read('.github/workflows/dfl-r37-release-gate.yml');
for(const v of ['workflow_dispatch:','demo-dfl-entregas-r36','firebase.r36-emulator.json','test-v111-r36-refresh-emulator.cjs','scripts/pre-apk.cjs','tsc --noEmit','permissions:',"contents: read"] )ok(ci.includes(v),`CI exige ${v}`);
ok(!/^[ \t]*push\s*:/m.test(ci)&&!/^[ \t]*schedule\s*:/m.test(ci),'Workflow executa somente por comando manual');
for(const forbidden of ['firebase deploy','vercel deploy','vercel --prod','gh workflow run','git push'])ok(!ci.includes(forbidden),'CI sem publicação: '+forbidden);
const rules=read('firebase.r36-emulator.json');ok(rules.includes('security/firestore.v111-r26-candidate.rules'),'Emulator usa Rules candidatas');
console.log(`R37: ${passed} checagens, gates sempre bloqueados, nenhuma mutação, orçamento explícito.`);
