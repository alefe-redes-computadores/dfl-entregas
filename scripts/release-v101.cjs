#!/usr/bin/env node
'use strict';
// V101 — auditoria local, sem push, commit, deploy, git add, banco ou rede.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const required=[
 '.github/workflows/main.yml', 'scripts/pre-apk.cjs',
 'scripts/verify-v101-release-candidate.cjs',
 'scripts/patch-android-location-permissions.mjs',
 'scripts/patch-android-system-bars.mjs',
 'scripts/patch-android-admin-bridge.mjs',
 'lib/ifood-confirmation-authority.ts',
 'lib/stock-mutation-plan.ts', 'lib/stock-supply-ledger.ts',
 'lib/whatsapp.ts', 'lib/route-share-card.ts',
 'lib/device-location.ts', 'docs/V101-RELEASE-CANDIDATE.md',
];
const errors=[], warnings=[];
const mode=process.argv[2]||'--inspect';
if (!['--inspect','--report','--selftest'].includes(mode)){
 console.error('Uso: node scripts/release-v101.cjs [--inspect|--report|--selftest]');process.exit(2);
}
const sensitive=(p)=>/(^|\/)(?:\.env(?:\..*)?|google-services\.json|[^/]+\.(?:pem|key|jks|keystore)|service-?account[^/]*\.json)$/i.test(p);
const unwanted=(p)=>/^(?:android\/|ios\/|node_modules\/|\.next\/|out\/|\.dfl-|\.git\/|dist\/)|\.(?:zip|tar|gz|log|bak|tmp)$|(?:^|\/)tsconfig\.tsbuildinfo$|(?:^|\/)next-env\.d\.ts$/.test(p);
const allowedNew=(p)=>/^(?:app|components|lib|hooks|store|types|scripts|docs|public|assets|\.github\/workflows)\//.test(p) && /\.(?:tsx?|jsx?|cjs|mjs|css|scss|json|md|yml|yaml|svg|png|webp|xml|py|sh)$/.test(p);
const git=(...args)=>cp.spawnSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024});
const gitList=(...args)=>{const r=git(...args);return r.status===0?r.stdout.split('\0').filter(Boolean):[];};
for(const p of required)if(!fs.existsSync(p))errors.push('Arquivo requerido ausente: '+p);
const workflow=fs.existsSync(required[0])?fs.readFileSync(required[0],'utf8'):'';
for(const token of [
 'contents: read','timeout-minutes: 60',
 'patch-android-location-permissions.mjs',
 'patch-android-system-bars.mjs',
 'patch-android-admin-bridge.mjs',
 'DEBUG_KEYSTORE_BASE64', 'apksigner',
 'actions/upload-artifact@v4',
 'node scripts/pre-apk.cjs', 'node node_modules/typescript/bin/tsc --noEmit',
]) if(!workflow.includes(token))errors.push('Contrato Android/Actions ausente: '+token);
const steps=[
 'npx cap sync android',
 'node scripts/patch-android-location-permissions.mjs',
 'node scripts/patch-android-system-bars.mjs',
 'node scripts/patch-android-admin-bridge.mjs',
 './gradlew clean assembleDebug',
 'actions/upload-artifact@v4',
];
if(steps.some((x,i)=>i>0&&workflow.indexOf(x)<workflow.indexOf(steps[i-1])))errors.push('Ordem de build Android incorreta');
const trackedState=git('rev-parse','--is-inside-work-tree');
let candidates=[];
if(trackedState.status===0){
 const tracked=gitList('ls-files','-z');
 const modified=gitList('diff','HEAD','--name-only','-z');
 const fresh=gitList('ls-files','--others','--exclude-standard','-z');
 const trackedSensitive=tracked.filter(sensitive);
 if(trackedSensitive.length)errors.push('Arquivos sensíveis rastreados: '+trackedSensitive.join(', '));
 const touched=[...new Set([...modified,...fresh])];
 const touchedSensitive=touched.filter(sensitive);
 if(touchedSensitive.length)errors.push('Arquivos sensíveis no diretório de trabalho: '+touchedSensitive.join(', '));
 const acceptedTracked=modified.filter(p=>!sensitive(p)&&!unwanted(p));
 const acceptedNew=fresh.filter(p=>!sensitive(p)&&!unwanted(p)&&allowedNew(p));
 const excluded=fresh.filter(p=>!sensitive(p)&&!acceptedNew.includes(p));
 candidates=[...new Set([...acceptedTracked,...acceptedNew])].sort();
 const chk=git('diff','--check');if(chk.status!==0)errors.push('git diff --check: '+(chk.stdout||chk.stderr).slice(0,300));
 const chk2=git('diff','--cached','--check');if(chk2.status!==0)errors.push('git diff --cached --check: '+(chk2.stdout||chk2.stderr).slice(0,300));
 const head=git('rev-parse','--short','HEAD');
 console.log('Git HEAD:',head.status===0?head.stdout.trim():'indisponível');
 console.log('Arquivos alterados rastreados:',modified.length);
 console.log('Arquivos novos candidatos:',acceptedNew.length);
 console.log('Arquivos novos EXCLUÍDOS da sugestão:',excluded.length);
 if(excluded.length)console.log('Excluídos (inspecionar manualmente):',excluded.slice(0,30).join(', '));
 const status=git('status','--porcelain=v1');
 console.log('Git status: '+(status.status===0?status.stdout.trim().split(/\r?\n/).filter(Boolean).length:'indisponível')+' caminhos');
 const remote=git('remote','get-url','origin');if(remote.status===0&&!/alefe-redes-computadores\/dfl-entregas(?:\.git)?$/.test(remote.stdout.trim()))warnings.push('Confirmar remoto GitHub antes de publicar');
 if(!candidates.length)warnings.push('Nenhuma alteração para publicar: conferir se os arquivos já foram enviados');
 if(mode==='--report'){
  const dir=path.join(os.homedir(),'storage','downloads');
  if(!fs.existsSync(dir))errors.push('Pasta Downloads inacessível; relatório não gerado');
  else {
   const file=path.join(dir,'dfl-v101-release-candidatos.txt');
   const pathFile=path.join(dir,'dfl-v101-release-candidatos.nul');
   // Evita criar arquivos adicionais se houver qualquer potencial vazamento.
   if(!errors.length){
    fs.writeFileSync(file,[
     'DFL ENTREGAS — V101 | REVISÃO OBRIGATÓRIA ANTES DO STAGE',
     'ATENÇÃO: esta é uma lista de candidatos, NÃO uma autorização de publicação.',
     'Verifique cada diff e arquivos novos antes de usar git add.',
     'Nunca utilizar git add .', '',...candidates,'',
     'FireStore Rules: verificar manualmente no Console; última regra informada era aberta.',
     'APK: conferir assinatura, GPS e integração site após build.',
    ].join('\n')+'\n');
    fs.writeFileSync(pathFile,candidates.join('\0')+(candidates.length?'\0':''));
    console.log('LISTA PARA REVISÃO:',file);
    console.log('PATHS NUL (não executa git add):',pathFile);
   }
  }
 }
}else warnings.push('Sem .git nesta cópia — revisão seletiva do commit exige Termux');
// Este projeto utiliza Firebase/Firestore, não migrar políticas do DFL Site sem auditoria.
warnings.push('REVISÃO EXTERNA: regras atuais do Firestore precisam ser checadas no console. Não aprovar allow read, write: if true.');
warnings.push('TESTE REAL: APK localização, Pix, retirada Site, WhatsApp, rota/iFood e acerto antes do rollout geral.');
console.log('\n=== V101 — RELEASE PREFLIGHT ===');
errors.forEach(e=>console.error('BLOQUEIO:',e));
warnings.forEach(w=>console.warn('PENDENTE:',w));
console.log(errors.length?'BLOQUEADO — CORRIGIR ANTES DE PUBLICAR':'VERIFICAÇÃO DE CÓDIGO OK — PUBLICAÇÃO MANUAL PENDENTE');
console.log('Nenhum git add, commit, push, deploy ou escrita no banco.');
process.exit(errors.length?1:0);
