#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
let count=0;const ok=(a,b)=>{assert.ok(a,'R43 '+b);count++};
function run(file,stubs={}){
 const code=fs.readFileSync(file,'utf8');const compiled=ts.transpileModule(code,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
 ok(!compiled.diagnostics.some(v=>v.category===ts.DiagnosticCategory.Error),'TS parse '+file);
 const module={exports:{}};vm.runInNewContext(compiled.outputText,{module,exports:module.exports,Set,Map,Number,String,Error,Object,Array,console,require:(id)=>{if(id in stubs)return stubs[id];throw Error(id)}},{filename:file});return module.exports;
}
const invite=run('lib/access/staffInvitePolicy.ts');
for(const permission of ['routes_read','deliveries_read','routes_create','deliveries_create','deliveries_complete'])ok(invite.requiresMotoboyBinding('personalizado',[permission]),'Personalizado exige vinculo: '+permission);
ok(invite.requiresMotoboyBinding('motoboy',[]),'Motoboy exige vinculo');
ok(!invite.requiresMotoboyBinding('compras',['routes_read']),'Compras nao recebe logistica por flag');
ok(!invite.requiresMotoboyBinding('operacao',['routes_read']),'Operacao nao exige motoboy unico');
ok(!invite.requiresMotoboyBinding('personalizado',['stock_read','purchases_read']),'Personalizado apenas loja nao exige vinculo');
for(const invalid of ['',null,undefined,' / ', '\\', 'x/y', 'x\\y', 'x\n', ' '.repeat(3),'a'.repeat(121)])ok(!invite.validMotoboyBinding(invalid),'Vinculo invalido negado');
ok(invite.validMotoboyBinding('moto_123'),'Vinculo valido');
const roles=run('lib/access/roles.ts');
const policy=run('lib/access/staffClaimPolicy.ts',{'./roles':roles,'./staffOrigin':{isIsolatedStaffOrigin:()=>false},'./staffInvitePolicy':invite});
const base={id:'draft_12345678',email:'pessoa@example.com',status:'rascunho',activation:'not_enabled',role:'personalizado',permissions:['home','routes_read']};
ok(!policy.claimableDraft(base,'pessoa@example.com'),'Convite individual sem vinculo negado');
ok(policy.claimableDraft({...base,linkedMotoboyId:'moto_123'},'pessoa@example.com'),'Convite individual vinculado');
ok(policy.claimableDraft({...base,permissions:['home','stock_read']},'pessoa@example.com'),'Convite apenas estoque sem motoboy');
ok(policy.claimableDraft({...base,role:'operacao'},'pessoa@example.com'),'Operacao nao precisa vinculo individual');
ok(!policy.claimableDraft({...base,role:'motoboy'},'pessoa@example.com'),'Motoboy nao vinculado negado');
const ui=fs.readFileSync('app/mais/acessos/page.tsx','utf8');
ok(ui.includes('requiresMotoboyBinding(form.role,form.permissions)'),'Cadastro exibe vinculo personalizado');
ok(ui.includes("role === 'motoboy' || role === 'personalizado'"),'Nao perde vinculo em perfil personalizado');
const stage=fs.readFileSync('app/api/access/staging/route.ts','utf8');
ok(stage.includes("user.providerData.some(provider => provider.providerId === 'google.com')"),'Homologacao verifica provedor Google');
ok(stage.includes("'suspended'"),'Preparacao nao ativa usuario');
const portal=fs.readFileSync('components/access/StaffPortal.tsx','utf8');
ok(portal.includes('if (epoch !== securityEpoch.current) return'),'Resposta tardia bloqueada');
ok(portal.includes('if (epoch === securityEpoch.current) toast.error'),'Feedback tardio bloqueado');
for(const file of ['app/loja/page.tsx','app/rotas/page.tsx','app/entregas/page.tsx','app/equipe/page.tsx','components/access/StaffPortal.tsx','app/mais/acessos/page.tsx','app/api/access/staging/route.ts','lib/store/holidayCache.ts']){
 const raw=fs.readFileSync(file,'utf8');const output=ts.transpileModule(raw,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX}});ok(!output.diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error),'TS transpile '+file);
}
const routes=fs.readFileSync('app/rotas/page.tsx','utf8');ok(routes.includes('for (const route of dayRoutes)'),'Contadores de rota em passagem unica');
const deliveries=fs.readFileSync('app/entregas/page.tsx','utf8');ok(deliveries.includes('for (const delivery of dayDeliveries)'),'Contadores de entregas em passagem unica');
ok(deliveries.includes('if (!delivery.completed && !cancelled) result.pending++'),'Canceladas nao entram nas pendentes');
const store=fs.readFileSync('app/loja/page.tsx','utf8');ok(store.includes('loadHolidayCalendar(new Date().getFullYear())'),'Loja usa cache de feriados');ok(!store.includes('fetch(\n      `https://brasilapi.com.br/api/feriados/v1/${year}`'),'fetch cru de feriados removido');
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');const all=[...pre.matchAll(/^\s*'(scripts\/[^']+\.cjs)'/gm)].map(m=>m[1]);
ok(all.length>=168,'suites anteriores R43 preservadas');ok(new Set(all).size===all.length,'nenhuma suite duplicada');
ok(all.includes('scripts/verify-v111-r42-role-operation.cjs')&&all.includes('scripts/test-v111-r42-projection-scopes.cjs'),'R42 preservada');
ok(all.includes('scripts/verify-v111-r43-security-ui.cjs')&&all.includes('scripts/test-v111-r43-holiday-cache.cjs'),'R43 obrigatoria');
ok(fs.readFileSync('.github/workflows/dfl-r43-access-emulator.yml','utf8').includes('workflow_dispatch:'),'Emulator somente manual');
ok(fs.readFileSync('scripts/test-v111-r43-access-emulator.cjs','utf8').includes("demo-dfl-entregas-r43"),'Emulator limitado a demo');
console.log('R43 SECURITY + OPERATION:',count,'checks passed');
