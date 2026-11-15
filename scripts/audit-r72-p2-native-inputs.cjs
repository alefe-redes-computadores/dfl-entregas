#!/usr/bin/env node
'use strict';
// Informational inventory, no implicit mutations or removal of accessibility semantics.
const fs=require('node:fs'),path=require('node:path');
const ignores=new Set(['node_modules','.next','.git','android','ios','dist','build']);
const found=[];
function walk(dir){if(!fs.existsSync(dir))return;
 for(const dirent of fs.readdirSync(dir,{withFileTypes:true})){
  if(ignores.has(dirent.name))continue;
  const full=path.join(dir,dirent.name);
  if(dirent.isDirectory())walk(full);
  else if(/\.(tsx|jsx)$/.test(dirent.name)){
   const text=fs.readFileSync(full,'utf8');
   for(const match of text.matchAll(/<select\b|<input\b[^>]{0,500}type=["'](?:date|datetime-local|time)["']/gs)){
    const line=text.slice(0,match.index).split('\n').length;
    found.push(`${full}:${line}:${match[0].startsWith('<select')?'SELECT':'TEMPORAL'}`);
   }
  }
 }
}
walk('app');walk('components');
console.log(`R72 P2 AUDITORIA SELETORES: ${found.length} ocorrencia(s) restantes no codigo TSX/JSX`);
found.forEach(x=>console.log('REVISAR',x));
console.log('Relatorio informativo: substituicao global automatica e insegura nao sera feita.');
