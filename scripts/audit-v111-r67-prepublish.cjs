#!/usr/bin/env node
'use strict';
/** Inventário SOMENTE LEITURA — não executa commit, push, deploy, Rule deploy ou flags. */
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const git=(args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const head=git(['rev-parse','HEAD']);
const branch=git(['branch','--show-current']);
const paths=[...new Set([...git(['ls-files','--modified','--others','--exclude-standard']).split('\n'), ...git(['ls-files','--deleted']).split('\n')].filter(Boolean))].sort();
const secrets=/(^|\/)(\.env[^/]*|\.npmrc|[^/]*\.pem|[^/]*\.key|[^/]*\.jks|[^/]*\.keystore|google-services\.json|[^/]*service.?account[^/]*\.json|local\.properties)$/i;
const suspicious=paths.filter(p=>secrets.test(p));
const oversized=[];
const hashes=[];
for(const rel of paths){
 const f=path.resolve(root,rel);
 if(!(f.startsWith(root+path.sep)))continue;
 if(!fs.existsSync(f)||!fs.statSync(f).isFile())continue;
 const stat=fs.statSync(f);
 if(stat.size>1024*1024*3){oversized.push(rel);continue;}
 hashes.push(`${crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}  ${rel}`);
}
let diffOk=true;
try{git(['diff','--check']);}catch{diffOk=false;}
const ownerRules=fs.readFileSync(path.join(root,'security/firestore.v111-r23-owner-only.rules'),'utf8');
const ownerOnly=ownerRules.includes('if superadmin();') && !ownerRules.includes('allow read, write: if true');
const flags=['NEXT_PUBLIC_DFL_STAFF_PORTAL_ENABLED','DFL_STAFF_OPERATION_REQUESTS_ENABLED','DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED','DFL_STAFF_PROJECTION_REFRESH_ENABLED'];
const pathsEnv=['.env','.env.local','.env.production','.env.production.local'];
const enabled=[];
for(const file of pathsEnv){const full=path.join(root,file);if(!fs.existsSync(full))continue;
 for(const row of fs.readFileSync(full,'utf8').split(/\r?\n/)){
  const found=row.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*['\"]?(true)(?:['\"]|\s|$)/i);
  if(found && flags.includes(found[1]))enabled.push(file+':'+found[1]);
 }
}
const state=branch==='main' && head==='4a469b8f905e64261b252d9f867d1c56a3570239' && diffOk && ownerOnly && !suspicious.length && !oversized.length && !enabled.length;
const lines=[
 'DFL ENTREGAS V111 R67 — INVENTARIO LOCAL PRE-PUBLICACAO (NAO E AUTORIZACAO)',
 `HEAD: ${head}`,`BRANCH: ${branch}`,`Arquivos alterados / novos / excluidos: ${paths.length}`,
 `Git diff --check: ${diffOk?'OK':'FALHOU'}`,
 `Rules owner-only no arquivo candidato local: ${ownerOnly?'PRESERVADA':'REVISAR'}`,
 `Caminhos sensiveis encontrados: ${suspicious.length}`,`Arquivos grandes (>3MB) pendentes: ${oversized.length}`,
 `Flags explicitamente true em arquivos .env locais conhecidos: ${enabled.join(', ')||'nenhuma encontrada (nao comprova producao)'}`,
 `Preflight local: ${state?'SEM BLOQUEIOS AUTOMATICOS':'REVISAR BLOQUEIOS'}`,
 'PENDENTE: Firebase Emulator real + Rules Console produção + revisão de CI/Vercel.',
 'PENDENTE: QA Android + pedido real do Site + cancelamento e reconexao offline.',
 'PENDENTE: AUTORIZACAO EXPLICITA PARA COMMIT, PUSH, DEPLOY E STAFF.',
 '', 'SHA256 DOS ARQUIVOS ALTERADOS (NAO ENVIE ARQUIVOS COM SEGREDOS):',...hashes,
 '', 'CAMINHOS BLOQUEADOS/SUSPEITOS:',...suspicious,...oversized,
 'Este script NÃO faz git add, commit, push, deploy, migração ou alteração de Rules/flags.',
];
const target=process.argv[2] ? path.resolve(process.argv[2]):null;
if(target){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,lines.join('\n')+'\n',{mode:0o600});}
console.log(lines.slice(0,16).join('\n'));
if(target)console.log('Relatorio: '+target);
if(!state)process.exitCode=2;
