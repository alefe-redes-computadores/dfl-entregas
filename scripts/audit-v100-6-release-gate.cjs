'use strict';
const fs = require('fs');
const cp = require('child_process');
function exists(p){ return fs.existsSync(p); }
const needed=[
  'lib/ifood-confirmation-authority.ts',
  'scripts/verify-v100-6-closure-authority.cjs',
  'docs/V100-6-FECHAMENTO-OPERACIONAL.md',
  'scripts/patch-android-location-permissions.mjs',
];
const missing=needed.filter(p=>!exists(p));
if(missing.length){ console.error('ARQUIVOS AUSENTES:',missing.join(', ')); process.exit(1); }
console.log('Gate V100.6 — arquivos esperados: OK');
if(exists('.git')){
 const diff=cp.spawnSync('git',['diff','--check'],{encoding:'utf8'});
 if(diff.status!==0){console.error(diff.stdout||diff.stderr);process.exit(1);}
 const status=cp.spawnSync('git',['status','--short'],{encoding:'utf8'});
 const lines=(status.stdout||'').trim().split(/\r?\n/).filter(Boolean);
 console.log(`Git: ${lines.length} caminhos pendentes de revisão seletiva.`);
}else console.log('Git: pasta .git indisponível nesta cópia; verificar no Termux.');
console.log('BLOQUEADOR MANUAL: conferir Firestore Rules em produção; não inferir regras pelo código do cliente.');
console.log('BLOQUEADOR MANUAL: testar fluxo simultâneo em dois dispositivos e APK Android real.');
console.log('Nenhum commit, push, deploy ou alteração remota realizada.');
