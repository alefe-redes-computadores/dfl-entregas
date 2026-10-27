#!/usr/bin/env node
'use strict';
/** Read-only release candidate planner. This tool never stages, commits or pushes. */
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const crypto=require('node:crypto');
const {candidateClassification}=require('./audit-r126-e13-release.cjs');
function git(args){const p=cp.spawnSync('git',args,{encoding:'buffer',maxBuffer:32*1024*1024});if(p.status!==0)throw Error(`git ${args.join(' ')} failed (${p.status})`);return p.stdout;}
function decode(buf){return buf.toString('utf8').split('\0').filter(Boolean)}
function paths(){const modified=decode(git(['diff','--name-only','-z']));const staged=decode(git(['diff','--cached','--name-only','-z']));const untracked=decode(git(['ls-files','--others','--exclude-standard','-z']));return {modified,staged,untracked}}
function classify(file){
 const k=candidateClassification(file);
 if(k==='SENSIVEL_NAO_PUBLICAR')return {status:'BLOCK',reason:'Sensitive material'};
 if(k==='REGRAS_CONFERIR_SEPARADO')return {status:'HOLD',reason:'Production Firestore rules not confirmed'};
 if(k!=='CODIGO_AVALIAR')return {status:'REVIEW',reason:'Not included in the code allow-list'};
 if(/^scripts\/(?:pre-apk\.cjs|test-|verify-|audit-|check-|release-)/.test(file)||/^lib\/|^components\/|^hooks\/|^app\/|^store\/|^types\/|^docs\//.test(file))return {status:'CANDIDATE',reason:'Code or contract; review diff before staging'};
 return {status:'REVIEW',reason:'Unclassified script or asset'};
}
function buildReport(entries,head){const all=[...new Set([...entries.modified,...entries.staged,...entries.untracked])].sort();
 const files=all.map(file=>({...{path:file},...classify(file),tracked:!entries.untracked.includes(file),preStaged:entries.staged.includes(file)}));
 const blockers=files.filter(f=>f.preStaged&&f.status!=='CANDIDATE');
 return {kind:'DFL-R126-E14-SELECTIVE-RELEASE-PLAN',generatedAt:new Date().toISOString(),head,counts:{modified:entries.modified.length,staged:entries.staged.length,untracked:entries.untracked.length,candidates:files.filter(x=>x.status==='CANDIDATE').length,held:files.filter(x=>x.status==='HOLD').length,blocked:files.filter(x=>x.status==='BLOCK').length,review:files.filter(x=>x.status==='REVIEW').length},files,findings:[...(blockers.length?[`ATTENTION: ${blockers.length} staged paths require manual exclusion/review`]:[]),'Staff activation requires independent verification of deployed production security rules','No push or production operation was performed']};
}
function run(){const root=process.cwd();if(!fs.existsSync(path.join(root,'.git')))throw Error('Not at repository root');
 const branch=git(['branch','--show-current']).toString('utf8').trim();if(branch!=='main')throw Error('Branch must be main');
 const head=git(['rev-parse','HEAD']).toString('utf8').trim();const e=paths();const report=buildReport(e,head);
 const output=process.argv[2];if(!output)throw Error('Expected report JSON path');
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 const plan=output.replace(/\.json$/,'')+'.md';let md='# DFL Entregas — plano seletivo R125/R126\n\n';
 md+=`HEAD: \`${head}\` · Branch: \`${branch}\`\n\n`;
 md+='Este documento não autoriza staging automático, commit, push, deploy ou ativação de funcionários.\n\n';
 for(const [status,title] of [['BLOCK','Bloqueado'],['HOLD','Separado para homologação'],['REVIEW','Revisão manual'],['CANDIDATE','Candidato ao commit seletivo']]){
  const list=report.files.filter(f=>f.status===status);md+=`## ${title} (${list.length})\n\n`;
  if(!list.length)md+='Nenhum.\n\n';else for(const f of list)md+=`- \`${f.path.replaceAll('`','')}\` ${f.preStaged?'(já staged) ':''}— ${f.reason}\n`;
  md+='\n';
 }
 md+='## Antes de publicar\n\nConferir diff individual, `git diff --check`, TypeScript e `node scripts/pre-apk.cjs`; revisar o que já está em stage, e separar regras/segredos. Sem `git add -A`. Regras implantadas na produção NÃO foram verificadas.\n';
 fs.writeFileSync(plan,md);
 console.log(`R126 E14 plano gerado: ${output}`);console.log(`Checklist: ${plan}`);console.log(JSON.stringify(report.counts));
}
if(require.main===module)run();else module.exports={classify,buildReport};
