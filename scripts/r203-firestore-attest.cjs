#!/usr/bin/env node
'use strict';
/** Auditoria nao destrutiva das rules PUBLICADAS; nunca chama deploy. */
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const core=require('./r203-rules-core.cjs');
const root=process.env.DFL_R203_ROOT||path.resolve(__dirname,'..');
const argv=process.argv.slice(2);
const remote=argv.includes('--remote');
const outAt=argv.indexOf('--out');
const output=outAt>=0?argv[outAt+1]:null;
const pAt=argv.indexOf('--project');
const project=pAt>=0?argv[pAt+1]:process.env.DFL_R203_PROJECT_ID;
const local=core.localAudit(root);
let report={version:'R203',at:new Date().toISOString(),local,production:{status:'PENDENTE',description:'Sem consulta autenticada a fonte de rules em producao.'}};
function shortError(error){const msg=String(error instanceof Error?error.message:'falha na verificacao');return msg.replace(/Bearer\s+\S+/gi,'Bearer [omitido]').slice(0,180);}
async function run(){
 if(remote){
  let token=process.env.DFL_R203_ACCESS_TOKEN||'';
  if(!token){
   const command=cp.spawnSync('gcloud',['auth','print-access-token'],{encoding:'utf8',timeout:8000,maxBuffer:128*1024,env:process.env});
   if(command.status===0)token=(command.stdout||'').trim();
  }
  if(!core.validProject(project||'')){
   report.production={status:'PENDENTE',description:'Informe projeto com --project ou DFL_R203_PROJECT_ID; nunca adivinhar projeto.'};
  }else if(!token){
   report.production={status:'PENDENTE',description:'Sem token OAuth: use gcloud auth login ou DFL_R203_ACCESS_TOKEN temporario; nao copie tokens para o chat.'};
  }else{
   try{
    const live=await core.fetchPublishedRules(project,token,fetch);
    const evaluation=core.evaluateRules(live.content,core.readCandidates(root),{verifiedSource:true});
    report.production={project,rulesetName:live.rulesetName,releaseName:live.releaseName,source:'firebase-rules-rest-api',checkedAt:new Date().toISOString(),...evaluation};
   }catch(error){
    report.production={status:'PENDENTE',description:shortError(error)};
   }
  }
 }
 if(output){
  const file=path.resolve(output);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'w'});
  fs.chmodSync(file,0o600);
 }
 console.log('=== R203 | FIRESTORE RULES ===');
 console.log('Candidatas locais:',local.candidates.length);
 for(const row of local.candidates)console.log(row.role,row.path,row.sha256.slice(0,16));
 console.log('Workflow APK:',local.workflowPresent?'presente':'ausente','| Emulator:',local.emulatorConfigPresent?'configurado':'ausente');
 console.log('Regras PUBLICADAS:',report.production.status);
 if(report.production.description)console.log(report.production.description);
 if(report.production.why)console.log(report.production.why);
 console.log('Consulta: SOMENTE GET; nenhum deploy, nenhuma escrita Firestore.');
 if(output)console.log('Relatorio:',output);
 // Somente retorna erro para risco comprovado da regra publicada; nao se apropria de prova ausente.
 if(report.production.status==='BLOQUEADO')process.exitCode=2;
}
run().catch(e=>{console.error('R203:',shortError(e));process.exitCode=2});
