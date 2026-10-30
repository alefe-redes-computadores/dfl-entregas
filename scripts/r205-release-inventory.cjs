#!/usr/bin/env node
'use strict';
/** DFL R205: inventario release LOCAL, sem alterar git, Firebase ou arquivos do projeto. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const SECRETS = /(?:^|\/)(?:\.env(?:\..*)?|\.firebaserc|.*(?:secret|service[-_]?account|credentials?|private[-_]?key|keystore|signing[-_]?key)(?:\.[^/]*)?|[^/]+\.(?:pem|p12|pfx|jks|keystore|key))$/i;
const LEFTOVERS = /(?:\.orig|\.bak|\.backup|\.rej|\.swp|\.swo|\.tmp|\.old|~)$/i;
const CODE = /^(?:app|components|hooks|lib|store|types|scripts|styles|public|assets)\//;
const DOC = /^(?:docs|documentation)\//;
const CONFIG = /^(?:\.github\/workflows\/|security\/|firebase(?:\.|$)|\.firebaserc$|package(?:-lock)?\.json$|next\.config|capacitor\.config|tsconfig|tailwind\.config|postcss\.config)/i;
function git(root,args,{okStatus=0}={}) {
 const r=cp.spawnSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
 if(r.error)throw new Error('git indisponivel: '+r.error.message);
 if(r.status!==okStatus)throw new Error('git '+args.join(' ')+' falhou ('+r.status+'): '+(r.stderr||'').slice(0,300));
 return r.stdout;
}
function nul(stdout){return stdout.split('\0').filter(Boolean)}
function stageEmpty(root){return cp.spawnSync('git',['diff','--cached','--quiet'],{cwd:root}).status===0}
function sha(data){return crypto.createHash('sha256').update(data).digest('hex')}
function safePath(s){return typeof s==='string'&&s.length>0&&!s.startsWith('/')&&!s.includes('\\')&&!s.includes('\0')&&!s.split('/').includes('..')}
function categorize(file) {
 if(!safePath(file))return {group:'INVALIDO',selected:false};
 if(LEFTOVERS.test(file))return {group:'SOBRA_NAO_PUBLICAR',selected:false};
 if(SECRETS.test(file))return {group:'SEGREDO_NAO_PUBLICAR',selected:false};
 if(/(^|\/)(?:node_modules|\.next|out|build|dist|coverage|\.git)(\/|$)/.test(file))return {group:'GERADO_NAO_PUBLICAR',selected:false};
 if(/^security\/|\.rules$/.test(file))return {group:'REGRAS_REVISAO_SEPARADA',selected:false};
 if(CONFIG.test(file))return {group:'CONFIG_REVISAO_SEPARADA',selected:false};
 if(CODE.test(file))return {group:'CODIGO_CANDIDATO',selected:true};
 if(DOC.test(file))return {group:'DOCUMENTACAO_CANDIDATA',selected:true};
 return {group:'FORA_ESCOPO_REVISAO_SEPARADA',selected:false};
}
function readSafe(root,file){
 const full=path.join(root,file);
 const st=fs.lstatSync(full);
 if(!st.isFile())return {group:'NAO_ARQUIVO_REGULAR',selected:false};
 if(st.size>5*1024*1024)return {group:'ARQUIVO_GRANDE_REVISAO',selected:false,size:st.size};
 return {size:st.size,sha256:sha(fs.readFileSync(full))};
}
function gather(root){
 const inside=git(root,['rev-parse','--is-inside-work-tree']).trim();
 if(inside!=='true')throw Error('Pasta nao e repositorio Git.');
 if(!stageEmpty(root))throw Error('STAGE JA EXISTE: R205 exige index sem alteracoes. Nenhum staging sera feito.');
 git(root,['diff','--check']);
 const head=git(root,['rev-parse','HEAD']).trim();
 const branch=git(root,['branch','--show-current']).trim();
 const altered=nul(git(root,['diff','--name-only','-z','--diff-filter=ACMRT']));
 const untracked=nul(git(root,['ls-files','--others','--exclude-standard','-z']));
 const deleted=nul(git(root,['diff','--name-only','-z','--diff-filter=D']));
 const all=new Map();
 for(const file of altered)all.set(file,'modificado');
 for(const file of untracked)all.set(file,'novo');
 for(const file of deleted)all.set(file,'excluido');
 const selected=[],excluded=[],removed=[];
 for(const [file,status] of [...all.entries()].sort((a,b)=>a[0].localeCompare(b[0],'en'))){
  const c=categorize(file);
  if(status==='excluido'){removed.push({path:file,status,group:'EXCLUSAO_REVISAO_SEPARADA'});continue;}
  if(!safePath(file)){excluded.push({path:file,status,group:'INVALIDO'});continue;}
  let info;
  try{info=readSafe(root,file)}catch(error){excluded.push({path:file,status,group:'INACESSIVEL_REVISAO',note:error.code||'erro'});continue;}
  const group=info.group||c.group;
  const choose=c.selected&&!info.group;
  if(choose)selected.push({path:file,status,group,sha256:info.sha256,size:info.size});
  else excluded.push({path:file,status,group,size:info.size});
 }
 return {schema:'dfl-r205-release-candidate-v1',head,branch,selected,excluded,removed,
  gate:'PENDENTE_DE_AUTORIZACAO_E_HOMOLOGACAO_REAL',
  publicationPerformed:false,
  requirements:{productionRules:'PENDENTE',androidApk:'PENDENTE',twoDevices:'PENDENTE',ownerApproval:'PENDENTE'}};
}
function signature(data){return sha(JSON.stringify({head:data.head,branch:data.branch,selected:data.selected,excluded:data.excluded,removed:data.removed}));}
function verify(root,manifest){
 if(!manifest||manifest.schema!=='dfl-r205-release-candidate-v1')throw Error('Manifesto incompatível.');
 const now=gather(root);
 if(signature(now)!==manifest.inventorySha256)throw Error('DRIFT DETECTADO: HEAD, branch, lista ou SHA dos arquivos mudou. Refazer inventario; nao publicar.');
 return now;
}
module.exports={categorize,safePath,gather,signature,verify,git,stageEmpty};
