'use strict';
/** R31 — contratos incrementais; nao acessa rede nem modifica banco. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const files={
  main:'app/mais/acessos/page.tsx',
  staging:'app/mais/acessos/homologacao/page.tsx',
  revocation:'app/mais/acessos/revogacao/page.tsx',
  security:'app/mais/acessos/seguranca/page.tsx',
  picker:'components/access/StaffChoicePicker.tsx',
  confirm:'components/access/StaffConfirmDialog.tsx',
  common:'components/access/StaffPremium.tsx',
  touch:'lib/access/staffTouch.ts',
  pre:'scripts/pre-apk.cjs',
};
const read=k=>fs.readFileSync(files[k],'utf8');
const str=Object.fromEntries(Object.keys(files).map(k=>[k,read(k)]));
let total=0;
function ok(value,label){assert.ok(value,`R31: ${label}`);total++;console.log('R31 OK:',label);}
for(const key of ['main','staging','revocation','security','picker']){
 const p=files[key];const out=ts.transpileModule(str[key],{fileName:p,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}});
 const diagnostic=(out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 ok(diagnostic.length===0,`JSX/TypeScript: ${p}`);
 ok(!str[key].split(/\r?\n/).some(line=>/[ \t]+$/.test(line)),`sem whitespace: ${p}`);
 ok(!/\b(window\.)?(?:alert|confirm|prompt)\s*\(/.test(str[key]),`sem dialogo nativo: ${p}`);
}
ok(str.main.includes('StaffNavRow')&&str.main.includes('Central de equipe'),'central premium da equipe preservada');
ok((str.main.match(/router\.push\('\/mais\/acessos\/homologacao'\)/g)||[]).length===1,'atalho Google unico');
ok(!str.main.includes('<select'),'vinculos de equipe sem selects nativos');
ok(str.main.includes('StaffChoicePicker')&&str.staging.includes('StaffChoicePicker'),'seletor premium reutilizado');
ok(str.main.includes("requirePhrase={pendingStatus.status==='suspenso'?undefined:'SUSPENDER'}"),'suspender rascunho exige palavra');
ok(str.main.includes('void changeStatus(item)')&&str.main.includes('saveStaffDraft'),'persistencia de rascunhos original preservada');
ok(str.main.includes('staffTouch()')&&str.main.includes('toast.success('),'haptics e toast na administracao');
for(const a of ["execute('verify')","execute('preview')","execute('stage')",'setConfirm(e.target.checked)','Login continua bloqueado'])ok(str.staging.includes(a),`contrato R23 ${a}`);
ok(str.staging.includes('requestStaffStaging('),'API de verificacao preservada');
ok(str.staging.includes('StaffMetric')&&str.staging.includes('StaffPageHeader'),'homologacao com indicadores premium');
ok(str.staging.includes('requirePhrase="PREPARAR"')&&str.staging.includes('<StaffConfirmDialog'),'preparacao exige confirmacao explicita');
ok(str.staging.includes('staffTouch()')&&str.staging.includes('toast.success('),'toasts e feedback na homologacao');
for(const a of ["staffRevocationRequest('inspect'","staffRevocationRequest('revoke'",'confirmed','setInfo(null)','target.updatedAt'])ok(str.revocation.includes(a),`revogacao original ${a}`);
ok(str.revocation.includes('requirePhrase="REVOGAR"')&&str.revocation.includes('tone="danger"'),'revogacao com digitacao obrigatoria');
ok(str.revocation.includes('lookupRef.current!==target')&&str.revocation.includes('lookupRef.current=e.target.value.trim()'),'resposta antiga de outro UID descartada');
ok(str.revocation.includes('toast.warning(')&&str.revocation.includes('toast.success(')&&str.revocation.includes('toast.error('),'feedback de revogacao completo');
ok(str.revocation.includes('response.warnings?.length')&&str.revocation.includes('Revogação não confirmada'),'alerta para revogacao parcial e falhas');
ok(str.security.includes('Auditoria de acessos')&&str.security.includes("d.role==='motoboy'"),'contrato R22 intacto');
ok(str.security.includes('StaffPageHeader')&&str.security.includes('StaffMetric')&&str.security.includes('StaffNavRow'),'auditoria com fundacao premium');
ok(str.security.includes('Ativação continua bloqueada')&&str.security.includes('proprietário'),'fronteira staff owner-only visivel');
for(const a of ['aria-expanded','aria-controls','role="listbox"','aria-selected','Escape','staffTouch()','options.length>7'])ok(str.picker.includes(a),`seletor acessivel: ${a}`);
ok(str.confirm.includes('aria-modal="true"')&&str.confirm.includes('disabled={!confirmable}'),'dialogo exige confirmacao real');
ok(str.touch.includes('Capacitor.isNativePlatform()')&&str.touch.includes('Haptics.impact'),'haptics somente nativo');
ok(str.pre.includes("'scripts/verify-v111-r31-premium-identity.cjs'")&&str.pre.includes("'scripts/verify-v111-r30-premium-access.cjs'"),'PRE-APK mantem R30 e R31');
const api1=fs.readFileSync('app/api/access/operations/route.ts','utf8');
const api2=fs.readFileSync('app/api/access/canonical/route.ts','utf8');
ok(api1.includes("DFL_STAFF_OPERATION_REQUESTS_ENABLED !== 'true'"),'funcionarios nao ganham API habilitada');
ok(api2.includes("DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED!=='true'"),'baixa real continua desligada por padrao');
ok(!str.main.includes('status: \'active\'')&&!str.staging.includes('status:\'active\''),'nenhuma ativacao via UI');
console.log(`R31 PREMIUM + SEGURANCA: ${total} verificacoes aprovadas; sem ativacao, deploy ou regra.`);
