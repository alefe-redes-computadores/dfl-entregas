#!/usr/bin/env node
'use strict';
/** R125 E5: auditoria estática e somente leitura; não usa Firebase, rede ou credenciais. */
const fs=require('node:fs');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const path=require('node:path');
const exists=p=>fs.existsSync(p);
const read=p=>exists(p)?fs.readFileSync(p,'utf8'):'';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const categories={
 access:['lib/access/roles.ts','lib/access/staffRepository.ts','lib/access/staffClaimPolicy.ts','scripts/test-v111-r64-rules-emulator.cjs'],
 integration:['scripts/verify-v111-r66-site-inbox.cjs','scripts/test-v111-r66-site-inbox.cjs','scripts/test-v111-r67-inbox-collisions.cjs','scripts/verify-site-integration-observability-v24.cjs'],
 identity:['scripts/test-v112-r84-customer-identity.cjs','scripts/test-v112-r76-client-identity.cjs'],
 concurrency:['scripts/test-v112-r94-delivery-concurrency.cjs','scripts/test-v112-r93-write-order.cjs','scripts/test-v112-r92-snapshot-integrity.cjs'],
 performance:['scripts/test-v112-r89-performance.cjs','scripts/verify-v111-r38-read-budget.cjs','scripts/test-v112-r90-home-card-performance.cjs'],
 geocoding:['lib/address-autocomplete.ts','lib/store-geocoding.ts','scripts/test-r125-geocode-cache.cjs','scripts/test-r125-e3-resilience.cjs'],
 surgery:['scripts/test-r125-staff-safety.cjs','scripts/test-r125-e4-readiness.cjs','scripts/audit-r125-e4-security.cjs']
};
const pre=read('scripts/pre-apk.cjs');
const gateNames=[...pre.matchAll(/^\s*'([^']+\.cjs)'\s*,?/gm)].map(x=>x[1]);
const names=new Set(gateNames);
const inventory={};
for(const [group,files] of Object.entries(categories)){
 inventory[group]=files.map(file=>({path:file,exists:exists(file),preapk:names.has(file),sha256:exists(file)?hash(file):null}));
}
const critical=['scripts/test-r125-staff-safety.cjs','scripts/test-r125-geocode-cache.cjs','scripts/test-r125-e3-resilience.cjs','scripts/test-r125-e4-readiness.cjs','scripts/test-r125-e5-release.cjs'];
const issues=[];
for(const file of critical){if(!exists(file))issues.push('missing:'+file);if(!names.has(file))issues.push('ungated:'+file)}
if(gateNames.length!==names.size)issues.push('duplicate_preapk_tests');
const roles=read('lib/access/roles.ts');
const staff=read('lib/access/staffRepository.ts');
if(!roles.includes("activation: 'not_enabled'")||!staff.includes("record.activation !== 'not_enabled'"))issues.push('staff_activation_guard_missing');
const geo=read('lib/store-geocoding.ts');
for(const anchor of ['GEO_CACHE_TTL_MS','GEO_CACHE_MAX_ENTRIES','pendingGeocodes'])if(!geo.includes(anchor))issues.push('geocode_contract_missing:'+anchor);
let localHead='unknown';try{localHead=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}catch{}
const rules=[];
for(const dir of ['security','.'])if(exists(dir)&&fs.statSync(dir).isDirectory())for(const item of fs.readdirSync(dir,{withFileTypes:true}))if(item.isFile()&&item.name.endsWith('.rules')){const p=path.join(dir,item.name);rules.push({file:p,sha256:hash(p)})}
const report={kind:'DFL_R125_E5_READONLY_RELEASE_AUDIT',createdAt:new Date().toISOString(),localHead,
 release:{codeGatesOk:issues.length===0,productionRulesVerified:false,staffPilotAuthorized:false,commitOrPushPerformed:false},
 firestore:{productionRulesStatus:'UNVERIFIED',localCandidates:rules,warning:'Nunca inferir regras implantadas a partir de candidatos locais.'},
 inventory,gateCount:gateNames.length,issues,
 next:['Conferir ruleset de produção por canal autenticado autorizado','Comparar ruleset com candidato e testar em emulador demo-','Só então planejar piloto motoboy com revogação e escopo por rota','Auditar Inbox com dados anonimizados antes de alterar reconciliação']};
console.log(JSON.stringify(report,null,2));
if(issues.length)process.exitCode=2;
