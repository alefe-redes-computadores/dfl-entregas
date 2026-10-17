#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const y=fs.readFileSync('.github/workflows/main.yml','utf8');
for(const txt of ['permissions:\n  contents: read','concurrency:', 'timeout-minutes: 60','retention-days: 14','node scripts/patch-android-location-permissions.mjs','node scripts/patch-android-system-bars.mjs','DEBUG_KEYSTORE_BASE64','actions/upload-artifact@v4'])assert(y.includes(txt),'Falta no workflow: '+txt);
for(const txt of ['npx cap sync android','node scripts/patch-android-location-permissions.mjs','node scripts/patch-android-system-bars.mjs','./gradlew clean assembleDebug','actions/upload-artifact@v4'])assert(y.includes(txt),'Build Android sem etapa: '+txt);
for(const file of ['scripts/release-v101.cjs','docs/V101-RELEASE-CANDIDATE.md','lib/stock-mutation-plan.ts','lib/ifood-confirmation-authority.ts'])assert(fs.existsSync(file),'Arquivo indispensável ausente: '+file);
const src=fs.readFileSync('scripts/release-v101.cjs','utf8');
assert(src.includes('git diff --check') || src.includes("git('diff','--check')"),'Gate precisa conferir Git');
assert(src.includes("mode==='--report'"),'Gate precisa produzir manifesto revisável');
assert(src.includes('allowedNew'),'Gate deve selecionar arquivos novos');
assert(src.includes('sensitive'),'Gate deve filtrar nomes potencialmente sensíveis');
const r=cp.spawnSync(process.execPath,['scripts/release-v101.cjs','--selftest'],{encoding:'utf8',maxBuffer:4*1024*1024});
assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
assert.match(r.stdout,/PUBLICAÇÃO MANUAL PENDENTE/);
console.log('V101 — build Android, release-gate, manifestos e segurança local: OK');
