'use strict';
/** R32: testes comportamentais sem Firestore real, sem deploy, sem efeitos. */
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');let tests=0;
const ok=(truth,label)=>{assert.ok(truth,`R32: ${label}`);tests++;};
function transpile(file){
 const r=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
 assert.deepEqual((r.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).map(x=>x.messageText),[],`Sintaxe invalida ${file}`);
 return r.outputText;
}
const guard='lib/access/staffProjectionGuard.ts';
const moduleObj={exports:{}};new Function('module','exports',transpile(guard))(moduleObj,moduleObj.exports);
const scan=moduleObj.exports.inspectStaffProjection;
for(const file of [guard,'lib/access/staffReadinessPolicy.ts','app/api/access/readiness/route.ts','app/mais/acessos/prontidao/page.tsx','app/mais/acessos/seguranca/page.tsx']){transpile(file);ok(true,'Sintaxe: '+file);}
const good={title:'Hamburguer Tradicional',subtitle:'Saldo: 1,2 kg',status:'Estoque'};
ok(scan(good).clean,'Campos permitidos passam');
ok(!scan({...good,email:'x@y.com'}).clean,'Campo extra bloqueado');
ok(scan({...good,email:'x@y.com'}).risks.includes('unexpected_field'),'Motivo de campo extra');
ok(!scan({...good,title:'Fale com atendimento@teste.com'}).clean,'E-mail detectado');
ok(!scan({...good,subtitle:'Telefone (34) 99999-7777'}).clean,'Telefone detectado');
ok(!scan({...good,subtitle:'CPF 123.456.789-09'}).clean,'CPF detectado');
ok(!scan({...good,subtitle:'Total R$ 83,20'}).clean,'Preco detectado');
ok(!scan({...good,status:12}).clean,'Campo em tipo inesperado detectado');
ok(!scan({...good,title:'x'.repeat(121)}).clean,'Titulo demasiado longo detectado');
ok(!scan(null).clean,'Payload nulo detectado');
ok(!scan([]).clean,'Array rejeitado');
ok(scan({title:'Água mineral',subtitle:'Saldo: 0,300 L',status:'Disponível'}).clean,'Quantidade decimal legitima nao gera falso positivo');
ok(scan({title:'Pedido 1234',subtitle:'Rota iniciada',status:'Pendente'}).clean,'Numero curto nao e telefone');
const api=read('app/api/access/readiness/route.ts');
for(const token of ['verifyIdToken(header.slice(7),true)','isSuperadminUid','ACCOUNT_LIMIT=30,REQUEST_LIMIT=100',"collection('staff_accounts').limit(ACCOUNT_LIMIT+1)","collection('staff_operation_requests').limit(REQUEST_LIMIT+1)",'READINESS_SECTIONS.map','limit(1).get()','inspectStaffProjection(first.data())','projectionRisks','projectionHealth','profile.sections.includes(area)',"'nao_verificadas_pela_api'",'no-store'])ok(api.includes(token),'API protegida e auditoria limitada: '+token);
ok(!/export async function POST|batch\(|runTransaction\(|setDoc\(|updateDoc\(|tx\.set|tx\.update|\.create\(/.test(api),'Endpoint R32 permanece somente leitura');
const ui=read('app/mais/acessos/prontidao/page.tsx'),sec=read('app/mais/acessos/seguranca/page.tsx');
for(const token of ['inspectStaffReadiness()','projectionRisks','projectionHealth','Com alertas','aria-pressed','seq!==epoch.current','staffTouch','toast.success','toast.error','report.accountsTruncated','report.requestsTruncated','Rules de produção'])ok(ui.includes(token),'Painel premium preserva contrato: '+token);
ok(!/onSnapshot\(|setInterval\(/.test(ui),'Nenhum listener ou polling introduzido');
for(const path of ['/mais/acessos/prontidao','/mais/acessos/solicitacoes','/mais/acessos/homologacao','/mais/acessos/revogacao'])ok(sec.includes(`router.push('${path}')`),'Atalho seguro '+path);
ok(sec.includes('StaffNavRow')&&sec.includes('StaffPanel'),'Auditoria premium consistente');
const request=read('app/api/access/operations/route.ts'),canonical=read('app/api/access/canonical/route.ts');
ok(request.includes("DFL_STAFF_OPERATION_REQUESTS_ENABLED !== 'true'"),'Solicitacoes desativadas por padrao');
ok(canonical.includes("DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED!=='true'"),'Execucao canonica desativada por padrao');
ok(read('security/firestore.v111-r26-candidate.rules').includes('allow create, update, delete: if false;'),'Sem escrita direta de staff');
ok(read('scripts/pre-apk.cjs').includes("'scripts/verify-v111-r32-projection-inspection.cjs'"),'Registro da suite R32 no PRE-APK');
console.log(`R32: ${tests} checagens aprovadas. Inspecao apenas informativa, contas seguem suspensas.`);
