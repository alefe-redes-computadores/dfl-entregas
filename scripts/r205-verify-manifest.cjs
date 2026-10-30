#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const inv=require('./r205-release-inventory.cjs');
function run(argv=process.argv.slice(2),cwd=process.cwd()){
 const ix=argv.indexOf('--manifest');
 if(ix<0||!argv[ix+1])throw Error('Uso: node scripts/r205-verify-manifest.cjs --manifest /pasta/R205-MANIFEST.json');
 const p=path.resolve(argv[ix+1]);
 const m=JSON.parse(fs.readFileSync(p,'utf8'));
 inv.verify(path.resolve(cwd),m);
 console.log('R205: manifesto confere com HEAD, branch, status e hashes atuais.');
 console.log('GATE PRODUCAO: PENDENTE; nenhuma acao de publicacao executada.');
}
if(require.main===module){try{run()}catch(e){console.error('R205 VERIFICACAO BLOQUEADA: '+e.message);process.exitCode=1;}}
module.exports={run};
