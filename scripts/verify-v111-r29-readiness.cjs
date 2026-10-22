'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const files=['lib/access/staffReadinessPolicy.ts','lib/access/staffReadinessClient.ts',
 'app/api/access/readiness/route.ts','app/mais/acessos/prontidao/page.tsx'];
for(const file of files){
 const out=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}});
 assert.deepEqual((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(x=>x.messageText),[],`Sintaxe invalida ${file}`);
}
const box={exports:{}};new Function('module','exports',ts.transpileModule(read(files[0]),{
 compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS},
}).outputText)(box,box.exports);const p=box.exports;
let count=0;const ok=(value,title)=>{assert.ok(value,title);count++;};
const now=Date.parse('2026-10-20T15:00:00.000Z');
const baseline={uid:'staff_00000001',displayName:'Operador Teste',status:'suspended',role:'motoboy',
 permissions:['home','routes_read','deliveries_read','deliveries_complete'],linkedMotoboyId:'motoboy1',updatedAt:'2026-10-20T14:00:00.000Z'};
const account=(change={},uid=baseline.uid)=>p.auditStaffAccount(uid,{...baseline,...change},now);
ok(account().issues.length===0,'Suspenso vinculado sem alerta');
ok(account().sections.join(',')==='home,routes,deliveries','Projecoes listadas pelo perfil');
ok(account({status:'active'}).issues.includes('conta_ativa'),'Active exige revisao');
ok(account({status:'invalid'}).issues.includes('status_invalido'),'Status desconhecido alerta');
ok(account({uid:'outro'}).issues.includes('uid_invalido'),'UID divergente alerta');
ok(account({role:'admin'}).issues.includes('perfil_invalido'),'Perfil estranho alerta');
ok(account({permissions:['home','finance']}).issues.includes('permissao_administrativa'),'Financeiro alerta');
ok(account({permissions:['home','staff_admin']}).issues.includes('permissao_administrativa'),'Gestao de equipe alerta');
ok(account({permissions:['home','stock_read']}).issues.includes('permissao_cruzada'),'Motoboy com estoque alerta');
ok(account({permissions:['home','purchases_write']}).issues.includes('permissao_cruzada'),'Motoboy com compras alerta');
ok(account({linkedMotoboyId:undefined}).issues.includes('vinculo_motoboy_ausente'),'Motoboy sem vinculo alerta');
ok(account({linkedMotoboyId:'moto'}).issues.length===0,'ID curto mas valido e aceito');
ok(!account({role:'compras',linkedMotoboyId:undefined,permissions:['home','stock_read']}).issues.includes('vinculo_motoboy_ausente'),'Compras nao exige motoboy');
ok(account({role:'compras',permissions:['home','deliveries_read']}).issues.includes('permissao_cruzada'),'Compras com rota alerta');
ok(account({permissions:'home'}).issues.includes('permissoes_invalidas'),'Permissoes nao array alerta');
ok(account({permissions:['home',123]}).issues.includes('permissoes_invalidas'),'Permissao nao texto alerta');
ok(account({updatedAt:'2026-10-18T00:00:00.000Z'}).issues.includes('projecao_antiga'),'24h sem preparo alerta');
ok(account({updatedAt:'invalido'}).issues.includes('projecao_antiga'),'Data invalida alerta');
ok(account({updatedAt:'2026-10-20T19:00:00.000Z'}).issues.includes('projecao_antiga'),'Data futura alerta');
ok(p.safeUid('moto_12345678') && !p.safeUid('../../customers'),'UID valido e traversal negado');
ok(p.READINESS_SECTIONS.length===5 && Object.keys(p.blankSamples()).length===5,'Cinco secoes whitelisted');
const api=read('app/api/access/readiness/route.ts'),ui=read(files[3]),client=read(files[1]);
for(const token of ['verifyIdToken(header.slice(7),true)','isSuperadminUid','ACCOUNT_LIMIT=30,REQUEST_LIMIT=100',
 "collection('staff_accounts').limit(ACCOUNT_LIMIT+1)","collection('staff_operation_requests').limit(REQUEST_LIMIT+1)",
 'READINESS_SECTIONS.map','limit(1).get()','no-store','productionRules:',"'nao_verificadas_pela_api'",'originsSeparated'])ok(api.includes(token),'API leitura protegida '+token);
ok(!/export async function POST|batch\(|runTransaction\(|setDoc\(|updateDoc\(|tx\.set|tx\.update|\.create\(/.test(api),'API nao possui escrita ou endpoint de ativacao');
ok(ui.includes("'/mais/acessos/homologacao'") && ui.includes("'/mais/acessos/revogacao'"),'Fluxos existentes preservados');
ok(!/setInterval|onSnapshot|onValue|subscribe\(/.test(ui+client),'Sem polling ou listener');
ok(client.includes('getIdToken(true)')&&client.includes("method:'GET'")&&client.includes("credentials:'omit'"),'Cliente somente consulta com token atualizado');
ok(read('app/mais/acessos/page.tsx').includes("'/mais/acessos/prontidao'"),'Acesso do diagnostico visivel');
ok(read('scripts/pre-apk.cjs').includes("'scripts/verify-v111-r29-readiness.cjs'"),'Gate incluído no PRE-APK');
ok(read('security/firestore.v111-r26-candidate.rules').includes('allow create, update, delete: if false;'),'Regras de equipe continuam sem escrita');
ok(read('app/api/access/canonical/route.ts').includes("DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED!=='true'"),'Execucao canonica segue fechada por padrao');
ok(read('app/api/access/operations/route.ts').includes("DFL_STAFF_OPERATION_REQUESTS_ENABLED !== 'true'"),'Solicitacoes seguem fechadas por padrao');
console.log(`DFL V111 R29: ${count} verificacoes de seguranca, contrato e comportamento OK. Painel somente leitura, sem ativacao.`);
