#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const cp=require('node:child_process');
const file='components/home/OperationalCommandCenter.tsx';
const source=fs.readFileSync(file,'utf8');
const head=cp.execFileSync('git',['hash-object',file],{encoding:'utf8'}).trim();
if(head!=='7e57423f0844ba6fe6f3105c3c20f44423f401e4')throw Error('Base do Command Center alterada. Cirurgia bloqueada sem sobrescrever personalizacoes. SHA '+head);
const replacements=[
  ["className={`flex w-full items-center gap-3 rounded-[16px] border px-3 py-2.5 text-left active:scale-[0.99] ${style}`}","className={`flex min-h-14 w-full items-center gap-3 rounded-[16px] border px-3 py-2.5 text-left transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${style}`}"],
  ['onClick={() => router.push(item.href)}\n              className=',"onClick={() => router.push(item.href)}\n              aria-label={`${item.label}: ${item.count} pendência${item.count === 1 ? '' : 's'}. ${item.description}`}\n              className="],
  ['className="mt-0.5 truncate text-[10px] text-zinc-400"','className="mt-0.5 line-clamp-2 break-words text-[10px] leading-relaxed text-zinc-400"'],
  ['<span className="shrink-0 text-xs font-black">{item.badge ?? item.count}</span>','<span aria-hidden="true" className="shrink-0 rounded-lg bg-zinc-950/30 px-1.5 py-1 text-xs font-black tabular-nums">{item.badge ?? item.count}</span>'],
];
let text=source;
for(const [a,b] of replacements){if(text.split(a).length!==2)throw Error('Ancora nao-unica ou ausente: '+a.slice(0,55));text=text.replace(a,b)}
if(text===source)throw Error('Nenhuma alteracao gerada');
fs.writeFileSync(file,text);
const pre='scripts/pre-apk.cjs';let data=fs.readFileSync(pre,'utf8');const gate="  'scripts/test-r126-e9-home-actions.cjs',\n";if(data.includes('test-r126-e9-home-actions.cjs'))throw Error('Gate ja registrado, nao sobrescrever');
if(!data.includes('const tests=['))throw Error('Lista do pre-apk desconhecida');
data=data.replace('const tests=[','const tests=[\n'+gate);fs.writeFileSync(pre,data);
console.log('R126 E9 patches aplicados, nenhum dado financeiro ou Firestore alterado');
