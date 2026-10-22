'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
let total=0;
function ok(test,label){assert.ok(test,`R30: ${label}`);total++;console.log('R30 OK:',label);}
const files=[
 'components/access/StaffConfirmDialog.tsx','components/access/StaffPremium.tsx',
 'lib/access/staffTouch.ts','components/access/StaffPortal.tsx',
 'app/mais/acessos/page.tsx','app/mais/acessos/solicitacoes/page.tsx',
 'app/mais/acessos/prontidao/page.tsx',
];
for(const file of files){
 const result=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,
   compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}});
 const diagnostics=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 ok(!diagnostics.length,`JSX/TypeScript válido: ${file}`);
}
const dialog=read(files[0]),common=read(files[1]),touch=read(files[2]);
for(const [pat,label] of [
 ['role="dialog"','diálogo sem alerta nativo'],['aria-modal="true"','acessibilidade do diálogo'],
 ['requirePhrase','frase explícita para ações críticas'],['disabled={!confirmable}','confirmação travada até preencher frase'],
 ['onCancel','cancelamento sempre disponível'],['onConfirm','ação só por interação explícita'],
 ['event.key === \'Escape\'','fechamento por teclado'],
 ])ok(dialog.includes(pat),label);
ok(touch.includes('Capacitor.isNativePlatform()')&&touch.includes('Haptics.impact')&&touch.includes('catch(() => undefined)'),
 'feedback tátil leve e seguro, somente no nativo');
ok(common.includes('StaffPageHeader')&&common.includes('StaffMetric')&&common.includes('StaffEmpty')&&common.includes('StaffNavRow')&&common.includes('StaffPanel'),
 'fundação premium compartilhada entre telas');
ok(common.includes('min-h-14')&&common.includes('rounded-[23px]'),'áreas de toque e cards compactos');
const portal=read(files[3]);
ok(!portal.includes('window.alert(')&&!portal.includes('window.confirm('),'portal sem pop-ups nativos');
ok(portal.includes('toast.warning(')&&portal.includes('toast.success(')&&portal.includes('toast.error('),'feedback de erro e sucesso no portal');
ok(portal.includes('StaffConfirmDialog')&&portal.includes('pendingOperation'),'confirmação visual do funcionário');
ok(portal.includes('setPendingOperation(null)')&&portal.includes('securityEpoch.current += 1'),'limpeza de confirmações e cache no ciclo de segurança');
ok(portal.includes('await submitStaffOperation(')&&portal.includes('Solicitar conferência'),'fluxo R27 preservado');
const queue=read(files[5]);
ok(!queue.includes('window.confirm(')&&queue.includes('<StaffConfirmDialog'),'fila com confirmação visual própria');
ok(queue.includes("requirePhrase={pending.decision==='apply'?'CONCLUIR':undefined}"),'baixa real exige frase explícita');
ok(queue.includes('applyCanonicalDelivery')&&queue.includes('verifyCanonicalPurchase'),'fluxos canônicos R28 preservados');
ok(queue.includes('stock_integrated_at')&&queue.includes('Revisado (sem aplicar)'),'compra integrada distinta da revisão manual');
ok(queue.includes('reviewStaffOperation')&&queue.includes('toast.error(')&&queue.includes('toast.success('),'auditoria e retorno de erros preservados');
ok(!queue.includes('<select')&&queue.includes('aria-expanded='),'seletor premium no lugar do select nativo');
ok(queue.includes('busy')&&queue.includes('disabled={disabled'),'controle de duplo clique no envio');
const readiness=read(files[6]);
ok(readiness.includes('inspectStaffReadiness()')&&!/setInterval\(|onSnapshot\(|subscribe\(/.test(readiness),'diagnóstico apenas sob demanda');
ok(readiness.includes('report.accountsTruncated')&&readiness.includes('report.requestsTruncated'),'amostras parciais sinalizadas');
ok(readiness.includes('production')===false&&readiness.includes('Rules de produção'),'estado da produção não inferido da API');
ok(readiness.includes('toast.success(')&&readiness.includes('toast.error('),'prontidão mostra feedback contextual');
const main=read(files[4]);
for(const route of ['/mais/acessos/prontidao','/mais/acessos/solicitacoes','/mais/acessos/homologacao','/mais/acessos/seguranca']){
 ok(main.includes(`router.push('${route}')`),`atalho preservado ${route}`);
}
ok(main.includes('StaffNavRow')&&main.includes('Central de equipe'),'atalhos agrupados em UI premium');
const rules=read('security/firestore.v111-r26-candidate.rules');
ok(rules.includes('allow create, update, delete: if false;'),'escritas diretas de staff seguem bloqueadas');
const api1=read('app/api/access/operations/route.ts'),api2=read('app/api/access/canonical/route.ts');
ok(api1.includes("DFL_STAFF_OPERATION_REQUESTS_ENABLED !== 'true'"),'API de solicitações continua desativada por padrão');
ok(api2.includes("DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED!=='true'"),'API canônica continua desativada por padrão');
ok(read('scripts/pre-apk.cjs').includes("'scripts/verify-v111-r30-premium-access.cjs'"),'PRE-APK executa a R30');
for(const file of files){
  ok(!read(file).split(/\r?\n/).some(line=>/[ \t]+$/.test(line)),`sem whitespace no novo layout: ${file}`);
}
console.log(`R30 PREMIUM ACCESS: ${total} contratos aprovados. Nenhuma autorização ou operação real ativada.`);
