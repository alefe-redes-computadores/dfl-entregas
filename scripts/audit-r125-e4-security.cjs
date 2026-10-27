#!/usr/bin/env node
'use strict';
/** Read-only readiness assessment. Never talks to production or prints secrets. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const exists = f => fs.existsSync(f);
const read = f => exists(f) ? fs.readFileSync(f,'utf8') : '';
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const now = new Date().toISOString();
const ruleFiles = [];
for (const root of ['security','.']) {
  if (!exists(root)) continue;
  for(const entry of fs.readdirSync(root,{withFileTypes:true})) {
    if(!entry.isFile()) continue;
    if(/\.rules$/.test(entry.name))ruleFiles.push(path.join(root,entry.name));
  }
}
const sensitive = ['lib/access/roles.ts','lib/access/staffRepository.ts','lib/access/staffClaimPolicy.ts','app/api/access/staging/route.ts'];
const repoFiles=sensitive.filter(exists).map(file=>({file,sha256:sha(file)}));
const source=read('lib/access/roles.ts');
const draft=read('lib/access/staffRepository.ts');
const claim=read('lib/access/staffClaimPolicy.ts');
const pre=read('scripts/pre-apk.cjs');
const checks = [
 ['draft_activation_disabled',/activation:\s*'not_enabled'/.test(source)&&/record\.activation\s*!==\s*'not_enabled'/.test(draft)],
 ['owner_only_draft_write',/ensureOwner\(\)/.test(draft)&&/writeBatch\(db\)/.test(draft)],
 ['staff_claim_verified_email',/emailVerified/.test(claim)&&/claimableIdentity/.test(claim)],
 ['staff_claim_motoboy_binding',/requiresMotoboyBinding/.test(claim)&&/validMotoboyBinding/.test(claim)],
 ['r64_emulator_test_present',exists('scripts/test-v111-r64-rules-emulator.cjs')],
 ['r125_e1_test_present',exists('scripts/test-r125-staff-safety.cjs')],
 ['r125_e2_test_present',exists('scripts/test-r125-geocode-cache.cjs')],
 ['r125_e3_test_present',exists('scripts/test-r125-e3-resilience.cjs')],
 ['e4_test_preapk',pre.includes("'scripts/test-r125-e4-readiness.cjs'")],
];
const failed=checks.filter(([,pass])=>!pass).map(([name])=>name);
const tracked=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const status=cp.execFileSync('git',['status','--short','--untracked-files=no'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const report={
 kind:'DFL_ENTREGAS_SECURITY_READINESS_R125_E4', generated_at:now, head_local:tracked,
 code_checks:Object.fromEntries(checks), code_checks_failed:failed,
 local_rule_candidates:ruleFiles.map(file=>({file,sha256:sha(file)})),
 configuration:{firebase_json_present:exists('firebase.json'),root_firestor_rules_present:exists('firestore.rules')},
 production_rules:{verified:false,reason:'Regras efetivamente implantadas NAO consultadas. Sem acesso autenticado read-only ao ruleset de producao.'},
 staff_activation:{approved:false,reason:'Bloqueada independentemente dos testes estaticos.'},
 modified_tracked_files:status,
 source_fingerprints:repoFiles,
 next_action:'Obter ruleset implantado por conta autorizada; comparar hash e executar teste isolado/emulador antes do piloto.'
};
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exitCode=2;
