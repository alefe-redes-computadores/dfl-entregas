#!/usr/bin/env node
'use strict';
// Inspecao local: NAO acessa Firebase remoto ou segredos; nao altera arquivos.
const fs=require('fs');const cp=require('child_process');
const exists=p=>fs.existsSync(p);
const read=p=>exists(p)?fs.readFileSync(p,'utf8'):'';
const count=(s,r)=>[...s.matchAll(r)].length;
const checks={
  localHead:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  rulesAtRoot:exists('firestore.rules'),
  firebaseConfigAtRoot:exists('firebase.json'),
  candidateRules:[],
  staffActivationLocked:read('lib/access/roles.ts').includes("activation: 'not_enabled'")&&read('lib/access/staffRepository.ts').includes("record.activation !== 'not_enabled'"),
  syncRegressionGate:exists('scripts/test-v112-r91-sync-resilience.cjs'),
  inboxRegressionGate:exists('scripts/test-v111-r66-site-inbox.cjs'),
  geocodeCache:read('lib/store-geocoding.ts').includes('GEO_CACHE_TTL_MS'),
  emulatorTest:exists('scripts/test-v111-r64-rules-emulator.cjs'),
  firestoreDeployedRulesVerified:false,
};
const walk=(dir,depth=0)=>{if(depth>4||!exists(dir))return;for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+ent.name;if(ent.isDirectory())walk(p,depth+1);else if(/\.rules$/.test(ent.name))checks.candidateRules.push(p);}};
walk('security');
const pre=read('scripts/pre-apk.cjs');
checks.preApkSuites=count(pre,/^\s*'scripts\/[^']+\.cjs'/gm);
console.log(JSON.stringify({version:'R125-E3',mode:'LOCAL_READ_ONLY',checks,warning:'Regras Firestore efetivamente implantadas NAO verificadas. Nunca ativar equipe baseado neste relatorio.'},null,2));
