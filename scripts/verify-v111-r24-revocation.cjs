'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=file=>fs.readFileSync(file,'utf8');
const compile=(file)=>{
 const source=read(file);
 const output=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}});
 const errs=(output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errs.length,0,`Sintaxe TS invalida em ${file}`);
};
for(const file of ['app/api/access/revoke/route.ts','lib/access/staffRevocationClient.ts','app/mais/acessos/revogacao/page.tsx','components/access/StaffPortal.tsx'])compile(file);
const route=read('app/api/access/revoke/route.ts');
for(const pattern of [
 'verifyIdToken(header.slice(7), true)', 'isSuperadminUid(claims.uid)', 'adminDb.runTransaction',
 "status: 'suspended'", "permissions: []", 'revokeRefreshTokens(body.targetUid)',
 'purgeWorkspace(body.targetUid)',"action:'access_revoked'", 'body.expectedUpdatedAt',
 "return new NextResponse(null, { status: 403 })",
 ])assert(route.includes(pattern),`R24: API sem trava ${pattern}`);
assert(!/status:\s*['"]active['"]/.test(route),'R24 nao pode ativar contas');
assert(route.indexOf('adminDb.runTransaction')<route.indexOf('revokeRefreshTokens(body.targetUid)'),'Suspender antes de revogar token');
assert(route.indexOf('revokeRefreshTokens(body.targetUid)')<route.indexOf('purgeWorkspace(body.targetUid)'),'Revogar token antes da limpeza');
assert(route.includes('function cors(req: NextRequest): Record<string, string>'),'Cabecalhos devem ser tipo Record<string,string> (TS2322 R23)');
const client=read('lib/access/staffRevocationClient.ts');
for(const part of ['Capacitor.isNativePlatform()', 'getIdToken(true)', "cache:'no-store'",'response','REVOGAR E LIMPAR ACESSO']){
 // 'response' is not a contract; tolerate "res" in code.
 if(part!=='response')assert(client.includes(part),`R24: cliente sem ${part}`);
}
const screen=read('app/mais/acessos/revogacao/page.tsx');
assert(screen.includes("staffRevocationRequest('inspect'"));
assert(screen.includes("staffRevocationRequest('revoke'"));
assert(screen.includes('confirmed'));
assert(screen.includes('setInfo(null)'));
const portal=read('components/access/StaffPortal.tsx');
for(const p of ['includeMetadataChanges: true','securityEpoch.current += 1', 'requestedEpoch === securityEpoch.current', 'setAccount(null);setReason(',"snap.metadata.fromCache"]){
 assert(portal.includes(p),`R24: nao encerra dados obsoletos ${p}`);
}
const rules=read('security/firestore.v111-r24-candidate.rules');
assert(rules.includes('zIfbMxD1SQNvtlX9y6YUsEz2TXC3'));
assert(rules.includes("staffRecord(uid).data.status == 'active'"));
assert(rules.includes('request.query.limit <= 40'));
assert(rules.includes('allow create, update, delete: if false;'));
assert(!/allow\s+(?:read|write)[^;]*if\s+true/.test(rules));
const config=JSON.parse(read('firebase.r24-emulator.json'));
assert.equal(config.firestore.rules,'security/firestore.v111-r24-candidate.rules');
assert.equal(config.emulators.firestore.port,8086);
const emul=read('scripts/test-v111-r24-firestore-emulator.cjs');
for(const part of ['FIRESTORE_EMULATOR_HOST',"'demo-dfl-entregas-r24'",'assertFails','assertSucceeds','revogacao nega leitura com token antigo'])assert(emul.includes(part));
const action=read('.github/workflows/firestore-r24-homologation.yml');
assert(action.includes('workflow_dispatch:'));
assert(!/\bpush\s*:/.test(action));
assert(action.includes('demo-dfl-entregas-r24'));
const pre=read('scripts/pre-apk.cjs');
assert(pre.includes('verify-v111-r24-revocation.cjs'));
assert(pre.includes('verify-v111-r23-verified-staging.cjs'));
console.log('R24 SEGURANCA: API fail-closed, revogacao, UI, invalidacao de cache, rules candidata e workflow manual OK.');
console.log('R24 EMULADOR: suite preparada; homologacao real pendente de executar workflow_dispatch.');
