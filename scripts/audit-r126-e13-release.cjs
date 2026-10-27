#!/usr/bin/env node
'use strict';
/** R126 E13: inventario de release somente leitura. Sem publicar, sem consultar Firebase. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const REQUIRED=['scripts/test-r125-geocode-cache.cjs','scripts/test-r125-e3-resilience.cjs','scripts/audit-r125-readonly.cjs','scripts/audit-r125-e4-security.cjs','scripts/test-r125-e5-release.cjs','scripts/test-r126-e5-address-autocomplete.cjs','scripts/test-r126-e11-route-metrics.cjs','scripts/test-r126-e12-ifood-index.cjs'];
const SENSITIVE=/^(?:\.env(?:\.|$)|.*(?:private.?key|service.?account|credentials|\.pem$|\.p12$|\.keystore$|\.jks$))/i;
const REPO='alefe-redes-computadores/dfl-entregas';
function git(args){const r=cp.spawnSync('git',args,{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error(`git ${args[0]} nao concluiu: ${r.stderr?.slice(0,300)}`);return r.stdout.trimEnd()}
function pathsOfDiff(flag){return git(['diff',...flag,'--name-only','-z']).split('\0').filter(Boolean)}
function safePath(p){return typeof p==='string'&&!p.includes('\0')&&!p.startsWith('/')&&!p.split('/').includes('..')}
function candidateClassification(p){if(SENSITIVE.test(path.basename(p))||p.startsWith('.env'))return 'SENSIVEL_NAO_PUBLICAR';if(/^security\/|^firestore\.rules$|^firebase\.json$/.test(p))return 'REGRAS_CONFERIR_SEPARADO';if(/^scripts\/|^lib\/|^components\/|^app\/|^hooks\/|^store\/|^docs\/|^types\//.test(p))return 'CODIGO_AVALIAR';return 'REVISAR_MANUALMENTE'}
function evaluateFiles(files){return files.filter(safePath).map(p=>({path:p,category:candidateClassification(p)}))}
function run(){
 const branch=git(['branch','--show-current']);const head=git(['rev-parse','HEAD']);const upstream=git(['rev-parse','--abbrev-ref','--symbolic-full-name','@{upstream}']).trim();
 const tracked=git(['ls-files','-z']).split('\0').filter(Boolean);
 const modified=pathsOfDiff([]),staged=pathsOfDiff(['--cached']);
 const untracked=git(['ls-files','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
 const impacted=[...new Set([...modified,...staged,...untracked])].sort();
 const seen= new Set(tracked.concat(untracked));
 const missing=REQUIRED.filter(p=>!seen.has(p)||!fs.existsSync(p));
 const rootPre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
 const gateMissing=REQUIRED.filter(p=>p.startsWith('scripts/test-')&&!rootPre.includes(`'${p}'`));
 const flags=['NEXT_PUBLIC_DFL_STAFF_PORTAL_ENABLED','NEXT_PUBLIC_DFL_STAFF_LINK_REQUEST_ENABLED','DFL_STAFF_OPERATION_REQUESTS_ENABLED','DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED'];
 const envWarnings=[];for(const file of ['.env','.env.local','.env.production','.env.production.local']){
 if(!fs.existsSync(file))continue;
 const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);
 for(const flag of flags)if(lines.some(line=>new RegExp(`^\\s*${flag}\\s*=\\s*["']?true["']?\\s*(?:#.*)?$`).test(line)))envWarnings.push({file,flag,status:'ENABLED_REVIEW_REQUIRED'});
 }
 const rootRules=fs.existsSync('firestore.rules')?fs.readFileSync('firestore.rules','utf8'):null;
 const overlyOpen=Boolean(rootRules&&/allow\s+(?:read\s*,\s*write|write\s*,\s*read)\s*:\s*if\s+true\b/.test(rootRules));
 const findings=[];
 if(branch!=='main')findings.push({level:'blocker',message:'Branch nao e main'});
 if(missing.length)findings.push({level:'blocker',message:`Faltam ${missing.length} artefatos de etapas anteriores`});
 if(gateMissing.length)findings.push({level:'blocker',message:`Faltam ${gateMissing.length} gates das cirurgias anteriores`});
 if(overlyOpen)findings.push({level:'blocker',message:'firestore.rules local contem allow read, write: if true'});
 if(envWarnings.length)findings.push({level:'blocker',message:'Flags de acesso de equipe ativadas em .env local; requer homologacao de regras em producao'});
 if(staged.length)findings.push({level:'attention',message:'Existem arquivos ja staged: revisar antes de commit seletivo'});
 if(impacted.some(p=>candidateClassification(p)==='SENSIVEL_NAO_PUBLICAR'))findings.push({level:'attention',message:'Arquivos sensiveis detectados; nunca adicionar ao commit'});
 findings.push({level:'attention',message:'Regras Firestore de PRODUCAO nao verificadas por este inventario. Staff segue bloqueado.'});
 const files=evaluateFiles(impacted);
 const report={kind:'DFL-ENTREGAS-R126-E13-READONLY',generatedAt:new Date().toISOString(),repository:REPO,branch,head,upstream,changes:{modified:modified.length,staged:staged.length,untracked:untracked.length},requiredArtifacts:{checked:REQUIRED.length,missing,missingGates:gateMissing},files,flagsEnabledByNameOnly:envWarnings,findings,releaseReadiness:findings.some(x=>x.level==='blocker')?'BLOQUEADO':'AUDITORIA_LOCAL_OK_PRODUCAO_NAO_HOMOLOGADA'};
 const target=process.argv[2];if(target){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');}
 console.log('R126 E13:',report.releaseReadiness,'HEAD:',head.slice(0,12));console.log('Alterados:',modified.length,'staged:',staged.length,'novos:',untracked.length,'pendencias:',findings.length);
 for(const f of findings)console.log(f.level.toUpperCase()+':',f.message);
 if(target)console.log('Relatorio:',target);
 if(process.argv.includes('--strict')&&report.releaseReadiness==='BLOQUEADO')process.exitCode=1;
 return report;
}
if(require.main===module)run();else module.exports={REQUIRED,safePath,candidateClassification,evaluateFiles};
