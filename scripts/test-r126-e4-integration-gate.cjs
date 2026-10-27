#!/usr/bin/env node
'use strict';
// Runs only existing isolated regression suites; no writes to Firebase or business data.
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const suites=[
 'scripts/test-v111-r67-inbox-collisions.cjs',
 'scripts/test-v112-r84-customer-identity.cjs',
 'scripts/test-v112-r91-sync-resilience.cjs',
 'scripts/test-r126-e3-staff-boundary.cjs'
];
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
assert.equal((pre.match(/test-r126-e4-integration-gate\.cjs/g)||[]).length,1,'R126-E4 registered once');
for(const file of suites){
 assert.ok(fs.existsSync(file),'missing '+file);
 const run=spawnSync(process.execPath,[file],{stdio:'pipe',encoding:'utf8',timeout:120000});
 if(run.status!==0){console.error('FAIL '+file+'\n'+run.stdout.slice(-3000)+'\n'+run.stderr.slice(-3000));process.exit(1);}
 console.log('PASS '+file);
}
const audit=spawnSync(process.execPath,['scripts/audit-r126-e4-integration.cjs'],{stdio:'inherit',timeout:30000});
assert.equal(audit.status,0,'static audit failed');
console.log('R126-E4 INTEGRATION + SYNC + STAFF: all checks passed');
