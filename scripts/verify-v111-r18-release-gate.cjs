#!/usr/bin/env node
'use strict';
/** Release gates must be locally read-only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const gate = fs.readFileSync('scripts/release-gate-v111.cjs', 'utf8');
const required = [
  'lib/integration/drain-outcome.ts',
  'lib/integration/server/reverseRelay.ts',
  'lib/delivery-finance.ts',
  'lib/route-cash-flow.ts',
  'lib/stock-panel-preferences.ts',
];
for (const file of required) assert.ok(fs.existsSync(file), `arquivo obrigatorio: ${file}`);
assert.match(gate, /firestore|Firestore/);
assert.match(gate, /Supabase\/Evolution V2/);
assert.match(gate, /APK GitHub Actions/);
assert.match(gate, /PUBLICAÇÃO PENDENTE/);
assert.doesNotMatch(gate, /git\s+(?:reset|clean|push|commit|add\s+\.)/);
assert.doesNotMatch(gate, /execFileSync\([^)]*['"](?:firebase|supabase|curl|wget)['"]/);
const output = execFileSync(process.execPath, ['scripts/release-gate-v111.cjs'], { encoding: 'utf8' });
assert.match(output, /GATE LOCAL:/);
assert.match(output, /PUBLICAÇÃO PENDENTE DAS HOMOLOGAÇÕES/);
assert.match(output, /NÃO EXECUTADAS/);
const pre = fs.readFileSync('scripts/pre-apk.cjs','utf8');
assert.match(pre, /verify-v111-r18-integration-closeout.cjs/);
assert.match(pre, /verify-v111-r18-release-gate.cjs/);
console.log('V111 R18 release gate: 12 verificacoes aprovadas.');
