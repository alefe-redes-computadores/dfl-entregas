#!/usr/bin/env node
'use strict';
/** Gerador R205 somente leitura. Apenas grava relatorios no diretorio --out fora do repo. */
const fs=require('node:fs'),path=require('node:path');
const inv=require('./r205-release-inventory.cjs');
function run(argv=process.argv.slice(2),cwd=process.cwd()){
 const oi=argv.indexOf('--out');
 if(oi<0||!argv[oi+1])throw Error('Uso: node scripts/r205-release-plan.cjs --out /pasta/de/evidencias');
 const root=path.resolve(cwd),out=path.resolve(argv[oi+1]);
 if(out===root||out.startsWith(root+path.sep))throw Error('Relatorios devem ficar FORA do repositorio para nao poluir release.');
 const plan=inv.gather(root),inventorySha256=inv.signature(plan);
 const manifest={...plan,inventorySha256,generatedAt:new Date().toISOString()};
 fs.mkdirSync(out,{recursive:true,mode:0o700});
 const j=path.join(out,'R205-MANIFEST.json');
 fs.writeFileSync(j,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
 const allow=path.join(out,'R205-ALLOWLIST.txt');
 fs.writeFileSync(allow,plan.selected.map(x=>x.path).join('\n')+(plan.selected.length?'\n':''),{mode:0o600});
 const group=rows=>rows.map(x=>`- ${x.status}: ${JSON.stringify(x.path)} [${x.group}]`).join('\n')||'- nenhum';
 const excluded=[...plan.excluded,...plan.removed];
 const blocks=[
  'GATE DE PRODUCAO: PENDENTE (sempre).',
  'Regras Firestore reais: somente prova autenticada; arquivo local nao comprova.',
  'APK assinado/instalado: teste no Android real pendente.',
  'Dois aparelhos: importacao concorrente pendente.',
  'Permissoes equipe: acesso permanece restrito ate homologacao.',
  'Aprovacao explicita para publicar: pendente.',
  'ARQUIVOS EXCLUIDOS DA ALLOWLIST (nunca adicionar automaticamente):',group(excluded),
 ];
 fs.writeFileSync(path.join(out,'R205-PENDENCIAS.txt'),blocks.join('\n')+'\n',{mode:0o600});
 const report=[
  'DFL R205 — PLANO LOCAL DE RELEASE SELETIVO',
  'Nao executa git add, commit, push, firebase deploy ou build Android.',
  `HEAD: ${plan.head}`,`Branch: ${plan.branch||'(detached)'}`,
  `Candidatos: ${plan.selected.length}`,`Fora do escopo: ${plan.excluded.length}`,`Exclusoes: ${plan.removed.length}`,
  `Fingerprint de inventario: ${inventorySha256}`,
  'GATE AUTOMATICO: inventario concluido; nao substitui tsc/pre-APK.',
  'GATE PRODUCAO: PENDENTE_DE_AUTORIZACAO_E_HOMOLOGACAO_REAL',
  'ATENCAO: allowlist e somente sugestao; revisar cada alteracao antes de publicar.',
  '', 'ARQUIVOS CANDIDATOS',group(plan.selected),
  '', 'ARQUIVOS FORA DO RELEASE',group(excluded),
 ];
 fs.writeFileSync(path.join(out,'R205-RESULTADO.txt'),report.join('\n')+'\n',{mode:0o600});
 console.log('R205: inventario gerado com '+plan.selected.length+' candidato(s), '+excluded.length+' exclusao(oes)/revisao(oes).');
 console.log('R205: manifesto SHA-256 '+inventorySha256);console.log('GATE PRODUCAO: PENDENTE (nao houve commit, push ou deploy).');
 return manifest;
}
if(require.main===module){try{run()}catch(e){console.error('R205 BLOQUEADA: '+e.message);process.exitCode=1;}}
module.exports={run};
