#!/usr/bin/env node
'use strict';
/** R206 only reads repository; outputs reports outside it; no commits, pushes, secrets, rules deployment. */
const fs=require('node:fs');
const path=require('node:path');
const inv=require('./r205-release-inventory.cjs');
const {stagePreview}=require('./r206-simulated-index.cjs');
const blockedState='PENDENTE_HOMOLOGACAO_REAL';
function safeOut(root,out){
 const full=path.resolve(out),repository=path.resolve(root);
 if(full===repository||full.startsWith(repository+path.sep))throw Error('R206: relatorios fora do repositorio obrigatorios.');
 if(fs.existsSync(full) && fs.lstatSync(full).isSymbolicLink())throw Error('R206: nao usar link simbolico como destino.');
 return full;
}
function delta(previous,current) {
 if(!previous)return {available:false,reason:'Manifesto R205 anterior nao informado; rebase atual gerada na R206.'};
 if(previous.schema!=='dfl-r205-release-candidate-v1'||!Array.isArray(previous.selected))throw Error('R206: manifesto R205 anterior invalido.');
 const before=new Map(previous.selected.map(x=>[x.path,x.sha256]));
 const after=new Map(current.selected.map(x=>[x.path,x.sha256]));
 const added=[...after.keys()].filter(p=>!before.has(p)).sort();
 const removed=[...before.keys()].filter(p=>!after.has(p)).sort();
 const changed=[...after.keys()].filter(p=>before.has(p)&&after.get(p)!==before.get(p)).sort();
 return {available:true,previousHead:previous.head,previousFingerprint:previous.inventorySha256,
  added,removed,changed,addedCount:added.length,removedCount:removed.length,changedCount:changed.length};
}
function run(argv=process.argv.slice(2),root=process.cwd()) {
 const get=flag=>{const i=argv.indexOf(flag);return i<0?null:argv[i+1]};
 const manifestPath=get('--manifest'),outArg=get('--out');
 if(!manifestPath||!outArg)throw Error('Uso: node scripts/r206-release-review.cjs --manifest /pasta/R205-MANIFEST.json --out /pasta/relatorio [--previous /pasta/R205-MANIFEST.json]');
 const out=safeOut(root,outArg);
 const manifest=JSON.parse(fs.readFileSync(path.resolve(manifestPath),'utf8'));
 const previousPath=get('--previous');
 const previous=previousPath?JSON.parse(fs.readFileSync(path.resolve(previousPath),'utf8')):null;
 inv.verify(root,manifest);
 const preview=stagePreview(root,manifest);
 const change=delta(previous,manifest);
 const byGroup={};
 for(const row of [...manifest.excluded,...manifest.removed])byGroup[row.group]=(byGroup[row.group]||0)+1;
 const state={schema:'dfl-r206-prepublication-v1',generatedAt:new Date().toISOString(),
  head:manifest.head,branch:manifest.branch,inventorySha256:manifest.inventorySha256,
  productionGate:blockedState,automatedPreview:'APROVADO_COM_REVISAO_HUMANA_PENDENTE',
  verifiedCurrentFiles:true,selectedCount:preview.selectedCount,excludedCount:manifest.excluded.length,
  deletionReviewCount:manifest.removed.length, excludedGroups:byGroup,
  simulatedStage:{isolated:true,realIndexUntouched:true,selectionExact:true},
  nextChecks:{productionRules:'PENDENTE_PROVA_AUTENTICADA',apkReal:'PENDENTE_HOMOLOGACAO',twoDevices:'PENDENTE_TESTE_REAL',
    candidateCodeReview:'PENDENTE_REVISAO_UM_A_UM',ownerApproval:'PENDENTE_AUTORIZACAO_EXPLICITA'},
  oldManifestDelta:change, publicationPerformed:false};
 fs.mkdirSync(out,{recursive:true,mode:0o700});
 const write=(name,content)=>fs.writeFileSync(path.join(out,name),content,{mode:0o600,flag:'wx'});
 write('R206-RESULTADO.json',JSON.stringify(state,null,2)+'\n');
 write('R206-RESULTADO.txt',[
  'DFL ENTREGAS — R206 / SIMULACAO SEGURA DE RELEASE',
  `HEAD: ${state.head}`,`Branch: ${state.branch}`,`Manifesto: ${state.inventorySha256}`,
  `Simulados no indice isolado: ${preview.selectedCount} arquivo(s)`,
  `Excluidos (revisao): ${state.excludedCount} arquivo(s)`,
  `Exclusoes/remoções: ${state.deletionReviewCount} arquivo(s)`,
  'INDICE GIT REAL: INTACTO. NENHUM GIT ADD/COMMIT/PUSH/DEPLOY NO PROJETO.',
  'GATE AUTOMATICO R206: OK, SIMULACAO SOMENTE. GATE PRODUCAO: PENDENTE_HOMOLOGACAO_REAL.',
  'NAO usar este relatorio como autorizacao para publicar.',
 ].join('\n')+'\n');
 write('R206-STAGE-SIMULADO.txt',[
  'INDICE GIT ISOLADO: paths exatos que SERIAM staged (sem modificacao no indice real).',
  ...preview.staged,'', 'ESTATISTICAS DO DIFF SIMULADO:',preview.stat,
 ].join('\n')+'\n');
 write('R206-CHECKLIST.txt',[
  '[ ] Revisar os candidatos do stage simulado, arquivo por arquivo e impacto funcional.',
  '[ ] Conferir separadamente '+(manifest.excluded.length+manifest.removed.length)+' arquivos excluidos/restritos; nunca usar git add -A.',
  '[ ] Comparar via fonte autenticada as regras Firestore efetivamente publicadas.',
  '[ ] Homologar APK instalado e assinatura do artefato no Android real.',
  '[ ] Testar pedidos iFood e 99Food simultaneamente em dois aparelhos (sem duplicar venda).',
  '[ ] Testar Site -> Inbox -> rota, offline/online, financeiro/acerto e permissões.',
  '[ ] Obter autorizacao explicita do operador para publicar este mesmo manifesto.',
  'GATE PRODUCAO: PENDENTE (marcar checklist nao autoriza publicar).',
 ].join('\n')+'\n');
 write('R206-DELTA-R205.txt',change.available?[
  `Manifesto anterior: ${change.previousFingerprint}`,
  `Itens novos desde R205 (${change.addedCount}):`,...change.added,
  `Candidatos removidos da selecao (${change.removedCount}):`,...change.removed,
  `Candidatos modificados desde R205 (${change.changedCount}):`,...change.changed,
 ].join('\n')+'\n':'R205 anterior nao localizado; baseline R206 foi criada e verificada.\n');
 console.log(`R206: ${preview.selectedCount} selecionados simulados em indice isolado, ${manifest.excluded.length+manifest.removed.length} fora da allowlist.`);
 console.log('R206: stage real preservado; nenhum commit, push, deploy ou alteração de regras.');
 console.log('GATE DE PRODUCAO: PENDENTE_HOMOLOGACAO_REAL.');
 return state;
}
if(require.main===module){try{run()}catch(e){console.error('R206 BLOQUEADA: '+e.message);process.exitCode=1;}}
module.exports={run,delta,safeOut};
