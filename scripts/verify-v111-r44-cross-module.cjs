#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
let checks=0;
const check=(condition,message)=>{assert.ok(condition,'R44 '+message);checks++};
function moduleAt(name,stubs={}) {
 const code=fs.readFileSync(name,'utf8');
 const compiled=ts.transpileModule(code,{fileName:name,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}});
 check(!compiled.diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error),'parse '+name);
 const mod={exports:{}};
 vm.runInNewContext(compiled.outputText,{module:mod,exports:mod.exports,Set,Map,Number,String,Error,Object,Array,RegExp,console,require:(id)=>{if(Object.prototype.hasOwnProperty.call(stubs,id))return stubs[id];throw Error('stub ausente '+id)}},{filename:name});
 return mod.exports;
}
const roles=moduleAt('lib/access/roles.ts');
const invites=moduleAt('lib/access/staffInvitePolicy.ts');
const review=moduleAt('lib/access/staffInvitationReview.ts',{'./roles':roles,'./staffInvitePolicy':invites});
const base={name:'Funcionario Teste',email:'funcionario@example.com',role:'compras',permissions:['home','stock_read','purchases_read'],status:'rascunho',activation:'not_enabled'};
check(review.reviewStaffInvitation(base).readyForHomologation,'compras preparada');
check(review.reviewStaffInvitation({...base,role:'operacao',permissions:['home','routes_read','stock_read']}).readyForHomologation,'operacao sem motoboy');
check(review.reviewStaffInvitation({...base,role:'motoboy',permissions:['home','routes_read'],linkedMotoboyId:'moto01'}).readyForHomologation,'motoboy vinculado');
check(review.reviewStaffInvitation({...base,role:'personalizado',permissions:['home','routes_read'],linkedMotoboyId:'moto01'}).readyForHomologation,'personalizado vinculado');
for (const delta of [
 {email:''},{email:'invalido'},{name:'X'},{role:'root'},
 {permissions:['home','staff_admin']},{permissions:['home','finance']},
 {permissions:['home','unknown']},{permissions:['home','home']},
 {permissions:['stock_read']},{status:'suspenso'},{activation:'active'},
 {role:'motoboy',permissions:['home','routes_read']},
 {role:'motoboy',permissions:['home','stock_read'],linkedMotoboyId:'moto01'},
 {role:'compras',permissions:['home','routes_read']},
 {role:'personalizado',permissions:['home','routes_read']},
 ]){
  check(!review.reviewStaffInvitation({...base,...delta}).readyForHomologation,'caso bloqueado '+JSON.stringify(delta));
}
for(const [file,texts] of Object.entries({
 'components/access/StaffPortal.tsx':['const visibleRows = loadedArea === section ? rows : []','setLoadedArea(null)','setRequested({})','aria-pressed={section===area}'],
 'app/mais/acessos/page.tsx':['reviewStaffInvitation(','Antes de homologar este convite','Conferência antes da homologação'],
 'app/entregas/page.tsx':['Filtrar critérios baratos antes','status === \'canceladas\''],
 'app/rotas/page.tsx':['for (const delivery of linked) {','groupDeliveriesByStop(linked).length'],
 'app/estoque/compras/page.tsx':['const selectedProducts = useMemo(','const visibleIds = useMemo('],
 'app/estoque/page.tsx':['alert={stockCounts.zero>0}'],
 })){
  const s=fs.readFileSync(file,'utf8');for(const part of texts)check(s.includes(part),file+' inclui '+part);
  const compiled=ts.transpileModule(s,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX}});
  check(!compiled.diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error),'typescript parse '+file);
}
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');const tests=[...pre.matchAll(/^\s*'(scripts\/[^']+\.cjs)'/gm)].map(x=>x[1]);
check(tests.length>=170,'170 suites historicas preservadas');
check(new Set(tests).size===tests.length,'suítes sem duplicidade');
for(const script of tests)check(fs.existsSync(script),'suíte existe '+script);
const rules=fs.readFileSync('security/firestore.v111-r23-owner-only.rules','utf8');
check(rules.includes('if superadmin();'),'Rules de produção owner-only preservadas');
check(fs.readFileSync('.github/workflows/dfl-r44-two-gates-emulator.yml','utf8').includes('workflow_dispatch:'),'emulator disparo manual');
console.log('R44 CROSS-MODULE:',checks,'checks OK');
