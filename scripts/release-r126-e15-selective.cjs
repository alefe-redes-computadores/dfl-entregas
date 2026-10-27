#!/usr/bin/env node
'use strict';
/** R126 E15: exact allow-list of approved local surgery files. Never performs git mutations. */
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const {classify}=require('./release-r126-e14-plan.cjs');
const ALLOW=[
 'lib/access/roles.ts',
 'lib/access/staffRepository.ts',
 'lib/access/staffClaimPolicy.ts',
 'lib/store-geocoding.ts',
 'lib/address-autocomplete.ts',
 'lib/operation/route-card-metrics.ts',
 'lib/operation/ifood-self-confirm-route.ts',
 'components/layout/BottomNav.tsx',
 'components/layout/Header.tsx',
 'components/home/RouteAccordion.tsx',
 'components/home/OperationalCommandCenter.tsx',
 'app/rotas/page.tsx',
 'scripts/pre-apk.cjs',
 'scripts/test-r125-staff-safety.cjs',
 'scripts/test-r125-geocode-cache.cjs',
 'scripts/audit-r125-readonly.cjs',
 'scripts/test-r125-e3-resilience.cjs',
 'scripts/audit-r125-e4-security.cjs',
 'scripts/test-r125-e4-readiness.cjs',
 'scripts/audit-r125-e5-release.cjs',
 'scripts/test-r125-e5-release.cjs',
 'scripts/audit-r126-e1-rules-readonly.cjs',
 'scripts/test-r126-e1-identity.cjs',
 'scripts/test-r126-e2-least-privilege.cjs',
 'scripts/test-r126-e3-staff-boundary.cjs',
 'scripts/audit-r126-e4-integration.cjs',
 'scripts/test-r126-e4-integration-gate.cjs',
 'scripts/test-r126-e5-address-autocomplete.cjs',
 'scripts/test-r126-e6-bottom-nav.cjs',
 'scripts/test-r126-e7-header.cjs',
 'scripts/test-r126-e8-route-ux.cjs',
 'scripts/test-r126-e9-home-actions.cjs',
 'scripts/test-r126-e10-route-card-accessibility.cjs',
 'scripts/test-r126-e11-route-metrics.cjs',
 'scripts/test-r126-e12-ifood-index.cjs',
 'scripts/audit-r126-e13-release.cjs',
 'scripts/test-r126-e13-release.cjs',
 'scripts/release-r126-e14-plan.cjs',
 'scripts/test-r126-e14-plan.cjs',
 'scripts/release-r126-e15-selective.cjs',
 'scripts/test-r126-e15-selective.cjs',
];
// Three explicitly-reviewed omissions from the E14 inventory. They are NOT staged.
// Never blanket-allow an unknown lib/components/app file.
const REVIEW_HOLD = new Set([
 'lib/access/staffPortalRepository.ts',
 'lib/access/staffRuntime.ts',
]);
const BACKUP_FILE = 'components/home/RouteAccordion.tsx.orig';
const set=new Set(ALLOW);
function git(args){const r=cp.spawnSync('git',args,{encoding:'buffer',maxBuffer:64*1024*1024});if(r.status!==0)throw Error(`Falhou git ${args[0]}: ${String(r.stderr).slice(0,250)}`);return r.stdout;}
function names(args){return git(args).toString('utf8').split('\0').filter(Boolean);}
function createPlan(){
 if(set.size!==ALLOW.length)throw Error('Caminhos repetidos no allow-list');
 if(git(['branch','--show-current']).toString().trim()!=='main')throw Error('Branch nao e main');
 const staged=names(['diff','--cached','--name-only','-z']);
 if(staged.length)throw Error(`Index ja contem ${staged.length} arquivo(s) staged; revisar sem reset automatico`);
 const impacted=[...new Set([...names(['diff','--name-only','-z']),...names(['ls-files','--others','--exclude-standard','-z'])])].sort();
 const candidates=impacted.filter(p=>set.has(p));
 const excluded=impacted.filter(p=>!set.has(p));
 if(!candidates.length)throw Error('Nenhum candidato local para release');
 for(const p of ALLOW){if(classify(p).status!=='CANDIDATE')throw Error('Caminho nao autorizado pela E14: '+p);}
 for(const p of candidates){
  if(!fs.existsSync(p)||!fs.statSync(p).isFile()||fs.lstatSync(p).isSymbolicLink())throw Error('Candidato nao e arquivo regular: '+p);
  if(p.startsWith('security/')||p.startsWith('.env')||/credentials|secret|\.pem$|\.key$|service.account/i.test(p))throw Error('Possivel segredo: '+p);
 }
 const mandatory=['scripts/pre-apk.cjs','scripts/test-r126-e12-ifood-index.cjs','scripts/test-r126-e14-plan.cjs','scripts/release-r126-e15-selective.cjs'];
 for(const p of mandatory)if(!candidates.includes(p))throw Error('Falta no release: '+p);
 // Refuse to publish if core surgery files were locally changed but outside this release.
 const omittedCode=excluded.filter(p=>
  /^(lib\/|components\/|app\/|store\/|hooks\/|types\/)/.test(p) &&
  p !== BACKUP_FILE && !REVIEW_HOLD.has(p)
 );
 const heldForReview=excluded.filter(p=>REVIEW_HOLD.has(p));
 const backupArtifacts=excluded.filter(p=>p===BACKUP_FILE);
 // Protection against disguised backup files being silently admitted.
 if(candidates.some(p=>/\.(?:orig|bak|backup|rej)$/.test(p)))throw Error('Backup no release');
 if(omittedCode.length)throw Error('Codigo nao selecionado exige revisao manual: '+omittedCode.join(', '));
 return {kind:'DFL-R126-E15-SELECTIVE',head:git(['rev-parse','HEAD']).toString().trim(),candidates,excluded,heldForReview,backupArtifacts,staffProductionRulesVerified:false};
}
function main(){const filename=process.argv[2];if(!filename)throw Error('Informe caminho absoluto para relatorio');const report=createPlan();fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n');fs.writeFileSync(filename.replace(/\.json$/,'.paths0'),report.candidates.join('\0')+'\0');console.log(`R126 E15: ${report.candidates.length} arquivo(s) selecionados, ${report.excluded.length} fora do release`);console.log('Relatorio:',filename);}
if(require.main===module)main();else module.exports={ALLOW,createPlan};
