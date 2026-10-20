#!/usr/bin/env node
'use strict';
/** Auditoria de leitura: NUNCA executa commit, push, fetch, deploy ou migração. */
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
function git(args){
 const p=spawnSync('git',args,{encoding:'utf8',maxBuffer:4*1024*1024});
 return {ok:p.status===0,out:(p.stdout||'').trim(),error:(p.stderr||'').trim()};
}
const failures=[],warnings=[];
const required=[
 'scripts/pre-apk.cjs',
 'scripts/verify-v111-r18-release-candidate.cjs',
 'scripts/verify-v111-r17-finance-route-safety.cjs',
 'scripts/verify-v111-r16-premium-closeout.cjs',
 'scripts/verify-v111-r15-global-premium.cjs',
 'lib/route-closure-eligibility.ts',
 'lib/route-cash-flow.ts',
 'lib/stock-presentation-integrity.ts',
 'app/api/integration/worker/route.ts',
];
for(const file of required){if(!fs.existsSync(path.join(process.cwd(),file))) failures.push(`Arquivo obrigatório ausente: ${file}`);}
const check=git(['diff','--check']);
if(!check.ok) failures.push('git diff --check detectou formatação inválida');
const tracked=git(['ls-files','-z']);
if(!tracked.ok) failures.push('Não foi possível obter a lista de arquivos rastreados');
else {
 const suspicious=tracked.out.split('\0').filter(Boolean).filter(n=>
   /(^|\/)\.env(\.|$)|\.keystore$|\.jks$|\.p12$|(^|\/)(service-account|firebase-adminsdk)[^/]*\.json$/i.test(n));
 if(suspicious.length) failures.push(`${suspicious.length} possível(is) arquivo(s) secreto(s) rastreado(s) no Git (verificar localmente)`);
}
const branch=git(['branch','--show-current']);
const head=git(['rev-parse','--short','HEAD']);
const status=git(['status','--porcelain','--untracked-files=normal']);
if(!branch.ok||!head.ok||!status.ok) failures.push('Não foi possível consultar o estado Git');
const changes=status.ok?status.out.split('\n').filter(Boolean):[];
if(changes.length) warnings.push(`${changes.length} arquivo(s) com alteração local — NÃO descartar; preparar staging seletivo somente após autorização`);
const upstream=git(['rev-parse','--abbrev-ref','--symbolic-full-name','@{u}']);
if(!upstream.ok) warnings.push('Upstream Git não configurado; não é possível confirmar divergência com remoto sem consulta externa');
else {
 const diverged=git(['rev-list','--left-right','--count',`HEAD...${upstream.out}`]);
 if(diverged.ok) warnings.push(`Comparação apenas com cache remoto local (${upstream.out}): ${diverged.out.split(/\s+/)[0]||'?'} commit(s) local(is), ${diverged.out.split(/\s+/)[1]||'?'} no upstream`);
}
warnings.push('WhatsApp Supabase → Evolution: exige teste novo real de ponta a ponta (NÃO comprovado por esta auditoria)');
warnings.push('APK Android: exige GitHub Actions, instalação e teste humano após publicação autorizada');
warnings.push('Firewall, regras Firestore e permissões Supabase: auditoria operacional remota separada');
console.log('=== DFL ENTREGAS V111 — PRÉ-PUBLICAÇÃO (SOMENTE LEITURA) ===');
console.log(`Branch: ${branch.out||'indisponível'} | HEAD: ${head.out||'indisponível'}`);
console.log(`Suites PRE-APK: ${(fs.readFileSync('scripts/pre-apk.cjs','utf8').match(/'scripts\//g)||[]).length} declaradas`);
console.log('Verificações:');
console.log(` - Arquivos obrigatórios: ${required.length-failures.filter(x=>x.includes('Arquivo obrigatório')).length}/${required.length}`);
console.log(` - git diff --check: ${check.ok?'OK':'FALHOU'}`);
for(const w of warnings) console.log('PENDENTE: '+w);
for(const f of failures) console.error('BLOQUEADO: '+f);
if(failures.length) process.exit(1);
console.log('Pré-auditoria local OK. Publicação NÃO autorizada nem executada; pendências operacionais acima continuam abertas.');
