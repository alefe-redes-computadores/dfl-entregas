#!/usr/bin/env node
'use strict';
/** DFL R204 - inventario somente leitura. NAO homologa regras por arquivo local. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
const arg=(flag)=>{const i=args.indexOf(flag);return i<0?null:args[i+1]||null;};
const out=arg('--out');
const attestation=arg('--rules-evidence');
const expected=arg('--project');
function git(...x){const p=cp.spawnSync('git',x,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:1024*1024});return p.status===0?p.stdout.trim():null;}
function rulesEvidence(file,project,now=Date.now()) {
  const pending={status:'PENDENTE',reason:'Sem atestacao autenticada recente do R203; arquivo local nao comprova producao.'};
  if(!file||!project||!/^([a-z][a-z0-9-]{4,39})$/.test(project)||project.startsWith('demo-'))return pending;
  try{
    if(fs.statSync(file).size>200000)return {...pending,reason:'Atestacao grande demais.'};
    const record=JSON.parse(fs.readFileSync(file,'utf8'));
    const p=record?.production;
    const stamp=Date.parse(p?.checkedAt||'');
    if(p?.project!==project||p?.source!=='firebase-rules-rest-api'||p?.sourceVerified!==true||
        p?.status!=='OWNER_ONLY_VERIFICADO'||!p?.rulesetName?.startsWith(`projects/${project}/rulesets/`)||
        p?.releaseName!==`projects/${project}/releases/cloud.firestore`||
        !Number.isFinite(stamp)||stamp>now||now-stamp>24*60*60*1000||
        !/^[a-f0-9]{64}$/.test(p?.sha256||''))
      return {...pending,reason:'Registro R203 sem prova coerente de projeto, fonte, hash ou data.'};
    return {status:'EVIDENCIA_DECLARADA',project,checkedAt:p.checkedAt,sha256:p.sha256,
      reason:'Arquivo R203 indica owner-only, mas um JSON local nao e prova independente. Confirmar diretamente na API antes de aprovar.'};
  }catch{return {...pending,reason:'Evidencia R203 invalida, inacessivel ou indisponivel.'};}
}
function main(){
  const stage=git('diff','--cached','--name-only');
  const leftovers=(git('ls-files','--others','--exclude-standard')||'').split('\n')
    .filter(f=>/(?:\.orig|\.bak|\.rej|\.swp|~)$/i.test(f)).slice(0,30);
  const required=['scripts/pre-apk.cjs','scripts/r203-firestore-attest.cjs',
    'scripts/test-r203-rules-production.cjs','lib/operation/delivery-import-identity.ts',
    'lib/operation/legacy-import-audit.ts','app/mais/acessos/publicacao/page.tsx',
    '.github/workflows/main.yml'];
  const missing=required.filter(f=>!fs.existsSync(path.join(root,f)));
  const rules=rulesEvidence(attestation,expected);
  const report={version:'R204',checkedAt:new Date().toISOString(),head:git('rev-parse','--short','HEAD'),
    local:{required:required.length,missing,stageClean:stage==='',leftovers: leftovers.length},
    rules,productionGate:'PENDENTE_HOMOLOGACAO_REAL',
    note:'Este inventario nao executa deploy, nao concede acesso e nao substitui evidencias externas.'};
  if(out){const target=path.resolve(out);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n',{mode:0o600});fs.chmodSync(target,0o600);}
  console.log('DFL R204 — evidencias para auditoria');
  console.log('Arquivos obrigatorios:',required.length-missing.length,'/',required.length);
  console.log('Stage limpo:',report.local.stageClean?'sim':'NAO');
  console.log('Sobras locais (nao publicar):',leftovers.length);
  console.log('Regras publicadas:',rules.status,'-',rules.reason);
  console.log('GATE DE PRODUCAO:',report.productionGate);
  if(out)console.log('Relatorio:',out);
  if(missing.length||stage!==''||!report.head){console.error('R204: bloqueio estrutural; sem acao de publicacao.');process.exitCode=1;}
}
if(require.main===module)main();
module.exports={rulesEvidence};
