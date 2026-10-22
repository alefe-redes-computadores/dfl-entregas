'use strict';
/** Contratos + testes comportamentais R34, sem rede ou Firebase. */
const fs=require('node:fs');const assert=require('node:assert/strict');const path=require('node:path');const ts=require('typescript');
let checks=0;const ok=(truth,label)=>{assert.ok(truth,'R34: '+label);checks++;};
const read=(p)=>fs.readFileSync(p,'utf8');
function syntax(f){const output=ts.transpileModule(read(f),{fileName:f,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}});assert.deepEqual((output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>d.messageText),[],'R34 Sintaxe '+f);return output.outputText;}
const cache=new Map();function load(file){const resolved=path.resolve(file);if(cache.has(resolved))return cache.get(resolved).exports;const mod={exports:{}};cache.set(resolved,mod);new Function('module','exports','require',syntax(resolved))(mod,mod.exports,(name)=>{if(name.startsWith('.'))return load(path.resolve(path.dirname(resolved),name+'.ts'));throw Error('Import nao permitido no teste: '+name);});return mod.exports;}
const policy='lib/access/staffReleasePolicy.ts',report='lib/access/staffReleaseReport.ts',page='app/mais/acessos/evidencias/page.tsx';
for(const p of [policy,report,page,'components/access/StaffEvidenceItem.tsx','app/mais/acessos/seguranca/page.tsx','app/mais/acessos/prontidao/page.tsx']){syntax(p);ok(true,'TS/JSX '+p);}
const {assessStaffRelease,RELEASE_LABELS}=load(policy),{createSafeReleaseReport}=load(report);
const now=Date.parse('2026-10-20T18:00:00.000Z');
const uid='staff-12345678';
const account={uid,name:'NOME PARTICULAR',role:'motoboy',status:'suspended',issues:[],sections:['routes'],samples:{routes:true},projectionRisks:{},projectionsChecked:1};
const basic={ok:true,checkedAt:new Date(now).toISOString(),accounts:[account],accountsTruncated:false,requestsTruncated:false,
 projectionHealth:{sampled:1,unsafe:0,unknown:0},requests:{sampled:0,pending:0,inFlight:0,closed:0},
 flags:{staffPortal:false,staffRequests:false,canonicalApply:false,originsSeparated:true},
 productionRules:'nao_verificadas_pela_api',emulatorRules:'execucao_manual'};
const deep={ok:true,checkedAt:new Date(now).toISOString(),uid,role:'motoboy',status:'suspended',verification:'sample_only',eligibleForActivation:false,
 areas:[{area:'routes',sampled:3,truncated:false,findings:{}}],totals:{scanned:3,alerts:0,truncatedAreas:0},sampleLimit:12,sourceReadBudget:75};
