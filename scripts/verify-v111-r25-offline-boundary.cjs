'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const read=(p)=>fs.readFileSync(p,'utf8');
const file='lib/access/staffOrigin.ts';
const compiled=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},reportDiagnostics:true});
assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,'Origem isolada tem erro TS');
const mod={exports:{}};
vm.runInNewContext(compiled.outputText,{exports:mod.exports,module:mod,URL,process:{env:{}}});
const isolated=mod.exports.isIsolatedStaffOrigin;
assert.equal(typeof isolated,'function');
const admin='https://dfl-entregas.example.com';
const staff='https://equipe.example.com';
for (const [origin,staffConfig,ownerConfig,want,label] of [
 [staff,staff,admin,true,'origem dedicada autorizada'],
 [admin,staff,admin,false,'origem administrativa bloqueada'],
 ['https://intruso.example.com',staff,admin,false,'origem diferente bloqueada'],
 [staff,undefined,admin,false,'sem configuracao staff'],
 [staff,staff,undefined,false,'sem configuracao admin'],
 [staff,staff,staff,false,'origens iguais bloqueadas'],
 [staff,'http://equipe.example.com',admin,false,'HTTP nao autorizado'],
 [staff,'https://equipe.example.com/path',admin,false,'path nao autorizado'],
 [staff,'https://equipe.example.com/',admin,false,'barra extra invalida fail-closed'],
 [staff,'https://equipe.example.com?x=1',admin,false,'query nao autorizada'],
 [staff,'https://localhost',admin,false,'localhost nao autorizado'],
 ]) assert.equal(isolated(origin,staffConfig,ownerConfig),want,label);
const firebase=read('lib/firebase.ts');
assert(firebase.includes('memoryLocalCache'), 'Staff precisa de cache Firestore somente em memoria');
assert(firebase.includes('isIsolatedStaffOrigin(window.location.origin)'), 'Firestore deve checar origem isolada');
assert(firebase.includes('persistentLocalCache'), 'Admin deve preservar comportamento offline');
const auth=read('components/auth/AuthGuard.tsx');
assert(auth.includes('isIsolatedStaffOrigin(window.location.origin)'), 'AuthGuard deve isolar as origens');
assert(auth.includes("NEXT_PUBLIC_DFL_STAFF_PORTAL_ENABLED === 'true'"), 'Flag de portal obrigatoria');
assert(auth.includes('!Capacitor.isNativePlatform()'), 'APK deve permanecer bloqueado para funcionarios');
assert(auth.includes('isSuperadminUid(user.uid) && typeof window'), 'Admin nao deve renderizar no dominio staff');
assert(auth.includes('!hasInitializedRef.current && (typeof window'), 'Admin nao deve sincronizar no dominio staff');
const portal=read('components/access/StaffPortal.tsx');
for (const x of ["window.addEventListener('offline'", "window.addEventListener('online'",'securityEpoch.current += 1','setRows([])','includeMetadataChanges: true','getDocsFromServer']) {
 if(x==='getDocsFromServer') assert(read('lib/access/staffPortalRepository.ts').includes(x),'Dados devem vir somente do servidor');
 else assert(portal.includes(x),`Portal nao protege ciclo offline: ${x}`);
}
const rules=read('security/firestore.v111-r24-candidate.rules');
assert(rules.includes("staffRecord(uid).data.status == 'active'"));
assert(rules.includes('allow create, update, delete: if false;'));
assert(!/allow\s+(?:read|write)[^;]*if\s+true/.test(rules),'Firestore Rules jamais publicas');
const pre=read('scripts/pre-apk.cjs');
assert(pre.includes("'scripts/verify-v111-r25-offline-boundary.cjs'"));
assert(pre.includes("'scripts/verify-v111-r24-revocation.cjs'"));
console.log('R25 SEGURANCA: 11 cenarios de origem, cache em memoria, portal/offline, rules e 143o PRE-APK verificados.');
