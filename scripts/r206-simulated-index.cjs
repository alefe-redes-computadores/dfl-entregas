#!/usr/bin/env node
'use strict';
/** R206 - Git index isolated via GIT_INDEX_FILE; never stages the user's index. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const inventory = require('./r205-release-inventory.cjs');

function git(root, args, options={}) {
  const env = {...process.env, GIT_LITERAL_PATHSPECS: '1', ...options.env};
  const result = cp.spawnSync('git', args, {cwd: root, env, input:options.input,
    encoding: options.encoding || 'utf8', maxBuffer: 48*1024*1024});
  if (result.error || result.status !== 0) {
    throw new Error(`R206: git ${args.join(' ')} falhou (${result.status}): ${(result.stderr || result.error?.message || '').slice(0,350)}`);
  }
  return result.stdout;
}
function normalizePaths(names){return [...names].sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)));}
function stagePreview(root, manifest) {
  if(!inventory.stageEmpty(root))throw new Error('R206: stage real nao esta vazio. Operacao recusada.');
  inventory.verify(root,manifest); // checks branch, head, all selected/excluded/removed hashes
  const rootIndexPath = git(root, ['rev-parse','--git-path','index']).trim();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(),'dfl-r206-git-index-'));
  fs.chmodSync(tempDir,0o700);
  const fakeIndex = path.join(tempDir,'index');
  const env = {GIT_INDEX_FILE:fakeIndex};
  try {
    if (path.resolve(rootIndexPath) === path.resolve(fakeIndex)) throw new Error('R206: indice isolado invalido');
    git(root,['read-tree','HEAD'],{env});
    const selected = manifest.selected.map(x=>x.path);
    if (!Array.isArray(manifest.selected) || selected.some(p=>!inventory.safePath(p)))throw new Error('R206: caminhos de manifesto invalidos');
    if(selected.length)git(root,['add','--pathspec-from-file=-','--pathspec-file-nul'],{env,input:selected.join('\0')+'\0'});
    git(root,['diff','--cached','--check'],{env});
    const staged=git(root,['diff','--cached','--name-only','--no-renames','-z'],{env}).split('\0').filter(Boolean);
    const actual=normalizePaths(staged), expected=normalizePaths(selected);
    if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(`R206: indices divergentes (esperados ${expected.length}, simulados ${actual.length}); verificar caminhos novos ou inalterados.`);
    const stat=git(root,['diff','--cached','--stat','--no-renames'],{env});
    const statuses=git(root,['diff','--cached','--name-status','--no-renames','-z'],{env}).split('\0').filter(Boolean);
    if(statuses.some((s,i)=>i%2===0 && !/^[AMT]$/.test(s)))throw Error('R206: deletar ou renomear exige revisao separada.');
    if(!inventory.stageEmpty(root))throw Error('R206: stage real foi alterado inesperadamente.');
    inventory.verify(root,manifest);
    return {head:manifest.head,branch:manifest.branch,selectedCount:selected.length,staged:actual,stat:stat.trimEnd(),isolatedIndex:true,realIndexUntouched:true};
  } finally {
    fs.rmSync(tempDir,{recursive:true,force:true});
  }
}
module.exports={git,stagePreview};