const evalAt=(r=basic,d=deep,id=uid,t=now)=>assessStaffRelease(r,d,id,t);
const finding=(code,r=basic,d=deep,id=uid,t=now)=>evalAt(r,d,id,t).findings.includes(code);
const clean=evalAt();
ok(clean.status==='blocked'&&clean.eligibleForActivation===false,'nunca concede liberacao');
ok(clean.samples.accounts===1&&clean.samples.readinessDocuments===1&&clean.samples.deepDocuments===3,'amostragem explicitada');
ok(clean.deepVerified===true,'auditoria profunda correspondente');
ok(!finding('account_risks')&&!finding('integrity_risks'),'nao inventa erro local');
for(const code of ['live_rules_unverified','staff_identity_unverified','real_device_unverified'])ok(finding(code),'portao humano sempre pendente: '+code);
ok(finding('no_readiness',null),'ausencia de prontidao bloqueada');
ok(finding('readiness_stale',{...basic,checkedAt:new Date(now-16*60_000).toISOString()}),'prontidao vencida');
ok(finding('readiness_stale',{...basic,checkedAt:'invalido'}),'data geral invalida');
ok(finding('readiness_stale',{...basic,checkedAt:new Date(now+120_000).toISOString()}),'data futura recusada');
ok(!finding('readiness_stale',{...basic,checkedAt:new Date(now-15*60_000).toISOString()}),'limite de quinze minutos aceito');
ok(finding('accounts_missing',{...basic,accounts:[]},null),'sem conta sinalizada');
ok(finding('accounts_truncated',{...basic,accountsTruncated:true}),'amostra truncada de contas');
ok(finding('accounts_truncated',{...basic,requestsTruncated:true}),'amostra truncada de requests');
ok(finding('account_risks',{...basic,accounts:[{...account,issues:['conta_ativa']}]}),'alerta na conta');
ok(finding('account_risks',{...basic,accounts:[{...account,projectionRisks:{routes:['sensitive_pattern']}}]}),'risco individual de projecao');
ok(finding('unsafe_projections',{...basic,projectionHealth:{sampled:1,unsafe:1,unknown:0}}),'documento suspeito');
ok(finding('unsafe_projections',{...basic,projectionHealth:{sampled:1,unsafe:0,unknown:1}}),'amostra desconhecida');
ok(finding('unsafe_projections',{...basic,projectionHealth:undefined}),'saude de projecao ausente');
ok(finding('pending_operations',{...basic,requests:{...basic.requests,pending:2}}),'operacao pendente');
ok(finding('pending_operations',{...basic,requests:{...basic.requests,inFlight:1}}),'operacao em andamento');
for(const key of ['staffPortal','staffRequests','canonicalApply'])ok(finding('flags_on',{...basic,flags:{...basic.flags,[key]:true}}),'flag habilitada: '+key);
ok(finding('isolated_origin_missing',{...basic,flags:{...basic.flags,originsSeparated:false}}),'sem separacao de origem');
ok(finding('selected_not_in_sample',basic,deep,'staff-outra-1234'),'UID nao achado');
ok(finding('selected_active',{...basic,accounts:[{...account,status:'active'}]}),'ativacao inesperada');
ok(finding('no_integrity',basic,null),'auditoria profunda pendente');
ok(finding('integrity_mismatch',basic,{...deep,uid:'staff-outra-1234'}),'resposta alheia recusada');
ok(finding('integrity_mismatch',basic,{...deep,eligibleForActivation:true}),'resposta autoautorizante recusada');
ok(finding('integrity_mismatch',basic,{...deep,verification:'full'}),'falsa auditoria integral recusada');
ok(finding('integrity_stale',basic,{...deep,checkedAt:new Date(now-16*60_000).toISOString()}),'auditoria antiga');
ok(finding('integrity_stale',basic,{...deep,checkedAt:'xxx'}),'auditoria data invalida');
ok(finding('integrity_risks',basic,{...deep,totals:{...deep.totals,alerts:1}}),'divergencia no dado profundo');
ok(finding('integrity_partial',basic,{...deep,totals:{...deep.totals,truncatedAreas:1}}),'amostra profunda truncada');
ok(finding('integrity_partial',basic,{...deep,areas:[{...deep.areas[0],truncated:true}]}),'area parcial recusada');
const result=createSafeReleaseReport(clean,new Date(now).toISOString());
for(const forbidden of [uid,account.name,'@','telefone','NOME PARTICULAR','email@','token:'])ok(!result.includes(forbidden),'relatorio sem identidade pessoal: '+forbidden);
ok(result.includes('BLOQUEADO PARA ATIVACAO')&&result.includes('NAO publicar Rules'),'relatorio informativo e proibicao explicita');
ok(result.includes('Contas consultadas na amostra: 1'),'somente contagens agregadas');
ok(Object.keys(RELEASE_LABELS).length===19,'categorias tipadas completas');
const ui=read(page);
for(const piece of ['inspectStaffReadiness','inspectStaffIntegrity','selectedId.current','requestId.current','setIntegrity(null)','setManual({})','assessStaffRelease','createSafeReleaseReport','navigator.clipboard.writeText','staffTouch','toast.success','toast.error','StaffMetric','StaffEvidenceItem','Sem timer','Ativação indisponível'])ok(ui.includes(piece),'UI premium '+piece);
for(const piece of ['onSnapshot(', 'setInterval(', 'runTransaction(', 'writeBatch(', 'firebase deploy', 'activateStaff(', 'localStorage.', 'sessionStorage.'])ok(!ui.includes(piece),'Sem efeito permanente: '+piece);
const item=read('components/access/StaffEvidenceItem.tsx');
for(const piece of ['role="checkbox"','aria-checked','staffTouch()', 'min-h-16'])ok(item.includes(piece),'acessibilidade e tato: '+piece);
const security=read('app/mais/acessos/seguranca/page.tsx'),readiness=read('app/mais/acessos/prontidao/page.tsx');
ok(security.includes("router.push('/mais/acessos/evidencias')"),'navegacao auditoria');
ok(readiness.includes("router.push('/mais/acessos/evidencias')"),'navegacao prontidao');
const pre=read('scripts/pre-apk.cjs');ok(pre.includes("'scripts/verify-v111-r34-release-evidence.cjs'"),'R34 no PRE-APK');
for(const f of ['app/api/access/readiness/route.ts','app/api/access/integrity/route.ts'])ok(!ui.includes(f),'UI nao importa rotas de backend');
console.log(`R34: ${checks} checagens passaram. Nenhuma ativacao, escrita, deploy ou dados pessoais em relatorio.`);
