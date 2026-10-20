'use strict';
/** Gate de protecao R21 - rascunhos NAO sao permissoes ativas. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = (p) => fs.readFileSync(p, 'utf8');
const expect = (ok, message) => { assert.ok(ok, message); console.log('R21 OK:', message); };
const uid = 'zIfbMxD1SQNvtlX9y6YUsEz2TXC3';
const roles = read('lib/access/roles.ts');
const guard = read('components/auth/AuthGuard.tsx');
const layout = read('app/layout.tsx');
const ui = read('app/mais/acessos/page.tsx');
const repo = read('lib/access/staffRepository.ts');
const more = read('app/mais/page.tsx');
const rules = read('security/firestore.v111-r21-owner-only.rules');
const pre = read('scripts/pre-apk.cjs');
const docs = read('docs/DFL-V111-R21-SECURITY.md');
expect(roles.includes(uid) && roles.includes('isSuperadminUid'), 'UID do superadministrador e predicado centralizado');
expect(roles.includes("activation: 'not_enabled'"), 'Cadastros sem ativacao real');
expect(roles.includes('staff_admin') && roles.includes('purchases_write') && roles.includes('deliveries_complete'), 'Permissoes granulares tipadas');
expect(guard.includes('isSuperadminUid(user.uid)') && guard.includes('!isSuperadminUid(user.uid)'), 'AuthGuard bloqueia outros logins e initData');
expect(guard.includes('logout') && guard.includes('Acesso nao liberado'), 'Tela de negacao oferece saida');
const guarded = layout.slice(layout.indexOf('<AuthGuard>'), layout.indexOf('</AuthGuard>'));
expect(guarded.includes('<StoreAutomation />') && guarded.includes('<RouteOperations />'), 'Automacoes privadas dentro do AuthGuard');
expect(!layout.slice(0, layout.indexOf('<AuthGuard>')).includes('<StoreAutomation />'), 'Automacao nao monta antes do login');
expect(more.includes("router.push('/mais/acessos')") && more.includes('isSuperadminUid(user?.uid)'), 'Mais exibe painel apenas ao dono');
expect(ui.includes('loadStaffDrafts') && ui.includes('saveStaffDraft') && ui.includes('Nao ativado') === false, 'Formulario de rascunhos conectado ao repositorio');
expect(ui.includes('activation: \'not_enabled\''), 'UI salva rascunho sem ativacao');
expect(repo.includes('ensureOwner()') && repo.includes('writeBatch(db)'), 'Gravacoes somente admin e atomicas');
expect(repo.includes("collectionName = 'staff_access_drafts'") && repo.includes("auditName = 'staff_access_audit'"), 'Colecoes separadas com auditoria');
expect(repo.includes("permission !== 'staff_admin'"), 'Funcionarios nao recebem permissao de administrar');
expect(rules.includes(uid) && rules.includes('request.auth != null') && rules.includes('allow read, write: if superadmin()'), 'Espelho de regras owner-only, sem liberacao de equipe');
expect(!/allow\s+read\s*,\s*write\s*:\s*if\s+true\b/.test(rules), 'Nenhuma regra Firestore publica');
for(const path of ['app/api/integration/maintenance/route.ts','app/api/integration/diagnostics/route.ts','app/api/integration/diagnostic/message-trace/route.ts']){
 const source=read(path);
 expect(source.includes('isSuperadminUid(decoded.uid)') && source.includes('verifyIdToken'), `API protegida por UID: ${path}`);
}
expect(pre.includes('scripts/verify-v111-r21-access-foundation.cjs'), 'Contrato R21 no PRE-APK');
expect(docs.includes('R22') && docs.includes('nao autoriz') || docs.includes('NAO'), 'Plano de ativacao futura documentado');
console.log('V111 R21 - FUNDACAO DE ACESSOS: CONTRATOS OK');
