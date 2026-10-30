'use strict';
/** DFL_R203_RULES_PRODUCTION - funcoes puras, sem rede nem segredos. */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const CANDIDATES = [
  'security/firestore.v111-r21-owner-only.rules',
  'security/firestore.v111-r23-owner-only.rules',
  'security/firestore.v111-r24-candidate.rules',
  'security/firestore.v111-r26-candidate.rules',
];
const OWNER_ONLY = new Set(CANDIDATES.slice(0, 2));
const hash = value => crypto.createHash('sha256').update(value.replace(/\r\n/g, '\n'),'utf8').digest('hex');
// Comparacao de texto de regras: tolera comentarios e formatacao, NAO faz prova formal.
const normalize = value => value.replace(/\r\n/g,'\n').replace(/^\s*\/\/.*$/gm,'').replace(/\s+/g,'');
const suspicious = value => /allow\s+[^;]*\bif\s+(?:true|request\.auth\s*!=\s*null)\s*;/m.test(value) ||
  /allow\s+[^;]*\bif\s+request\.auth\.uid\s*!=\s*null\s*;/m.test(value);
function readCandidates(root) {
  return CANDIDATES.filter(name => fs.existsSync(path.join(root,name)))
    .map(name=>({name, content:fs.readFileSync(path.join(root,name),'utf8')}));
}
function evaluateRules(remoteContent, candidates, { verifiedSource=false }={}) {
  const sha256=hash(remoteContent);
  const normalized=normalize(remoteContent);
  const matching = candidates.filter(row => normalize(row.content)===normalized).map(row=>row.name);
  const exact = candidates.filter(row => hash(row.content)===sha256).map(row=>row.name);
  let status='REVISAR';
  let why='Regras nao equivalentes a uma politica owner-only conhecida. Revisao humana obrigatoria.';
  if (suspicious(remoteContent)) {
    status='BLOQUEADO';why='Possivel permissao publica ou ampla. Auditar rules efetivas imediatamente.';
  } else if (matching.some(name=>OWNER_ONLY.has(name))) {
    if (verifiedSource) {status='OWNER_ONLY_VERIFICADO';why='Fonte ativa consultada na API e estrutura equivalente ao espelho owner-only homologado.';}
    else {status='EVIDENCIA_LOCAL';why='Arquivo fornecido equivale ao espelho owner-only, mas nao comprova implantacao.';}
  } else if (matching.length>0) {
    status='BLOQUEADO';why='Corresponde a uma regra candidata de emulador (R24/R26), nao autorizada para publicacao.';
  }
  return { status, why, sha256, matches:matching, exactMatches:exact, sourceVerified:verifiedSource };
}
function localAudit(root){
  const candidates=readCandidates(root);
  const files=candidates.map(row=>({path:row.name,sha256:hash(row.content),role:OWNER_ONLY.has(row.name)?'ESPELHO_OWNER_ONLY':'CANDIDATA_EMULADOR_NAO_PUBLICAR',suspicious:suspicious(row.content)}));
  const gitWorkflow=fs.existsSync(path.join(root,'.github/workflows/main.yml'));
  const emulatorConfig=fs.existsSync(path.join(root,'firebase.r26-emulator.json'));
  const r201=fs.existsSync(path.join(root,'lib/operation/delivery-import-identity.ts'));
  const r202=fs.existsSync(path.join(root,'lib/operation/legacy-import-audit.ts'));
  return {candidates:files,workflowPresent:gitWorkflow,emulatorConfigPresent:emulatorConfig,r201Present:r201,r202Present:r202,production:'NAO_VERIFICADA',note:'Arquivos locais nao sao prova das regras publicadas.'};
}
function validProject(id){return typeof id==='string'&&/^[a-z][a-z0-9-]{4,39}$/.test(id)&&!id.startsWith('demo-');}
function validRulesetName(name,project){return typeof name==='string' && name.startsWith(`projects/${project}/rulesets/`) && /^projects\/[a-z0-9-]+\/rulesets\/[A-Za-z0-9_-]+$/.test(name);}
function extractRulesetContent(ruleset){
  const files=ruleset?.source?.files;
  if(!Array.isArray(files) || !files.length || files.length>10) throw new Error('Ruleset sem fontes validas.');
  const contents=files.filter(f=>typeof f?.content==='string'&&f.content.includes('service cloud.firestore')).map(f=>f.content);
  if (contents.length!==1) throw new Error('Ruleset Firestore nao possui exatamente uma fonte identificavel.');
  return contents[0];
}
async function fetchPublishedRules(project,token,fetcher){
  if(!validProject(project))throw new Error('Projeto real invalido; informe DFL_R203_PROJECT_ID explicitamente.');
  if(typeof token!=='string'||token.length<12)throw new Error('Credencial OAuth ausente; verifique gcloud auth.');
  async function get(endpoint){
    const resp=await fetcher(`https://firebaserules.googleapis.com/v1/${endpoint}`,{
      method:'GET',headers:{authorization:`Bearer ${token}`,accept:'application/json'},signal:AbortSignal.timeout(16000)
    });
    if(!resp.ok)throw new Error(`Consulta de rules falhou: HTTP ${resp.status} (sem expor credenciais).`);
    return await resp.json();
  }
  const release=await get(`projects/${project}/releases/cloud.firestore`);
  if(!validRulesetName(release.rulesetName,project))throw new Error('Release Firestore retornou ruleset inesperado.');
  const ruleset=await get(release.rulesetName);
  return {content:extractRulesetContent(ruleset),rulesetName:release.rulesetName,releaseName:release.name||`projects/${project}/releases/cloud.firestore`};
}
module.exports={CANDIDATES,OWNER_ONLY,hash,normalize,suspicious,readCandidates,evaluateRules,localAudit,validProject,validRulesetName,extractRulesetContent,fetchPublishedRules};
