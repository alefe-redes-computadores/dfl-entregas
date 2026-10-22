#!/usr/bin/env node
'use strict';
/** R38 contracts: in-memory concurrency, pure budget, staff owner, old gate and CI. */
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
let pass=0;const ok=(condition,message)=>{assert.ok(condition,'R38: '+message);pass++;};
const text=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
function moduleExports(p,inject={}){
 const file=text(p);
 const transformed=ts.transpileModule(file,{fileName:p,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}});
 if(transformed.diagnostics?.length) console.error('DIAGNOSTICS',p,transformed.diagnostics.map(d=>d.code+' '+ts.flattenDiagnosticMessageText(d.messageText,' ')));
 ok(!transformed.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'Sintaxe '+p);
 const exports={};const module={exports};
 new Function('require','module','exports','window','fetch','AbortController',transformed.outputText)((name)=>{if(name in inject)return inject[name];throw Error('Unexpected require '+name);},module,exports,inject.window,inject.fetch,global.AbortController);
 return module.exports;
}
async function main(){
 const budgetFile='lib/access/staffReadBudget.ts';
 const b=moduleExports(budgetFile);
 ok(b.STAFF_PROBE_CONCURRENCY===4,'Concorrencia de sondagens e quatro');
 ok(b.STAFF_MAX_QUERY_ATTEMPTS===152,'Teto teorico de queries');
 const blank=b.summarizeStaffReadBudget(0,0,0,0);
 ok(blank.queryAttempts===2&&blank.documentsObserved===0,'Diagnostico vazio mantem duas consultas raiz');
 ok(blank.mode==='manual_sample'&&blank.billedReads==='not_measured','Nao confundir API com faturamento');
 const max=b.summarizeStaffReadBudget(31,101,150,150);
 ok(max.queryAttempts===152&&max.documentsObserved===282,'Maximo conservador observado');
 ok(max.maxProbeConcurrency===4&&max.maxDocumentsObserved===282,'Metadados do teto');
 const clamped=b.summarizeStaffReadBudget(999,999,999,999);
 ok(clamped.documentsObserved<=282&&clamped.queryAttempts<=152,'Entrada arbitraria nao explode contadores');
 ok(b.summarizeStaffReadBudget(-1,NaN,-2,Infinity).queryAttempts===2,'Valores invalidos saneados');
 ok(b.safeReadBudgetReport(null,'nonsense').includes('NAO CONSULTADO'),'Sem consulta nao inventa custo');
 const txt=b.safeReadBudgetReport(max,'2026-10-21T12:00:00Z');
 for(const content of ['152','282','NAO MEDIDO','BLOQUEADAS'])ok(txt.includes(content),'Relatorio explicita '+content);
 for(const sensitive of ['alefe','PRIVATE-UID','nome_cliente','token','@gmail.com'])ok(!txt.includes(sensitive),'Sem PII: '+sensitive);
 ok(!txt.includes('aprovado')&&!txt.includes('AUTORIZADA'),'Nao autoriza ativacao');
 for(const count of [1,2,4,10,151]){
  let live=0,maxLive=0;
  const jobs=Array.from({length:count},(_,i)=>i);
  const ordered=await b.mapBounded(jobs,4,async(i)=>{
   live++;maxLive=Math.max(maxLive,live);
   await new Promise(resolve=>setImmediate(resolve));
   live--;return i*3;
  });
  ok(maxLive<=4,'Concorrencia mantida com '+count+' tarefas');
  ok(ordered.every((x,i)=>x===i*3),'Ordem preservada com '+count+' tarefas');
 }
 ok((await b.mapBounded([],4,async()=>{throw Error('not called');})).length===0,'Lista vazia nao consulta');
 for(const invalid of [0,17,-1,1.1,NaN]){
  let blocked=false;try{await b.mapBounded([1],invalid,async()=>1);}catch(e){blocked=String(e).includes('CONCURRENCY_LIMIT_INVALID');}
  ok(blocked,'Limite invalido bloqueado: '+invalid);
 }
 let rejected=false;try{await b.mapBounded([0,1],2,async(x)=>{if(x===1)throw Error('FAIL_TEST');return 1;});}catch(e){rejected=String(e).includes('FAIL_TEST');}
 ok(rejected,'Erro de leitura propaga e impede sucesso falso');
 const files=['lib/access/staffReadBudget.ts','lib/access/staffReadinessClient.ts','lib/access/staffReadinessPolicy.ts','app/api/access/readiness/route.ts','app/mais/acessos/leituras/page.tsx','app/mais/acessos/prontidao/page.tsx','app/mais/acessos/liberacao/page.tsx','app/mais/acessos/seguranca/page.tsx','lib/access/staffTechnicalGate.ts'];
 for(const file of files){const output=ts.transpileModule(text(file),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}});ok(!output.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'TS/JSX valido: '+file);}
 const api=text('app/api/access/readiness/route.ts');
 for(const token of ['mapBounded(tasks,STAFF_PROBE_CONCURRENCY',".limit(ACCOUNT_LIMIT+1).get()",".limit(REQUEST_LIMIT+1).get()",'.collection(area).limit(1).get()','summarizeStaffReadBudget(accountsSnap.size,requestsSnap.size,tasks.length,projectedDocs)','verifyIdToken(header.slice(7),true)','isSuperadminUid'])ok(api.includes(token),'API protegida e contabilizada: '+token);
 for(const forbidden of ['setInterval(', 'onSnapshot(', 'writeBatch(', 'runTransaction(', 'setTimeout('])ok(!api.includes(forbidden),'Readiness sem mutacao/polling: '+forbidden);
 const budgetPage=text('app/mais/acessos/leituras/page.tsx');
 for(const term of ['useAppStore','isSuperadminUid','inspectStaffReadiness','readBudget','safeReadBudgetReport','StaffPageHeader','StaffMetric','StaffPanel','StaffNavRow','staffTouch','toast.success','busy','role="alert"'])ok(budgetPage.includes(term),'Painel premium: '+term);
 for(const forbidden of ['onSnapshot(', 'setInterval(', 'localStorage.', 'sessionStorage.', 'window.confirm(', 'window.alert('])ok(!budgetPage.includes(forbidden),'Pagina nao tem polling/storage: '+forbidden);
 const clientSrc=text('lib/access/staffReadinessClient.ts');
 for(const term of ["if(activeRead?.uid===owner.uid)return activeRead.promise;",'activeRead={uid:owner.uid,promise}', 'if(activeRead?.promise===promise)activeRead=null','getIdToken(true)',"cache:'no-store'", "credentials:'omit'"])ok(clientSrc.includes(term),'Single-flight seguro: '+term);
 // Exercita o cliente com autenticacao e fetch artificiais. NENHUMA rede real.
 let current={uid:'owner-one',getIdToken:async()=> 'token-one'};
 const auth={get currentUser(){return current;}};
 let fetches=0;
 let pending=[];
 const fetchFake=async(url,options)=>{
  fetches++;ok(options.headers.authorization==='Bearer token-one'||options.headers.authorization==='Bearer token-two','Token presente apenas na requisicao');
  return new Promise((resolve)=>pending.push(()=>resolve({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({ok:true,accounts:[],flags:{},readBudget:{}})})));
 };
 const client=moduleExports('lib/access/staffReadinessClient.ts',{
  '@capacitor/core':{Capacitor:{isNativePlatform:()=>false}},'@/lib/firebase':{auth},
  '@/lib/access/roles':{isSuperadminUid:uid=>uid?.startsWith('owner-')},
  window:{setTimeout,clearTimeout},fetch:fetchFake,
 });
 const a=client.inspectStaffReadiness(),c=client.inspectStaffReadiness();
 ok(a===c,'Duas consultas do mesmo owner dividem a mesma promise');
 await new Promise(resolve=>setImmediate(resolve));ok(fetches===1,'Apenas uma requisicao HTTP para dois cliques concorrentes');
 pending.shift()();await Promise.all([a,c]);
 const next=client.inspectStaffReadiness();await new Promise(resolve=>setImmediate(resolve));ok(fetches===2,'Nao cacheia depois de concluir');
 pending.shift()();await next;
 current={uid:'owner-two',getIdToken:async()=> 'token-two'};
 const diff=client.inspectStaffReadiness();await new Promise(resolve=>setImmediate(resolve));ok(fetches===3,'UID diferente nao herda o resultado anterior');
 pending.shift()();await diff;
 current=null;
 let noOwner=false;try{await client.inspectStaffReadiness();}catch{noOwner=true;}
 ok(noOwner,'Sem owner nao dispara leitura');
 const gate=moduleExports('lib/access/staffTechnicalGate.ts');
 const sample={ok:true,checkedAt:new Date().toISOString(),accounts:[{status:'suspended',issues:[],projectionRisks:{}}],accountsTruncated:false,requestsTruncated:false,projectionHealth:{sampled:1,unsafe:0,unknown:0},requests:{pending:0,inFlight:0},flags:{staffPortal:false,staffRequests:false,canonicalApply:false,projectionRefresh:false}};
 ok(gate.assessTechnicalGate(sample).checks.find(x=>x.id==='sample').state==='observed','Amostra fresca apenas observada');
 ok(gate.assessTechnicalGate({...sample,checkedAt:'2000-01-01T00:00:00Z'}).checks.find(x=>x.id==='sample').state==='blocked','Amostra antiga bloqueada');
 ok(gate.assessTechnicalGate({...sample,checkedAt:'nonsense'}).checks.find(x=>x.id==='sample').state==='blocked','Amostra invalida bloqueada');
 ok(gate.assessTechnicalGate({...sample,checkedAt:new Date(Date.now()+360000).toISOString()}).checks.find(x=>x.id==='sample').state==='blocked','Amostra do futuro bloqueada');
 ok(gate.assessTechnicalGate(sample).readyForRelease===false,'Mesmo fresco, staff nunca ativado');
 ok(text('scripts/pre-apk.cjs').includes("'scripts/verify-v111-r38-read-budget.cjs'"),'PRE-APK contem R38');
 const suiteCount=[...text('scripts/pre-apk.cjs').matchAll(/^\s*'scripts\/[^']+\.cjs',/gm)].length;
 ok(suiteCount>=157,'Nenhuma suite R37 removida; >=157 suites');
 for(const file of ['app/mais/acessos/seguranca/page.tsx','app/mais/acessos/liberacao/page.tsx'])ok(text(file).includes('/mais/acessos/leituras'),'Navegacao '+file);
 const workflow=text('.github/workflows/dfl-r38-read-budget.yml');
 for(const term of ['workflow_dispatch:', 'demo-dfl-entregas-r36', 'scripts/pre-apk.cjs', 'scripts/verify-v111-r38-read-budget.cjs', 'test-v111-r36-refresh-emulator.cjs', 'contents: read', 'persist-credentials: false'])ok(workflow.includes(term),'CI demo: '+term);
 for(const forbidden of [/^\s*push\s*:/m,/^\s*schedule\s*:/m,/firebase deploy/,/vercel deploy/,/git push/])ok(!forbidden.test(workflow),'Sem gatilhos ou publicacao');
 console.log(`R38: ${pass} verificacoes — consultas limitadas, single-flight, bloqueios e CI manual.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
