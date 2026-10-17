#!/usr/bin/env node
/** Auditoria LOCAL e somente leitura. Nunca faz push, deploy, writes ou chamadas ao Firebase. */
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const required=[
 'lib/stock-mutation-plan.ts', 'lib/stock-supply-ledger.ts',
 'scripts/verify-v100-4-stock-authority.cjs', 'scripts/verify-v100-3-stock-ledger.cjs',
 'scripts/verify-v100-2-settlement-integrity.cjs',
 'scripts/verify-v89-4-pickup-site-authority.cjs',
 'scripts/verify-v98-route-sharing-integrity.cjs',
 'docs/V100-4-RELEASE-GATE.md',
];
const failed=[];
const warnings=[];
const run=(...args)=>spawnSync('git',args,{encoding:'utf8'});
for(const f of required)if(!fs.existsSync(f))failed.push('Arquivo obrigatório ausente: '+f);
if(!fs.existsSync('scripts/pre-apk.cjs')||!fs.readFileSync('scripts/pre-apk.cjs','utf8').includes('scripts/verify-v100-4-stock-authority.cjs'))failed.push('Contrato V100.4 ausente do PRE-APK');
const git=run('rev-parse','--is-inside-work-tree');
if(git.status===0){
 const diff=run('diff','--check');if(diff.status!==0)failed.push('git diff --check: '+(diff.stdout||diff.stderr));
 const status=run('status','--porcelain=v1','--untracked-files=all');
 if(status.status===0){
  const changed=status.stdout.split(/\r?\n/).filter(Boolean);
  console.log(`Arquivos pendentes de revisão no Git: ${changed.length}`);
  if(changed.length)warnings.push('Revisar cuidadosamente TODOS os arquivos antes de git add explícito. Não usar git add .');
  const sensitive=changed.map(line=>line.slice(3)).filter(p=>/(^|\/)(?:\.env(?:\..*)?|google-services\.json|[^/]+\.(?:pem|key|jks|keystore))$/i.test(p));
  if(sensitive.length)failed.push('Potenciais segredos no status: '+sensitive.join(', '));
 }
 const tracked=run('ls-files');
 if(tracked.status===0){
  const sensitive=tracked.stdout.split(/\r?\n/).filter(p=>/(^|\/)(?:\.env(?:\..*)?|google-services\.json|[^/]+\.(?:pem|key|jks|keystore))$/i.test(p));
  if(sensitive.length)failed.push('Arquivo sensível rastreado: '+sensitive.join(', '));
 }
 const remote=run('remote','-v'); if(remote.status===0)console.log('Remoto configurado: '+(remote.stdout.includes('github.com')?'GitHub':'verificar URL manualmente'));
} else warnings.push('Cópia sem .git: somente verificações de arquivos; executar auditoria completa no Termux.');
// Não há evidência das regras de produção no repositório, portanto NÃO é seguro
// concluir que o banco está protegido somente pelos testes de cliente.
warnings.push('BLOQUEADOR EXTERNO: confirmar regras Firestore de produção (não podem ser allow read, write: if true).');
warnings.push('Validar Android/APK real, WhatsApp, Pix, retiradas do Site, fechamento/reabertura e confirmações iFood.');
warnings.push('Comparar a branch local ao origin/main, inspecionar diff e autorizar commit/push explicitamente.');
console.log('\n=== AUDITORIA V100.4 — SOMENTE LEITURA ===');
failed.forEach(x=>console.error('ERRO:',x));warnings.forEach(x=>console.warn('PENDENTE:',x));
console.log(failed.length?'BLOQUEADO — ERROS LOCAIS':'VERIFICAÇÕES LOCAIS OK; A PUBLICAÇÃO AINDA NÃO ESTÁ AUTORIZADA');
process.exit(failed.length?1:0);
