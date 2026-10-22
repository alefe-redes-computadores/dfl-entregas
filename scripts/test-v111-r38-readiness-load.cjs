#!/usr/bin/env node
'use strict';
/** R38 API exercise with fake Firestore, owner token + 150 projection calls: no network. */
const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
let tests=0;const ok=(x,m)=>{assert.ok(x,'R38 API: '+m);tests++;};
const src=fs.readFileSync('app/api/access/readiness/route.ts','utf8');
const output=ts.transpileModule(src,{fileName:'route.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
ok(!(output.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'API pode ser compilada');
const readBudgetSource=fs.readFileSync('lib/access/staffReadBudget.ts','utf8');const compiled=ts.transpileModule(readBudgetSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
const budget={};new Function('module','exports',compiled.outputText)({exports:budget},budget);
let accounts=Array.from({length:30},(_,i)=>({id:'staff_'+String(i).padStart(8,'0'),data:()=>({uid:'staff_'+String(i).padStart(8,'0'),role:'operacao'})}));
let roots=0,probes=0,active=0,highest=0,unsafe=0;
const sessions=[];
const db={collection:(name)=>{
 if(name==='staff_accounts'||name==='staff_operation_requests')return {limit:n=>({get:async()=>{
   roots++;const rows=name==='staff_accounts'?accounts:[];
   if(name==='staff_accounts')ok(n===31,'Amostra de contas limitada em 31');
   if(name==='staff_operation_requests')ok(n===101,'Amostra de solicitacoes limitada em 101');
   return {docs:rows,size:rows.length};
 }})};
 if(name==='staff_workspaces')return {doc:uid=>({collection:area=>({limit:n=>({get:async()=>{
   probes++;active++;highest=Math.max(highest,active);
   ok(n===1,'Projecao limitada a um documento');
   ok(uid.startsWith('staff_'),'Isolamento por uid');
   ok(['home','routes','deliveries','stock','purchases'].includes(area),'Apenas secoes autorizadas');
   await new Promise(resolve=>setImmediate(resolve));
   active--;return {docs:[{data:()=>({title:'publico',status:'ativo'})}],size:1};
 }})})})};
 throw Error('Colecao inesperada '+name);
}};
const sections=['home','routes','deliveries','stock','purchases'];
const mocks={
 'next/server':{NextResponse:{json:(body,opt)=>({status:opt.status,body,headers:opt.headers})}},
 '@/lib/integration/server/admin':{adminDb:db,adminAuth:{verifyIdToken:async(token,checkRevoked)=>{ok(checkRevoked===true,'Token com revogacao');return {uid:token==='valid'?'owner':'random'};}}},
 '@/lib/access/roles':{isSuperadminUid:uid=>uid==='owner'},
 '@/lib/access/staffReadinessPolicy':{READINESS_SECTIONS:sections,blankSamples:()=>Object.fromEntries(sections.map(k=>[k,false])),auditStaffAccount:(uid,d,now)=>({uid,name:'Team',role:'operacao',status:'suspended',issues:[],sections,lastPreparedAt:new Date(now).toISOString()})},
 '@/lib/access/staffOrigin':{isIsolatedStaffOrigin:()=>true},
 '@/lib/access/staffProjectionGuard':{inspectStaffProjection:()=>({clean:true,risks:[]})},
 '@/lib/access/staffReadBudget':budget,
};
const loaded={};new Function('require','module','exports',output.outputText)(n=>{
 if(!(n in mocks))throw Error('unexpected import '+n);return mocks[n];
},{exports:loaded},loaded);
const request=token=>({headers:{get:key=>key==='authorization'?'Bearer '+token:key==='origin'?'https://localhost':''},url:'https://example.invalid/api/access/readiness'});
(async()=>{
 const forbidden=await loaded.GET(request('bad'));
 ok(forbidden.status===403&&forbidden.body.ok===false,'Nao-owner bloqueado');
 ok(roots===0&&probes===0,'Nao-owner nao consulta Firestore');
 const response=await loaded.GET(request('valid'));
 ok(response.status===200&&response.body.ok===true,'Owner permitido apenas para leitura');
 ok(roots===2,'Apenas duas consultas raiz');
 ok(probes===150,'Apenas as 150 projecoes autorizadas');
 ok(highest<=4&&highest>=2,'Maximo real de quatro probes simultaneas');
 ok(response.body.accounts.length===30&&response.body.projectionHealth.sampled===150,'Amostragem declarada corretamente');
 ok(response.body.readBudget.queryAttempts===152&&response.body.readBudget.documentsObserved===180,'Contadores correspondem a snapshots recebidos');
 ok(response.body.readBudget.maxDocumentsObserved===282&&response.body.readBudget.maxProbeConcurrency===4,'Limites presentes na resposta');
 ok(response.body.productionRules==='nao_verificadas_pela_api','Nunca presume regras live');
 ok(response.body.flags.staffPortal===false&&response.body.flags.projectionRefresh===false,'Flags fechadas no ambiente local');
 ok(!JSON.stringify(response.body.readBudget).includes('staff_'),'Orcamento sem uid');
 console.log(`R38 API: ${tests} testes de comportamento com 30 contas/150 probes, concorrencia maxima=${highest}.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
