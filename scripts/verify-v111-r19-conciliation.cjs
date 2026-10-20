#!/usr/bin/env node
'use strict';
/** Cross-variant R18 reconciliation contract: both sides must remain enforced. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
let checks=0;
function check(name, fn){ fn(); checks++; console.log('OK R19:',name); }
const read = file => fs.readFileSync(file,'utf8');
const pre = read('scripts/pre-apk.cjs');
const tests = [...pre.matchAll(/'([^']+\.cjs)'/g)].map(m=>m[1]);
for(const file of [
 'scripts/verify-v111-r19-conciliation.cjs',
 'scripts/verify-v111-r18-release-candidate.cjs',
 'scripts/verify-v111-r18-integration-closeout.cjs',
 'scripts/verify-v111-r18-release-gate.cjs',
 'scripts/verify-v111-r17-finance-route-safety.cjs',
 'scripts/verify-v111-r16-premium-closeout.cjs',
]){
 check(`suite obrigatoria registrada: ${file}`,()=>assert.equal(tests.filter(t=>t===file).length,1));
 check(`suite obrigatoria presente: ${file}`,()=>assert.ok(fs.statSync(file).isFile()));
}
check('PRE-APK nao perdeu suites historicas',()=>assert.ok(tests.length>=136));
check('PRE-APK nao tem suites duplicadas',()=>assert.equal(new Set(tests).size,tests.length));
const detail=read('app/rotas/details/page.tsx');
const api=read('app/api/integration/outbox/drain/route.ts');
const relay=read('lib/integration/server/reverseRelay.ts');
const rg=read('scripts/release-gate-v111.cjs');
check('rotas agrupadas por parada real',()=>assert.match(detail,/groupDeliveriesByStop/));
check('rotas mascaram valores em privacidade',()=>assert.ok((detail.match(/isPrivacyMode \? 'R\$ •••'/g)||[]).length>=2));
check('rotas mantem carregamento progressivo',()=>assert.match(detail,/visibleStopGroups/));
check('outbox usa resultado de duas etapas',()=>assert.match(api,/reverseDrainOutcome\(reconciliation, relay\)/));
check('relay valida resposta de negocio',()=>assert.match(relay,/ok|success/));
check('helper de resultado compartilhado existe',()=>assert.ok(fs.existsSync('lib/integration/drain-outcome.ts')));
check('gate exige testes de rotas',()=>assert.match(rg,/verify-v111-r18-release-candidate.cjs/));
check('gate exige testes de integracao',()=>assert.match(rg,/verify-v111-r18-integration-closeout.cjs/));
check('auditoria de rotas mantida',()=>assert.ok(fs.existsSync('scripts/audit-v111-release-preflight.cjs')));
check('nenhum arquivo essencial omitido',()=>{
 for (const f of ['lib/route-stops.ts','lib/route-cash-flow.ts','components/home/RouteAccordion.tsx'])
   assert.ok(fs.existsSync(f),f);
});
console.log(`V111 R19: ${checks} verificacoes de conciliacao aprovadas.`);
